// ── Effect collection & normalization (Phase 6 / Chunk C) ──────────
//
// Single boundary between the legacy `RawEffect` wire shape and the
// engine's typed `ResolvedEffect`. No code under `src/rules/` other than
// this module should consume `RawEffect` directly.
//
// What this module does in Chunk C:
//   * Walks `character.traits[]`, calling the registry to resolve each
//     trait into its tier-flattened effect set. Missing entries are
//     skipped with a warning (Chunk G's reference-lint promotes this to
//     a hard failure).
//   * Walks `character.effects[]` (manual / persistent overrides) and
//     normalizes each `RawEffect` into a `ResolvedEffect`. Lifecycle is
//     ignored — `duration` is dropped at the boundary.
//   * Walks nested `effects[]` arrays inside any RawEffect (Bug #22).
//   * Groups results by `EffectPhase` for the ordered pipeline.
//
// What this module does NOT do (deferred):
//   * Talents (`character.talents[]`) — TODO(phase6-post-G). The decision
//     on whether talents contribute engine effects is pending; the
//     registry interface declares `lookupTalent` for forward compat.
//   * Equipment effects (`equipment.weapons[*].effects`,
//     `equipment.armor.*`, `equipment.runes[*]`) — TODO(phase6-chunk-E),
//     handled by per-slot combat fanout.

import type {
  AbilityTier,
  EffectModifier,
  EffectPhase,
  EffectTarget,
  LearnedTrait,
  PrimaryAttributeName,
  RawEffect,
  ResolvedEffect,
  WeaponPredicate,
} from "#rpg-types";
import type { Registry } from "./registry-types.mts";

const KNOWN_PRIMARY_ATTRIBUTES = new Set<PrimaryAttributeName>([
  "accurate",
  "cunning",
  "discreet",
  "appealing",
  "quick",
  "resolute",
  "vigilant",
  "strong",
]);

const KNOWN_SECONDARY_STATS = new Set<string>([
  "toughness",
  "defense",
  "armor",
  "painThreshold",
  "corruptionThreshold",
  "corruptionMax",
]);

const KNOWN_COMBAT_FIELDS = new Set<string>([
  "attackAttribute",
  "baseDamage",
  "bonusDamage",
]);

const KNOWN_TARGET_KINDS = new Set<string>([
  "secondary",
  "combat",
  "weaponQuality",
  "armorQuality",
  "flag",
]);

const KNOWN_PREDICATE_KINDS = new Set<string>(["any", "type", "quality", "id"]);

const KNOWN_MODIFIER_TYPES = new Set<string>([
  "setBase",
  "addFlat",
  "multiply",
  "cap",
  "remove",
]);

// ── Public API ─────────────────────────────────────────────────────

export function normalizeRawEffect(
  raw: RawEffect,
  source: string,
): ResolvedEffect | null {
  if (raw.priority !== undefined) {
    // Silently ignored — phase ordering replaces priority (ADR-015 §4).
  }
  if (raw.duration !== undefined) {
    // Silently ignored — engine has no lifecycle (ADR-015 / Chunk C plan).
  }

  const target = parseTarget(raw.target, source);
  if (!target) return null;

  const modifier = parseModifier(raw.modifier, target, source);
  if (!modifier) return null;

  const effectSource = raw.source ?? raw.name ?? raw.id ?? source;

  const result: ResolvedEffect = {
    source: effectSource,
    target,
    modifier,
  };

  if (raw.appliesTo !== undefined) {
    // `combat` and `weaponQuality`: appliesTo is engine-evaluated (per-slot fanout).
    // `flag`: appliesTo is preserved as documentary metadata for siblings (roll-time
    //   modifiers like `advantage` are sibling-side; the engine still adds the flag
    //   name to the global set regardless of `appliesTo`). See ADR-015 + Item 13.
    // All other target kinds: silently stripped with a warn (per ADR-015 §3a).
    if (
      target.kind !== "combat" &&
      target.kind !== "weaponQuality" &&
      target.kind !== "flag"
    ) {
      console.warn(
        `[effects] Stripping appliesTo from target kind ${target.kind} ` +
          `(only combat / weaponQuality / flag accept appliesTo, source=${effectSource}).`,
      );
    } else {
      const predicates = parseAppliesTo(raw.appliesTo, effectSource);
      if (predicates && predicates.length > 0) {
        result.appliesTo = predicates;
      }
    }
  }

  return result;
}

