// ── Derived field recalculation (Phase 6 / Chunk E) ────────────────
//
// Single entry point invoked by `models/index.mts` on every save. The
// pipeline is phase-keyed (ADR-010 / ADR-015) and consumes typed
// `ResolvedEffect`s collected from the registry + character overrides
// + armor-mounted effects.
//
// Pipeline order:
//   1. clone the input character; reset derived collections
//      (`flags`, `specialAttacks`, `reactions`) to empty so previously
//      written values can never leak across recalcs (closes Bug #31).
//   2. collect + group effects by phase
//   3. setBase  → build SecondaryAttribute → PrimaryAttribute override map
//   4. formula  → SECONDARY_FORMULAS, using the override map
//   5. addFlat  → numeric +
//   6. multiply → numeric * (rounded)
//   7. cap      → numeric min (non-combat only; combat caps are per-slot)
//   8. flag     → set membership (character.flags, armor qualities)
//   9. clamp    → toughness.current ∈ [0, toughness.max]
//   10. deriveCombatSlots — per-slot fanout: weapon predicates,
//                           setBase / addFlat / multiply / cap on
//                           `attackAttribute` / `baseDamage` /
//                           `bonusDamage`, weaponQuality add/remove,
//                           plus weapon.effects[] with implicit
//                           appliesTo = the carrying weapon.
//   11. enforceConsistency (XP guard + equipment defaulting only).

import type {
  Character,
  CombatSlot,
  PrimaryAttributeName,
  PrimaryAttributes,
  ResolvedEffect,
  Weapon,
} from "#rpg-types";
import type { Registry } from "./registry-types.mts";

import {
  applyAddFlat,
  applyCap,
  applyFlag,
  applyMultiply,
  applySetBase,
  matchesPredicates,
} from "./applicator.mts";
import { SECONDARY_FORMULAS, clampValues } from "./attributes.mts";
import { collectAllEffects, groupByPhase } from "./effects.mts";
import { resolveSetBase } from "./setbase.mts";

export function recalculate(
  character: Character,
  registry: Registry,
): Character {
  const result = structuredClone(character);

  // Always reset engine-owned collections so prior recalc output never
  // leaks into the next pass. Bug #31.
  result.flags = [];
  result.specialAttacks = [];
  result.reactions = [];
  // TODO(phase6-chunk-G/H): also reset armor.body / armor.plug overlay
  // qualities written by the previous recalc. Currently armorQuality
  // effects mutate the persisted object, which can compound across
  // recalcs. Catalog reconciliation lands in F+G; engine overlay split
  // is the cleaner fix.

  const effects = collectAllEffects(result, registry);
  const phases = groupByPhase(effects);

  // ── 0. primary ───────────────────────────────────────────────────
  // Snapshot effective primary attributes BEFORE setBase/formula so all
  // downstream stages (formula, override resolution, combat slots) read
  // post-effect values via `readPrimary`.
  derivePrimaryAttributes(result, phases.get("primary") ?? []);

  // ── 1. setBase ───────────────────────────────────────────────────
  // Collect raw setBase candidates per stat; resolution (default-
  // inclusive max-by-primary) happens in the formula phase below so we
  // can read the post-effect primary snapshot.
  const setBaseEffects = phases.get("setBase") ?? [];
  const setBaseCandidates = applySetBase(setBaseEffects);
  const primaryEffective =
    result.attributes.primaryEffective ?? result.attributes.primary;

  // ── 1a. magicAttribute / initiativeAttribute ───────────────────────
  // Both are server-derived `PrimaryAttributeName` pointers consumed by
  // sibling apps at roll time. They route through the `setBase` phase
  // (only modifier type accepted) and resolve via `resolveSetBase`
  // against the post-effect primary snapshot, with the field's default
  // included in the comparison.
  deriveMagicAttribute(result, setBaseEffects, primaryEffective);
  deriveInitiativeAttribute(result, setBaseEffects, primaryEffective);

  // ── 2. formula ───────────────────────────────────────────────────
  if (result.attributes?.secondary) {
    const secondary = result.attributes.secondary as unknown as Record<
      string,
      unknown
    >;
    for (const [stat, rule] of Object.entries(SECONDARY_FORMULAS)) {
      const list = setBaseCandidates.get(stat as never);
      const override = list
        ? resolveSetBase(rule.defaultPrimary, list, primaryEffective)
        : undefined;
      const baseValue = rule.base(result, override);
      const calculated = rule.formula(baseValue);

      if (stat === "toughness") {
        result.attributes.secondary.toughness = {
          ...result.attributes.secondary.toughness,
          max: calculated,
        };
      } else {
        secondary[stat] = calculated;
      }
    }
  }

  // ── 3-5. addFlat → multiply → cap ────────────────────────────────
  applyAddFlat(result, phases.get("addFlat") ?? []);
  applyMultiply(result, phases.get("multiply") ?? []);
  applyCap(result, phases.get("cap") ?? []);

  // ── 6. flag ──────────────────────────────────────────────────────
  applyFlag(result, phases.get("flag") ?? []);

  // ── 7. clamp ─────────────────────────────────────────────────────
  clampValues(result);

  // ── 8. deriveCombatSlots ─────────────────────────────────────────
  deriveCombatSlots(result, effects, registry, primaryEffective);

  // ── 9. enforceConsistency (trimmed) ──────────────────────────────
  enforceConsistency(result);

  return result;
}

