// ── Effect collection & normalization ──────────────────────────────
//
// Single boundary between the legacy `RawEffect` wire shape and the
// engine's typed `ResolvedEffect`. No code under `src/rules/` other than
// this module should consume `RawEffect` directly.
//
// What this module does:
//   * Walks `character.traits[]` and `character.talents[]`, calling the
//     registry to resolve each into its tier/level-flattened effect set.
//     Missing entries are skipped with a warning today; the reference-
//     lint test will promote misses to a hard failure once it ships.
//   * Walks `character.effects[]` (manual / persistent overrides) and
//     normalizes each `RawEffect` into a `ResolvedEffect`. Lifecycle is
//     ignored — `duration` is dropped at the boundary.
//   * Walks nested `effects[]` arrays inside any RawEffect (NB-22).
//   * Collects armor-mounted effects (body / plug `.effects[]`) and
//     resolves armor `qualities[]` against the quality registry
//     (ADR-016 strictness — unknown ids throw).
//   * Groups results by `EffectPhase` for the ordered pipeline.
//
// Weapon-mounted effects and weapon `qualities[]` are NOT collected
// here — they enter per-slot in `deriveCombatSlots` with implicit
// `appliesTo` = the carrying weapon.

import type {
  AbilityTier,
  Action,
  ArmorCondition,
  EffectModifier,
  EffectPhase,
  EffectTarget,
  LearnedTalent,
  LearnedTrait,
  PrimaryAttributeName,
  RawEffect,
  ResolvedEffect,
  TriggerKind,
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
  "primary",
  "secondary",
  "combat",
  "weaponQuality",
  "armorQuality",
  "flag",
  "magicAttribute",
  "initiativeAttribute",
]);

const KNOWN_PREDICATE_KINDS = new Set<string>(["any", "type", "quality", "id"]);

const KNOWN_CONDITION_KINDS = new Set<string>([
  "armorQuality",
  "armorId",
  "armorSlot",
  "noArmor",
]);

const KNOWN_ARMOR_SLOTS = new Set<string>(["body", "plug"]);

const KNOWN_MODIFIER_TYPES = new Set<string>([
  "setBase",
  "addFlat",
  "multiply",
  "cap",
  "remove",
]);

// Mirrors the `TriggerKind` union (ADR-015 §5). Runtime membership set
// for the fail-fast action deserializer; the engine treats every value
// as opaque (only `"manual"` routes an action into `SpecialAttack[]`).
const KNOWN_TRIGGERS = new Set<string>([
  "manual",
  "onHit",
  "onMiss",
  "onContact",
  "onProne",
  "onAttacked",
  "onCheck",
  "onDodged",
  "onAdvantage",
  "onEnemyMovement",
  "onAllyAttacked",
  "onResisted",
  "onSpellCast",
  "onNewDay",
  "onDamaged",
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
    // Silently ignored — engine has no lifecycle (ADR-015).
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
    // Placement matrix (ADR-015 §3 / §placement-table). `appliesTo`
    // is engine-evaluated on `combat` / `weaponQuality` (per-slot fanout
    // in `deriveCombatSlots`), preserved as documentary metadata on
    // `flag` (roll-time, sibling-evaluated; engine still adds the flag
    // name globally), and accepted on `secondary` (engine has no slot-
    // aware secondary path; predicate is documentary at runtime — see
    // NB-34).
    // Any other target kind is a parser-reject: misplaced authoring,
    // not a silent strip.
    if (
      target.kind !== "combat" &&
      target.kind !== "weaponQuality" &&
      target.kind !== "flag" &&
      target.kind !== "secondary"
    ) {
      console.warn(
        `[effects] Rejecting effect: appliesTo not accepted on target ` +
          `kind ${target.kind} (only combat / weaponQuality / flag / ` +
          `secondary; source=${effectSource}).`,
      );
      return null;
    }
    const predicates = parseAppliesTo(raw.appliesTo, effectSource);
    if (predicates && predicates.length > 0) {
      result.appliesTo = predicates;
    }
  }

  const rawCondition = (raw as { condition?: unknown }).condition;
  if (rawCondition !== undefined) {
    // `condition` is the character-level gate (ADR-015 §3f). Only valid
    // on `secondary` and `armorQuality` targets — every other target is
    // either character-global (flag, magicAttribute, initiativeAttribute),
    // per-slot (combat, weaponQuality), pre-pipeline (primary), or set-
    // membership without a meaningful gate use case. Misplacement is a
    // parser-reject, not a silent strip.
    if (target.kind !== "secondary" && target.kind !== "armorQuality") {
      console.warn(
        `[effects] Rejecting effect: condition not accepted on target ` +
          `kind ${target.kind} (only secondary / armorQuality; ` +
          `source=${effectSource}).`,
      );
      return null;
    }
    const conditions = parseCondition(rawCondition, effectSource);
    if (conditions && conditions.length > 0) {
      result.condition = conditions;
    }
  }

  return result;
}