export function collectAllEffects(
  character: {
    traits?: LearnedTrait[];
    talents?: unknown[];
    effects?: RawEffect[];
    equipment?: {
      armor?: {
        body?: {
          id: string;
          qualities?: string[];
          effects?: ResolvedEffect[];
        } | null;
        plug?: {
          id: string;
          qualities?: string[];
          effects?: ResolvedEffect[];
        } | null;
      };
    };
  },
  registry: Registry,
): ResolvedEffect[] {
  const collected: ResolvedEffect[] = [];

  // Traits → registry lookup.
  for (const trait of character.traits ?? []) {
    const result = registry.lookupTrait(trait.id, trait.tier as AbilityTier);
    if (!result) {
      console.warn(
        `[effects] Unknown trait ${trait.id}:${trait.tier} — skipped. ` +
          `Chunk G's reference-lint promotes this to a hard failure.`,
      );
      continue;
    }
    collected.push(...result.effects);
  }

  // Talents — TODO(phase6-post-G): decide whether talents contribute
  // engine effects. Currently ignored; `character.talents` is left alone.

  // Manual / persistent overrides on the character itself.
  for (const raw of character.effects ?? []) {
    collectFromRaw(raw, "character.effects", collected);
  }

  // Armor-mounted effects (typed pass-through; reference catalog feeds
  // ResolvedEffect[] directly via the registry deserializer in Chunk G).
  // Weapon effects are NOT collected here — they enter per-slot in
  // `deriveCombatSlots` with implicit `appliesTo` = the carrying weapon.
  const armor = character.equipment?.armor;
  if (armor?.body && Array.isArray(armor.body.effects)) {
    collected.push(...armor.body.effects);
  }
  if (armor?.plug && Array.isArray(armor.plug.effects)) {
    collected.push(...armor.plug.effects);
  }

  // Registry-resolved armor quality effects (ADR-016): walk both armor
  // pieces' `qualities[]` and append the registry's effects globally.
  // Unknown ids throw with the offending piece + id (F.0e behaviour).
  if (armor?.body && Array.isArray(armor.body.qualities)) {
    appendArmorQualityEffects(
      armor.body.qualities,
      registry,
      collected,
      "body",
      armor.body.id,
    );
  }
  if (armor?.plug && Array.isArray(armor.plug.qualities)) {
    appendArmorQualityEffects(
      armor.plug.qualities,
      registry,
      collected,
      "plug",
      armor.plug.id,
    );
  }

  return collected;
}

function appendArmorQualityEffects(
  qualities: string[],
  registry: Registry,
  out: ResolvedEffect[],
  piece: "body" | "plug",
  pieceId: string,
): void {
  for (const qualityId of qualities) {
    const quality = registry.lookupQuality(qualityId);
    if (!quality) {
      throw new Error(
        `[quality-registry] Unknown armor quality '${qualityId}' on ` +
          `armor.${piece} '${pieceId}'. ` +
          `Every quality id on a weapon or armor piece must have a matching ` +
          `entry in reference/qualities.<locale>.json (ADR-016).`,
      );
    }
    for (const effect of quality.effects) out.push(effect);
  }
}