// ── Per-slot combat fanout (ADR-014) ───────────────────────────────
//
// For each non-null carried slot:
//   1. Resolve the weapon by index. If missing or malformed, the slot
//      is left null (slots 0/1) or replaced with the synthesized
//      natural_weapon (slot 2 — required, ADR-014).
//   2. Reset derived per-slot state from the weapon (qualities cloned,
//      flags empty, attackAttribute = "accurate", baseDamage =
//      weapon.damage, bonusDamage = 0).
//   3. Build the slot-local effect set:
//        - Global effects with target.kind ∈ {combat, weaponQuality}
//          whose `appliesTo` matches this weapon (default match).
//        - Plus `weapon.effects[]` with an implicit appliesTo of "this
//          weapon" (always matches; predicates on weapon.effects are
//          honored if authored).
//   4. Apply the slot-local effects in phase order:
//        setBase → addFlat → multiply → cap → flag (weaponQuality only).

const NATURAL_WEAPON: Weapon = {
  id: "natural_weapon",
  name: "natural_weapon",
  type: "natural",
  damage: 0,
  qualities: ["own"],
};

// ── Primary attribute pre-pipeline ─────────────────────────────
//
// Snapshots the effective primary attributes by copying
// `character.attributes.primary` into `character.attributes.primaryEffective`,
// then applying `addFlat` and `cap` modifiers on the snapshot.
// `setBase`, `multiply`, and `remove` on primary targets are parser-rejected
// (ADR-015 §3e). All downstream pipeline stages (formula, override
// resolution, combat slots) read primary attributes via `readPrimary`,
// which pulls from `primaryEffective`, so writing the snapshot is enough
// to propagate effective values through the entire pipeline.
//
// `attributes.primary` is the player-authored 5–15 base and is never
// mutated by the engine; this preserves the round-trip invariant
// (save → load → recalc must not drift) and lets the UI display
// "base + bonus = effective".
function derivePrimaryAttributes(
  character: Character,
  effects: ResolvedEffect[],
): void {
  if (!character.attributes?.primary) return;
  const base = character.attributes.primary as unknown as Record<
    PrimaryAttributeName,
    number
  >;

  // Always reset: rebuild the effective snapshot from the base on every
  // recalc. This closes the same class of accumulation bug as Bug #31
  // (top-level flags / specialAttacks / reactions).
  const effective: Record<PrimaryAttributeName, number> = { ...base };
  character.attributes.primaryEffective =
    effective as unknown as PrimaryAttributes;

  // 1. addFlat accumulation.
  for (const effect of effects) {
    if (effect.target.kind !== "primary") continue;
    if (effect.modifier.type !== "addFlat") continue;
    const stat = effect.target.stat;
    effective[stat] = (effective[stat] ?? 0) + effect.modifier.value;
  }

  // 2. cap clamping (smallest cap wins per stat).
  const caps = new Map<PrimaryAttributeName, number>();
  for (const effect of effects) {
    if (effect.target.kind !== "primary") continue;
    if (effect.modifier.type !== "cap") continue;
    const stat = effect.target.stat;
    const next = effect.modifier.value;
    const prev = caps.get(stat);
    if (prev === undefined || next < prev) caps.set(stat, next);
  }
  for (const [stat, cap] of caps) {
    if (effective[stat] > cap) effective[stat] = cap;
  }
}

// ── magicAttribute / initiativeAttribute (G2.B / G2.C) ─────────────
//
// Both are reset-on-recalc to their schema default, then resolved via
// `resolveSetBase` against any `kind: "magicAttribute"` /
// `kind: "initiativeAttribute"` setBase candidates (parser enforces
// setBase-only for these target kinds). The default is included in the
// max-by-primary comparison so an unfavourable override can never lower
// the chosen attribute below the default.

const MAGIC_ATTRIBUTE_DEFAULT: PrimaryAttributeName = "resolute";
const INITIATIVE_ATTRIBUTE_DEFAULT: PrimaryAttributeName = "quick";

