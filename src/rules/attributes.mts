// ── Secondary attribute formulas (Phase 6 / Chunk C) ───────────────
//
// Typed re-implementation of the secondary attribute base/formula table.
// `setBase` overrides are applied by `derived.recalculate` before this
// table runs; the override map is passed in here.
//
// Armor is sourced from `equipment.armor.body.armor` with a legacy
// `defense` fallback. The fallback is scheduled for removal once Chunk D
// finishes the rename. Storage was wiped in Chunk C / Phase 1, so the
// fallback should already be dead — but the canonical lint lives in
// Chunk D.

import type {
  Character,
  PrimaryAttributeName,
  SecondaryAttributeName,
} from "#rpg-types";

interface SecondaryFormulaRule {
  defaultPrimary: PrimaryAttributeName | null;
  base: (character: Character, override?: PrimaryAttributeName) => number;
  formula: (base: number) => number;
}

function readPrimary(character: Character, stat: PrimaryAttributeName): number {
  return character.attributes.primary[stat] ?? 0;
}

export const SECONDARY_FORMULAS: Record<
  SecondaryAttributeName,
  SecondaryFormulaRule
> = {
  toughness: {
    defaultPrimary: "strong",
    base: (char, override) => readPrimary(char, override ?? "strong"),
    formula: (base) => Math.max(base, 10),
  },
  painThreshold: {
    defaultPrimary: "strong",
    base: (char, override) => readPrimary(char, override ?? "strong"),
    formula: (base) => Math.ceil(base * 0.5),
  },
  corruptionThreshold: {
    defaultPrimary: "resolute",
    base: (char, override) => readPrimary(char, override ?? "resolute"),
    formula: (base) => Math.ceil(base * 0.5),
  },
  defense: {
    defaultPrimary: "quick",
    base: (char, override) => readPrimary(char, override ?? "quick"),
    formula: (base) => base,
  },
  armor: {
    defaultPrimary: null,
    base: (char) => {
      const body = char.equipment?.armor?.body;
      if (!body) return 0;
      return body.armor ?? 0;
    },
    formula: (base) => base,
  },
  corruptionMax: {
    defaultPrimary: "resolute",
    base: (char, override) => readPrimary(char, override ?? "resolute"),
    formula: (base) => base,
  },
};

/**
 * Clamp `toughness.current` into `[0, toughness.max]`. Called once at the
 * very end of `recalculate` — this is now the **only** site that touches
 * toughness bounds (legacy `enforceConsistency` clamp removed).
 */
export function clampValues(character: Character): void {
  const toughness = character.attributes?.secondary?.toughness;
  if (!toughness) return;
  toughness.current = Math.max(0, Math.min(toughness.current, toughness.max));
}