/**
 * Fail-fast catalog deserializer for a single reference `effects[]`
 * entry (ADR-015). Sister to `normalizeRawEffect`, which is warn-and-skip
 * for untrusted runtime `character.effects[]`; the reference catalog is
 * trusted build data, so a malformed entry is a build error — not a
 * droppable override.
 *
 *   * narrative entry (neither `target` nor `modifier`) → `null` (skip —
 *     Tier-C prose carries no engine payload).
 *   * `target` XOR `modifier` present → throw (half-authored effect).
 *   * both present but unparseable → throw (the preceding `[effects]`
 *     warning names the specific reject).
 *
 * @param raw the reference effect object.
 * @param source human-readable locator embedded verbatim in thrown errors.
 * @returns the typed effect, or `null` when the entry is pure narrative.
 */
export function deserializeEffect(
  raw: Partial<RawEffect>,
  source: string,
): ResolvedEffect | null {
  const hasTarget = raw.target !== undefined;
  const hasModifier = raw.modifier !== undefined;
  if (!hasTarget && !hasModifier) return null;
  if (hasTarget !== hasModifier) {
    throw new Error(
      `[registry] Malformed effect in ${source}: ` +
        `${hasTarget ? "target without modifier" : "modifier without target"}. ` +
        `A mechanical (Tier-A/B) effect needs both; a narrative (Tier-C) ` +
        `entry needs neither.`,
    );
  }
  const normalized = normalizeRawEffect(raw as RawEffect, source);
  if (!normalized) {
    throw new Error(
      `[registry] Unparseable effect in ${source}: target / modifier / ` +
        `predicate / condition failed validation (see the preceding ` +
        `[effects] warning for the specific reject).`,
    );
  }
  return normalized;
}

/**
 * Fail-fast catalog deserializer for a single `specialAttacks[]` /
 * `reactions[]` entry (ADR-014). The engine carries every declarative
 * field verbatim to sibling apps, which resolve them against the live
 * weapon at play time — the engine never inlines weapon stats into an
 * action. This validates the shape and copies it through. Array
 * placement (special attack vs reaction) is enforced by the caller
 * against `action.trigger`.
 *
 * @param raw the reference action object.
 * @param source human-readable locator embedded verbatim in thrown errors.
 * @param statusIds resolvable `inflicts[]` ids (from `reference/statuses`).
 * @returns the typed action, all declarative fields preserved.
 */
