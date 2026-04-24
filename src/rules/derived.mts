// ── Derived field recalculation (Phase 6 / Chunk C) ────────────────
//
// Single entry point invoked by `models/index.mts` on every save. The
// pipeline is now phase-keyed (ADR-010 / ADR-015) and consumes typed
// `ResolvedEffect`s collected from the registry + character overrides.
//
// Pipeline order:
//   1. clone the input character
//   2. collect + group effects by phase
//   3. setBase  → build SecondaryAttribute → PrimaryAttribute override map
//   4. formula  → SECONDARY_FORMULAS, using the override map
//   5. addFlat  → numeric +
//   6. multiply → numeric * (rounded)
//   7. cap      → numeric min (non-combat only; combat caps land in Chunk E)
//   8. flag     → set membership (flags, armor/weapon qualities)
//   9. clamp    → toughness.current ∈ [0, toughness.max]
//   10. deriveCombat       (STUBBED — Chunk E lands per-slot fanout)
//   11. enforceConsistency (XP guard + equipment defaulting only;
//                           toughness clamp + expired-effect prune are
//                           gone — the engine has no lifecycle.)

import type { Character, CombatSlot, Weapon } from "#rpg-types";
import type { Registry } from "./registry-types.mts";

import {
  applyAddFlat,
  applyCap,
  applyFlag,
  applyMultiply,
  applySetBase,
} from "./applicator.mts";
import { SECONDARY_FORMULAS, clampValues } from "./attributes.mts";
import { collectAllEffects, groupByPhase } from "./effects.mts";

export function recalculate(
  character: Character,
  registry: Registry,
): Character {
  const result = structuredClone(character);

  // Ensure derived collections exist before the engine writes to them.
  if (!Array.isArray(result.flags)) result.flags = [];
  if (!Array.isArray(result.specialAttacks)) result.specialAttacks = [];
  if (!Array.isArray(result.reactions)) result.reactions = [];

  const effects = collectAllEffects(result, registry);
  const phases = groupByPhase(effects);

  // ── 1. setBase ───────────────────────────────────────────────────
  const overrides = applySetBase(phases.get("setBase") ?? []);

  // ── 2. formula ───────────────────────────────────────────────────
  if (result.attributes?.secondary) {
    const secondary = result.attributes.secondary as unknown as Record<
      string,
      unknown
    >;
    for (const [stat, rule] of Object.entries(SECONDARY_FORMULAS)) {
      const override = overrides.get(stat as never);
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

  // ── 8. deriveCombat (stub) ───────────────────────────────────────
  deriveCombat(result);

  // ── 9. enforceConsistency (trimmed) ──────────────────────────────
  enforceConsistency(result);

  return result;
}

// ── Combat (stubbed for Chunk C) ───────────────────────────────────
//
// The full per-slot combat fanout — weapon predicates, attack-attribute
// resolution, weapon quality propagation, special attack / reaction
// derivation — lands in Chunk E. Chunk C only guarantees the 3-slot
// `carried` shape exists and that slot 2 references a weapon with the
// `own` quality (synthesizing `natural_weapon` if needed, per ADR-014).

const NATURAL_WEAPON: Weapon = {
  name: "natural_weapon",
  type: "natural",
  damage: 0,
  qualities: ["own"],
};

function deriveCombat(character: Character): void {
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

  const ownSlot: CombatSlot = synthesizeSlot(weapons[ownIndex]!, ownIndex);

  // Preserve existing slot 0 / 1 only if they are well-formed CombatSlot
  // objects; otherwise reset to null. Chunk E refines this with weapon
  // predicate resolution.
  const existing = character.combat?.carried;
  const slot0 = isWellFormedSlot(existing?.[0]) ? existing[0]! : null;
  const slot1 = isWellFormedSlot(existing?.[1]) ? existing[1]! : null;

  character.combat = { carried: [slot0, slot1, ownSlot] };

  // Derived collections — engine never trusts client input here.
  character.specialAttacks = [];
  character.reactions = [];
}

function synthesizeSlot(weapon: Weapon, weaponIndex: number): CombatSlot {
  return {
    weaponIndex,
    attackAttribute: "accurate",
    baseDamage: (weapon.damage as number) ?? 0,
    bonusDamage: 0,
    qualities: [...(weapon.qualities ?? [])],
    flags: [],
  };
}

function isWellFormedSlot(value: unknown): value is CombatSlot {
  if (typeof value !== "object" || value === null) return false;
  const slot = value as Partial<CombatSlot>;
  return (
    typeof slot.weaponIndex === "number" &&
    typeof slot.attackAttribute === "string" &&
    typeof slot.baseDamage === "number" &&
    typeof slot.bonusDamage === "number" &&
    Array.isArray(slot.qualities) &&
    Array.isArray(slot.flags)
  );
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