function deriveMagicAttribute(
  character: Character,
  setBaseEffects: ResolvedEffect[],
  primary: PrimaryAttributes,
): void {
  character.magicAttribute = MAGIC_ATTRIBUTE_DEFAULT;
  const candidates: PrimaryAttributeName[] = [];
  for (const effect of setBaseEffects) {
    if (effect.target.kind !== "magicAttribute") continue;
    if (effect.modifier.type !== "setBase") continue;
    candidates.push(effect.modifier.value);
  }
  const chosen = resolveSetBase(MAGIC_ATTRIBUTE_DEFAULT, candidates, primary);
  if (chosen) character.magicAttribute = chosen;
}

function deriveInitiativeAttribute(
  character: Character,
  setBaseEffects: ResolvedEffect[],
  primary: PrimaryAttributes,
): void {
  character.initiativeAttribute = INITIATIVE_ATTRIBUTE_DEFAULT;
  const candidates: PrimaryAttributeName[] = [];
  for (const effect of setBaseEffects) {
    if (effect.target.kind !== "initiativeAttribute") continue;
    if (effect.modifier.type !== "setBase") continue;
    candidates.push(effect.modifier.value);
  }
  const chosen = resolveSetBase(
    INITIATIVE_ATTRIBUTE_DEFAULT,
    candidates,
    primary,
  );
  if (chosen) character.initiativeAttribute = chosen;
}

function deriveCombatSlots(
  character: Character,
  globalEffects: ResolvedEffect[],
  registry: Registry,
  primary: PrimaryAttributes,
): void {
  const equipment = character.equipment;
  const weapons = (equipment?.weapons ?? []) as Weapon[];

  // Locate or synthesize the `own` weapon (slot 2 anchor).
  let ownIndex = weapons.findIndex(
    (w) => Array.isArray(w?.qualities) && w.qualities.includes("own"),
  );
  if (ownIndex === -1) {
    weapons.push({ ...NATURAL_WEAPON });
    ownIndex = weapons.length - 1;
    if (equipment) equipment.weapons = weapons;
  }

  // Pre-filter relevant effects once. Per-slot iteration then narrows
  // by `appliesTo` against the slot's weapon.
  const combatEffects = globalEffects.filter(
    (e) => e.target.kind === "combat" || e.target.kind === "weaponQuality",
  );

  const existing = character.combat?.carried;
  const slot0 = buildSlot(
    weapons,
    existing?.[0]?.weaponIndex,
    combatEffects,
    registry,
    primary,
  );
  const slot1 = buildSlot(
    weapons,
    existing?.[1]?.weaponIndex,
    combatEffects,
    registry,
    primary,
  );
  const slot2 = buildSlot(
    weapons,
    ownIndex,
    combatEffects,
    registry,
    primary,
  ) ?? {
    weaponIndex: ownIndex,
    attackAttribute: "accurate",
    baseDamage: 0,
    bonusDamage: 0,
    qualities: ["own"],
    flags: [],
  };

  character.combat = { carried: [slot0, slot1, slot2] };
}

function buildSlot(
  weapons: Weapon[],
  weaponIndex: number | undefined,
  combatEffects: ResolvedEffect[],
  registry: Registry,
  primary: PrimaryAttributes,
): CombatSlot | null {
  if (typeof weaponIndex !== "number") return null;
  const weapon = weapons[weaponIndex];
  if (!weapon) return null;

  // Reset derived state from the weapon.
  const slot: CombatSlot = {
    weaponIndex,
    attackAttribute: "accurate",
    baseDamage: weapon.damage,
    bonusDamage: 0,
    qualities: [...weapon.qualities],
    flags: [],
  };

  // Slot-local effect set.
  const local: ResolvedEffect[] = [];
  for (const effect of combatEffects) {
    if (matchesPredicates(weapon, effect.appliesTo)) local.push(effect);
  }
  // Weapon-mounted effects: implicit appliesTo = this weapon.
  // Authored predicates (if any) still apply.
  for (const effect of weapon.effects ?? []) {
    if (matchesPredicates(weapon, effect.appliesTo)) local.push(effect);
  }
  // Registry-resolved quality effects (ADR-016): each id in
  // `weapon.qualities` looks up a `Quality` entry and contributes its
  // `effects[]` to this slot. Implicit `appliesTo = this weapon`.
  // Unknown ids are a hard error — every weapon quality must be
  // registered (F.0e flipped this from warn-and-skip).
  for (const qualityId of weapon.qualities) {
    const quality = registry.lookupQuality(qualityId);
    if (!quality) {
      throw unknownWeaponQualityError(qualityId, weapon.id, weaponIndex);
    }
    for (const effect of quality.effects) local.push(effect);
  }

  applySlotPhases(slot, local, primary);
  return slot;
}