export function deserializeAction(
  raw: unknown,
  source: string,
  statusIds: ReadonlySet<string>,
): Action {
  if (!isPlainObject(raw)) {
    throw new Error(`[registry] Malformed action in ${source}: not an object.`);
  }
  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(
      `[registry] Action in ${source} is missing a required string 'id'.`,
    );
  }
  const name = raw.name;
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(
      `[registry] Action '${id}' in ${source} is missing a required 'name'.`,
    );
  }
  const trigger = raw.trigger;
  if (typeof trigger !== "string" || !KNOWN_TRIGGERS.has(trigger)) {
    throw new Error(
      `[registry] Action '${id}' in ${source} has unknown trigger ` +
        `${JSON.stringify(trigger)} (must be a TriggerKind, ADR-015 §5).`,
    );
  }
  const isManual = trigger === "manual";

  const isFree = raw.isFree;
  if (isFree !== undefined && typeof isFree !== "boolean") {
    throw new Error(
      `[registry] Action '${id}' in ${source}: 'isFree' must be a boolean.`,
    );
  }
  if (isFree === true && !isManual) {
    throw new Error(
      `[registry] Action '${id}' in ${source}: 'isFree' is only valid on ` +
        `trigger "manual" (ADR-014 §is-free).`,
    );
  }

  const ignoresArmor = raw.ignoresArmor;
  if (ignoresArmor !== undefined && typeof ignoresArmor !== "boolean") {
    throw new Error(
      `[registry] Action '${id}' in ${source}: 'ignoresArmor' must be a boolean.`,
    );
  }

  let appliesTo: WeaponPredicate[] | undefined;
  if (raw.appliesTo !== undefined) {
    const parsed = parseAppliesTo(raw.appliesTo, `${source} (${id})`);
    if (!parsed || parsed.length === 0) {
      throw new Error(
        `[registry] Action '${id}' in ${source}: invalid 'appliesTo' predicates.`,
      );
    }
    appliesTo = parsed;
  }

  const damageBonus = raw.damageBonus;
  if (damageBonus !== undefined) {
    if (typeof damageBonus !== "number" || !Number.isFinite(damageBonus)) {
      throw new Error(
        `[registry] Action '${id}' in ${source}: 'damageBonus' must be a finite number.`,
      );
    }
    if (!appliesTo || appliesTo.length === 0) {
      throw new Error(
        `[registry] Action '${id}' in ${source}: 'damageBonus' requires a ` +
          `non-empty 'appliesTo' (ADR-014 §inheritance-fields).`,
      );
    }
  }

  const damage = raw.damage;
  if (
    damage !== undefined &&
    (typeof damage !== "number" || !Number.isFinite(damage))
  ) {
    throw new Error(
      `[registry] Action '${id}' in ${source}: 'damage' must be a finite number.`,
    );
  }

  const attackAttribute = raw.attackAttribute;
  if (
    attackAttribute !== undefined &&
    (typeof attackAttribute !== "string" ||
      !KNOWN_PRIMARY_ATTRIBUTES.has(attackAttribute as PrimaryAttributeName))
  ) {
    throw new Error(
      `[registry] Action '${id}' in ${source}: 'attackAttribute' ` +
        `${JSON.stringify(attackAttribute)} is not a primary attribute.`,
    );
  }

  let inflicts: string[] | undefined;
  if (raw.inflicts !== undefined) {
    if (
      !Array.isArray(raw.inflicts) ||
      !raw.inflicts.every((s) => typeof s === "string")
    ) {
      throw new Error(
        `[registry] Action '${id}' in ${source}: 'inflicts' must be a string[].`,
      );
    }
    const list = raw.inflicts as string[];
    for (const statusId of list) {
      if (!statusIds.has(statusId)) {
        throw new Error(
          `[registry] Action '${id}' in ${source}: 'inflicts' references ` +
            `unknown status '${statusId}' (not in reference/statuses).`,
        );
      }
    }
    inflicts = [...list];
  }

  const description = raw.description;
  if (description !== undefined && typeof description !== "string") {
    throw new Error(
      `[registry] Action '${id}' in ${source}: 'description' must be a string.`,
    );
  }

  let effects: ResolvedEffect[] | undefined;
  if (raw.effects !== undefined) {
    if (!Array.isArray(raw.effects)) {
      throw new Error(
        `[registry] Action '${id}' in ${source}: 'effects' must be an array.`,
      );
    }
    const collected: ResolvedEffect[] = [];
    raw.effects.forEach((child, i) => {
      const eff = deserializeEffect(child, `${source} (${id}).effects[${i}]`);
      if (eff) collected.push(eff);
    });
    if (collected.length > 0) effects = collected;
  }

  // Carry every declarative field verbatim — the engine never inlines
  // weapon stats into an action; sibling apps resolve at play time.
  return {
    id,
    name,
    trigger: trigger as TriggerKind,
    ...(description !== undefined ? { description } : {}),
    ...(attackAttribute !== undefined
      ? { attackAttribute: attackAttribute as PrimaryAttributeName }
      : {}),
    ...(damage !== undefined ? { damage } : {}),
    ...(damageBonus !== undefined ? { damageBonus } : {}),
    ...(ignoresArmor !== undefined ? { ignoresArmor } : {}),
    ...(inflicts !== undefined ? { inflicts } : {}),
    ...(appliesTo !== undefined ? { appliesTo } : {}),
    ...(isFree !== undefined ? { isFree } : {}),
    ...(effects !== undefined ? { effects } : {}),
  };
}