export function groupByPhase(
  effects: ResolvedEffect[],
): Map<EffectPhase, ResolvedEffect[]> {
  const groups = new Map<EffectPhase, ResolvedEffect[]>();
  for (const effect of effects) {
    const phase = phaseOf(effect);
    const bucket = groups.get(phase);
    if (bucket) bucket.push(effect);
    else groups.set(phase, [effect]);
  }
  return groups;
}

// ── Helpers ────────────────────────────────────────────────────────

function collectFromRaw(
  raw: RawEffect,
  source: string,
  out: ResolvedEffect[],
): void {
  // The raw entry may carry its own target+modifier, nested effects, or both.
  if (raw.target !== undefined && raw.modifier !== undefined) {
    const normalized = normalizeRawEffect(raw, source);
    if (normalized) out.push(normalized);
  }
  if (Array.isArray(raw.effects)) {
    for (const child of raw.effects) {
      collectFromRaw(child, source, out);
    }
  }
}

function phaseOf(effect: ResolvedEffect): EffectPhase {
  // `flag` / `weaponQuality` / `armorQuality` always run in the `flag`
  // phase regardless of modifier type. They mutate set membership rather
  // than participating in numeric ordering.
  if (
    effect.target.kind === "flag" ||
    effect.target.kind === "weaponQuality" ||
    effect.target.kind === "armorQuality"
  ) {
    return "flag";
  }
  switch (effect.modifier.type) {
    case "setBase":
      return "setBase";
    case "addFlat":
      return "addFlat";
    case "multiply":
      return "multiply";
    case "cap":
      return "cap";
    case "remove":
      // `remove` on a numeric target is semantically odd; bucket into flag
      // so the addFlat/multiply/cap handlers don't have to worry about it.
      return "flag";
  }
}

function parseTarget(value: unknown, source: string): EffectTarget | null {
  if (typeof value === "string") {
    console.warn(
      `[effects] Rejecting legacy dotted-path target "${value}" (source=${source}). ` +
        `Use the typed EffectTarget union (ADR-015).`,
    );
    return null;
  }
  if (!isPlainObject(value)) {
    console.warn(
      `[effects] Rejecting effect with missing/invalid target (source=${source}).`,
    );
    return null;
  }
  const kind = (value as { kind?: unknown }).kind;
  if (typeof kind !== "string" || !KNOWN_TARGET_KINDS.has(kind)) {
    console.warn(
      `[effects] Rejecting effect with unknown target kind ${JSON.stringify(kind)} (source=${source}).`,
    );
    return null;
  }
  switch (kind) {
    case "secondary": {
      const stat = (value as { stat?: unknown }).stat;
      if (typeof stat !== "string" || !KNOWN_SECONDARY_STATS.has(stat)) {
        console.warn(
          `[effects] Rejecting secondary effect with unknown stat ${JSON.stringify(stat)} (source=${source}).`,
        );
        return null;
      }
      return { kind: "secondary", stat: stat as never };
    }
    case "combat": {
      const field = (value as { field?: unknown }).field;
      if (typeof field !== "string" || !KNOWN_COMBAT_FIELDS.has(field)) {
        console.warn(
          `[effects] Rejecting combat effect with unknown field ${JSON.stringify(field)} (source=${source}).`,
        );
        return null;
      }
      return { kind: "combat", field: field as never };
    }
    case "weaponQuality": {
      const quality = (value as { quality?: unknown }).quality;
      if (typeof quality !== "string" || quality.length === 0) {
        console.warn(
          `[effects] Rejecting weaponQuality effect without quality string (source=${source}).`,
        );
        return null;
      }
      return { kind: "weaponQuality", quality };
    }
    case "armorQuality": {
      const quality = (value as { quality?: unknown }).quality;
      if (typeof quality !== "string" || quality.length === 0) {
        console.warn(
          `[effects] Rejecting armorQuality effect without quality string (source=${source}).`,
        );
        return null;
      }
      return { kind: "armorQuality", quality };
    }
    case "flag": {
      const name = (value as { name?: unknown }).name;
      if (typeof name !== "string" || name.length === 0) {
        console.warn(
          `[effects] Rejecting flag effect without name (source=${source}).`,
        );
        return null;
      }
      return { kind: "flag", name: name as never };
    }
  }
  return null;
}