function applySlotPhases(
  slot: CombatSlot,
  effects: ResolvedEffect[],
  primary: PrimaryAttributes,
): void {
  // setBase: only `combat.attackAttribute` (parser enforces). Resolved
  // by `resolveSetBase`: slot's intrinsic `attackAttribute`
  // (currently always "accurate") is included as the default; the
  // candidate with the highest post-effect primary value wins.
  const setBaseCandidates: PrimaryAttributeName[] = [];
  for (const effect of effects) {
    if (effect.modifier.type !== "setBase") continue;
    if (effect.target.kind !== "combat") continue;
    if (effect.target.field !== "attackAttribute") continue;
    setBaseCandidates.push(effect.modifier.value as PrimaryAttributeName);
  }
  const chosen = resolveSetBase(
    slot.attackAttribute,
    setBaseCandidates,
    primary,
  );
  if (chosen) slot.attackAttribute = chosen;

  // addFlat: numeric combat fields.
  for (const effect of effects) {
    if (effect.modifier.type !== "addFlat") continue;
    if (effect.target.kind !== "combat") continue;
    applyNumericSlotField(
      slot,
      effect.target.field,
      (v) => v + (effect.modifier as { value: number }).value,
    );
  }

  // multiply: numeric combat fields.
  for (const effect of effects) {
    if (effect.modifier.type !== "multiply") continue;
    if (effect.target.kind !== "combat") continue;
    applyNumericSlotField(slot, effect.target.field, (v) =>
      Math.round(v * (effect.modifier as { value: number }).value),
    );
  }

  // cap: numeric combat fields.
  for (const effect of effects) {
    if (effect.modifier.type !== "cap") continue;
    if (effect.target.kind !== "combat") continue;
    applyNumericSlotField(slot, effect.target.field, (v) =>
      Math.min(v, (effect.modifier as { value: number }).value),
    );
  }

  // flag phase: weaponQuality add/remove (ADR-015 §3a — addFlat = add,
  // remove = remove, numeric value of addFlat ignored).
  for (const effect of effects) {
    if (effect.target.kind !== "weaponQuality") continue;
    const quality = effect.target.quality;
    if (effect.modifier.type === "remove") {
      slot.qualities = slot.qualities.filter((q) => q !== quality);
    } else if (
      effect.modifier.type === "addFlat" &&
      !slot.qualities.includes(quality)
    ) {
      slot.qualities = [...slot.qualities, quality];
    }
  }
}

function applyNumericSlotField(
  slot: CombatSlot,
  field: "attackAttribute" | "baseDamage" | "bonusDamage",
  fn: (current: number) => number,
): void {
  if (field === "baseDamage") {
    slot.baseDamage = fn(slot.baseDamage);
  } else if (field === "bonusDamage") {
    slot.bonusDamage = fn(slot.bonusDamage);
  }
  // attackAttribute is non-numeric — parser rejects arithmetic on it.
}

// ── Consistency guards (trimmed) ───────────────────────────────────
//
// Removed in Chunk C:
//   * Expired-effect prune — engine has no lifecycle.
//   * Toughness clamp — `clampValues` is now the only site.
//
// Retained:
//   * XP non-negativity guard.
//   * Equipment defaulting (so downstream code never trips on undefined).
//
// TODO(phase6-chunk-H?): reassess — much of this defaulting is also done
// at the schema/storage boundary. Once Chunk H lands, we may remove
// `enforceConsistency` entirely.

// ── Quality registry strict lookup (ADR-016, F.0e) ─────────────────
//
// Unknown quality ids are a hard error. The registry is loaded from
// `reference/qualities.<locale>.json`; every id appearing on a weapon
// or armor piece must resolve. F.0c–F.0d ran in warn-and-skip mode;
// F.0e flipped this to throw now that the registry is populated.

function unknownWeaponQualityError(
  id: string,
  weaponId: string,
  weaponIndex: number,
): Error {
  return new Error(
    `[quality-registry] Unknown weapon quality '${id}' on weapon ` +
      `'${weaponId}' (equipment.weapons[${weaponIndex}]). ` +
      `Every quality id on a weapon or armor piece must have a matching ` +
      `entry in reference/qualities.<locale>.json (ADR-016).`,
  );
}

function enforceConsistency(character: Character): void {
  if (
    character.experience &&
    typeof character.experience.unspent === "number" &&
    character.experience.unspent < 0
  ) {
    console.warn(`Negative XP for ${character.id}, resetting to 0`);
    character.experience.unspent = 0;
  }

  // Equipment defaulting.
  const equipment = (character.equipment ?? {}) as Character["equipment"];
  character.equipment = equipment;
  if (!Array.isArray(equipment.weapons)) equipment.weapons = [];
  if (!equipment.armor) equipment.armor = { body: null, plug: null };
}