export function collectAllEffects(
  character: {
    traits?: LearnedTrait[];
    talents?: LearnedTalent[];
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
        `[effects] Unknown trait ${trait.id}:${trait.tier} — skipped.`,
      );
      continue;
    }
    collected.push(...result.effects);
  }

  // Talents (boons / sins) → registry lookup. Same warn-and-skip policy
  // as traits: an unknown id is an authoring error the reference-lint
  // test catches at build time, so a runtime miss stays non-fatal here.
  // Level is passed through but ignored by the loader (talents contribute
  // flat top-level flags; numeric level-scaling is unimplemented).
  for (const talent of character.talents ?? []) {
    const result = registry.lookupTalent(talent.id, talent.level);
    if (!result) {
      console.warn(
        `[effects] Unknown talent ${talent.id}:${talent.level} — skipped.`,
      );
      continue;
    }
    collected.push(...result.effects);
  }

  // Manual / persistent overrides on the character itself.
  for (const raw of character.effects ?? []) {
    collectFromRaw(raw, "character.effects", collected);
  }

  // Armor-mounted effects (typed pass-through; reference catalog feeds
  // ResolvedEffect[] directly via the registry deserializer).
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
  // Unknown ids throw with the offending piece + id (ADR-016 strictness).
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

  // NB-34: drop character-level `secondary` effects that carry a weapon
  // `appliesTo` predicate. The engine has no slot-aware path for secondary
  // aggregates (defense / toughness / armor / …), so applying such a bonus
  // unconditionally would bake a sometimes-true value into the derived
  // stat (e.g. `double-strike.novice` granting +1 defense even bare-
  // handed). The predicate rides to sibling apps as documentary catalog
  // data; a UI surface is deferred (roadmap Phase 8). This is distinct
  // from the legitimate unconditional `secondary` + `setBase` path (e.g.
  // `smoke-and-mirrors.adept`), which carries no `appliesTo`.
  return collected.filter(
    (effect) =>
      !(
        effect.target.kind === "secondary" &&
        effect.appliesTo !== undefined &&
        effect.appliesTo.length > 0
      ),
  );
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
    for (const effect of quality.effects) {
      // Registry synthesis (ADR-015 §3f): for `armorQuality`-targeted
      // effects contributed by a registry quality entry, stamp an
      // implicit `armorSlot` condition so the effect only fires on the
      // carrying piece. Mirrors how weapon-mounted `Weapon.effects[]`
      // get an implicit `appliesTo` = "this weapon" in deriveCombatSlots.
      // Closes a real cross-slot leak (e.g. body-piece `Flexible` quality
      // removing `hampering_N` from the plug too).
      if (effect.target.kind === "armorQuality") {
        const stamped: ResolvedEffect = {
          ...effect,
          condition: stampArmorSlotCondition(effect.condition, piece),
        };
        out.push(stamped);
      } else {
        out.push(effect);
      }
    }
  }
}