function parseModifier(
  value: unknown,
  target: EffectTarget,
  source: string,
): EffectModifier | null {
  if (!isPlainObject(value)) {
    console.warn(
      `[effects] Rejecting effect with missing modifier (source=${source}).`,
    );
    return null;
  }
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string") {
    console.warn(
      `[effects] Rejecting effect with non-string modifier.type (source=${source}).`,
    );
    return null;
  }
  if (!KNOWN_MODIFIER_TYPES.has(type)) {
    if (type === "add" || type === "mul" || type === "set") {
      console.warn(
        `[effects] Rejecting legacy modifier verb "${type}" (source=${source}). ` +
          `Use addFlat / multiply / setBase per ADR-015.`,
      );
    } else {
      console.warn(
        `[effects] Rejecting unknown modifier type "${type}" (source=${source}).`,
      );
    }
    return null;
  }

  const modVal = (value as { value?: unknown }).value;

  switch (type) {
    case "setBase": {
      if (target.kind === "combat" && target.field !== "attackAttribute") {
        console.warn(
          `[effects] Rejecting setBase on combat field ${target.field} (only attackAttribute accepts setBase, source=${source}).`,
        );
        return null;
      }
      if (
        typeof modVal !== "string" ||
        !KNOWN_PRIMARY_ATTRIBUTES.has(modVal as PrimaryAttributeName)
      ) {
        console.warn(
          `[effects] Rejecting setBase with non-primary-attribute value ${JSON.stringify(modVal)} (source=${source}).`,
        );
        return null;
      }
      return { type: "setBase", value: modVal as PrimaryAttributeName };
    }
    case "addFlat":
    case "multiply":
    case "cap": {
      if (target.kind === "combat" && target.field === "attackAttribute") {
        console.warn(
          `[effects] Rejecting ${type} on combat.attackAttribute (only setBase accepted, source=${source}).`,
        );
        return null;
      }
      if (typeof modVal !== "number" || !Number.isFinite(modVal)) {
        console.warn(
          `[effects] Rejecting ${type} with non-numeric value ${JSON.stringify(modVal)} (source=${source}).`,
        );
        return null;
      }
      return { type, value: modVal };
    }
    case "remove": {
      if (
        target.kind !== "weaponQuality" &&
        target.kind !== "armorQuality" &&
        target.kind !== "flag"
      ) {
        console.warn(
          `[effects] Rejecting remove modifier on numeric target (kind=${target.kind}, source=${source}).`,
        );
        return null;
      }
      return { type: "remove" };
    }
  }
  return null;
}

function parseAppliesTo(
  value: unknown,
  source: string,
): WeaponPredicate[] | null {
  if (!Array.isArray(value)) {
    console.warn(`[effects] Rejecting non-array appliesTo (source=${source}).`);
    return null;
  }
  const out: WeaponPredicate[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) {
      console.warn(
        `[effects] Skipping non-object appliesTo entry (source=${source}).`,
      );
      continue;
    }
    const kind = (entry as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !KNOWN_PREDICATE_KINDS.has(kind)) {
      console.warn(
        `[effects] Skipping appliesTo entry with unknown kind ${JSON.stringify(kind)} (source=${source}).`,
      );
      continue;
    }
    if (kind === "any") {
      out.push({ kind: "any" });
      continue;
    }
    const values = (entry as { values?: unknown }).values;
    if (!Array.isArray(values) || !values.every((v) => typeof v === "string")) {
      console.warn(
        `[effects] Skipping appliesTo entry without string values[] (source=${source}).`,
      );
      continue;
    }
    out.push({ kind: kind as "type" | "quality" | "id", values });
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
