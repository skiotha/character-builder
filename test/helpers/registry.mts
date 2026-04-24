// In-memory registry stub for tests. Production code never imports this.
// See `src/rules/registry-types.mts` for interface contract and Chunk G
// for the real loader.

import type {
  AbilityTier,
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
}

export function createInMemoryRegistry(
  config: InMemoryRegistryConfig = {},
): Registry {
  const traits = config.traits ?? {};
  const talents = config.talents ?? {};

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
  };
}

export const emptyRegistry: Registry = {
  lookupTrait: () => null,
  lookupTalent: () => null,
};
