// In-memory registry stub for tests. Production code never imports this.
// See `src/rules/registry-types.mts` for the interface contract and
// `src/rules/registry.mts` (`loadRegistry`) for the production loader.

import type {
  AbilityTier,
  Quality,
  Reaction,
  ResolvedEffect,
  SpecialAttack,
} from "#rpg-types";
import type {
  Registry,
  TalentLookupResult,
  TraitLookupResult,
} from "../../src/rules/registry-types.mts";

export interface TraitFixture {
  effects?: ResolvedEffect[];
  specialAttacks?: SpecialAttack[];
  reactions?: Reaction[];
}

export interface InMemoryRegistryConfig {
  /** Keyed by `${id}:${tier}`. */
  traits?: Record<string, TraitFixture>;
  /** Keyed by `${id}:${level}`. */
  talents?: Record<string, { effects?: ResolvedEffect[] }>;
  /**
   * Keyed by quality id. Unmapped ids return `null` and the engine
   * throws (mirrors production strictness per ADR-016).
   *
   * The test default fixture (`makeTypedCharacter`) seeds the own slot
   * with a weapon carrying the `own` quality; tests that touch combat MUST
   * either spread `BASE_QUALITIES` or pass `own` explicitly. The
   * convenience pattern is `{ qualities: { ...BASE_QUALITIES, foo: ... } }`.
   */
  qualities?: Record<string, Quality>;
}

/**
 * Quality entries that every character fixture relies on. Spread into
 * any test-scoped `createInMemoryRegistry({ qualities })` call so the
 * default `natural_weapon` own-slot anchor (which carries the `own`
 * quality) doesn't trip the strict registry check.
 *
 * Keep this set MINIMAL — it only mirrors what `makeTypedCharacter`
 * itself authors. Any other quality the test references must be
 * registered explicitly.
 */
export const BASE_QUALITIES: Readonly<Record<string, Quality>> = Object.freeze({
  own: { id: "own", effects: [] },
});

export function createInMemoryRegistry(
  config: InMemoryRegistryConfig = {},
): Registry {
  const traits = config.traits ?? {};
  const talents = config.talents ?? {};
  const qualities = config.qualities ?? {};

  return {
    lookupTrait(id: string, tier: AbilityTier): TraitLookupResult | null {
      const entry = traits[`${id}:${tier}`];
      if (!entry) return null;
      return {
        effects: entry.effects ?? [],
        specialAttacks: entry.specialAttacks ?? [],
        reactions: entry.reactions ?? [],
      };
    },

    lookupTalent(id: string, level: number): TalentLookupResult | null {
      const entry = talents[`${id}:${level}`];
      if (!entry) return null;
      return { effects: entry.effects ?? [] };
    },

    /**
     * Strict: unmapped ids return `null` and the engine throws,
     * mirroring production. As a convenience, `BASE_QUALITIES`
     * (currently `{ own }`) is always treated as a fallback so the
     * default own-slot anchor in `makeTypedCharacter` doesn't crash
     * tests that didn't opt into combat at all. Tests that want to
     * exercise the "`own` is missing from the registry" path should
     * construct a `Registry` literal directly.
     */
    lookupQuality(id: string): Quality | null {
      return qualities[id] ?? BASE_QUALITIES[id] ?? null;
    },
  };
}

/**
 * Minimal-strictness default registry for tests that don't care about
 * trait/talent effects but do touch the recalc pipeline. Traits and
 * talents return null (warn-and-skip in `effects.mts`); qualities
 * resolve only for `BASE_QUALITIES` (currently just `own`). Any other
 * quality id triggers the strict-throw (ADR-016) — which is the *right*
 * production behaviour. Use `createInMemoryRegistry({ qualities: ... })`
 * when the test fixture carries additional quality ids.
 */
export const emptyRegistry: Registry = {
  lookupTrait: () => null,
  lookupTalent: () => null,
  lookupQuality: (id) => BASE_QUALITIES[id] ?? null,
};