function stampArmorSlotCondition(
  existing: ArmorCondition[] | undefined,
  piece: "body" | "plug",
): ArmorCondition[] {
  const slotCondition: ArmorCondition = {
    kind: "armorSlot",
    values: [piece],
  };
  if (!existing || existing.length === 0) return [slotCondition];
  return [...existing, slotCondition];
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
  // `primary` runs in its own pre-pipeline phase — primary
  // attributes are snapshotted into `result.attributes.primary` BEFORE
  // setBase/formula so all downstream phases see the effective values.
  if (effect.target.kind === "primary") {
    return "primary";
  }
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
    case "primary": {
      const stat = (value as { stat?: unknown }).stat;
      if (
        typeof stat !== "string" ||
        !KNOWN_PRIMARY_ATTRIBUTES.has(stat as PrimaryAttributeName)
      ) {
        console.warn(
          `[effects] Rejecting primary effect with unknown stat ${JSON.stringify(stat)} (source=${source}).`,
        );
        return null;
      }
      return { kind: "primary", stat: stat as PrimaryAttributeName };
    }
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
    case "magicAttribute":
      return { kind: "magicAttribute" };
    case "initiativeAttribute":
      return { kind: "initiativeAttribute" };
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
      if (target.kind === "primary") {
        console.warn(
          `[effects] Rejecting setBase on primary attribute (only addFlat/cap accepted, source=${source}).`,
        );
        return null;
      }
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
      if (target.kind === "primary" && type === "multiply") {
        console.warn(
          `[effects] Rejecting multiply on primary attribute (only addFlat/cap accepted, source=${source}).`,
        );
        return null;
      }
      if (target.kind === "combat" && target.field === "attackAttribute") {
        console.warn(
          `[effects] Rejecting ${type} on combat.attackAttribute (only setBase accepted, source=${source}).`,
        );
        return null;
      }
      if (
        target.kind === "magicAttribute" ||
        target.kind === "initiativeAttribute"
      ) {
        console.warn(
          `[effects] Rejecting ${type} on ${target.kind} (only setBase accepted, source=${source}).`,
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

function parseCondition(
  value: unknown,
  source: string,
): ArmorCondition[] | null {
  if (!Array.isArray(value)) {
    console.warn(`[effects] Rejecting non-array condition (source=${source}).`);
    return null;
  }
  const out: ArmorCondition[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) {
      console.warn(
        `[effects] Skipping non-object condition entry (source=${source}).`,
      );
      continue;
    }
    const kind = (entry as { kind?: unknown }).kind;
    if (typeof kind !== "string" || !KNOWN_CONDITION_KINDS.has(kind)) {
      console.warn(
        `[effects] Skipping condition entry with unknown kind ${JSON.stringify(kind)} (source=${source}).`,
      );
      continue;
    }
    if (kind === "noArmor") {
      out.push({ kind: "noArmor" });
      continue;
    }
    const values = (entry as { values?: unknown }).values;
    if (!Array.isArray(values) || !values.every((v) => typeof v === "string")) {
      console.warn(
        `[effects] Skipping condition entry without string values[] (source=${source}).`,
      );
      continue;
    }
    if (kind === "armorSlot") {
      const slots = values.filter((v): v is "body" | "plug" =>
        KNOWN_ARMOR_SLOTS.has(v),
      );
      if (slots.length === 0) {
        console.warn(
          `[effects] Skipping armorSlot condition without valid slots (source=${source}).`,
        );
        continue;
      }
      out.push({ kind: "armorSlot", values: slots });
      continue;
    }
    out.push({ kind: kind as "armorQuality" | "armorId", values });
  }
  return out;
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
