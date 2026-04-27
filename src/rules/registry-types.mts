// ── Registry interface (Phase 6 / Chunk C) ─────────────────────────
//
// Reference data lookup boundary. The engine queries this at recalc time
// to resolve character traits / talents into `ResolvedEffect`s and
// triggered actions.
//
// Chunk C ships only the interface and an inline empty stub in `app.mts`.
// The real loader (reading `reference/{abilities,spells,...}.{en,ru}.json`)
// lands in Chunk G. The in-memory test stub lives at
// `test/helpers/registry.mts`.
//
// Tier stacking is registry-internal: `lookupTrait(id, "master")` returns
// the union of `novice` + `adept` + `master` effects (additive, ADR-014).

import type {
  AbilityTier,
  Quality,
  Reaction,
  ResolvedEffect,
  SpecialAttack,
} from "#rpg-types";

export interface TraitLookupResult {
  effects: ResolvedEffect[];
  specialAttacks: SpecialAttack[];
  reactions: Reaction[];
}

export interface TalentLookupResult {
  effects: ResolvedEffect[];
}

export interface Registry {
  /**
   * Resolve a learned trait (ability or spell) to its tier-flattened
   * effect set. Returns `null` when the id/tier combination is unknown;
   * `collectAllEffects` warns and skips on miss in Chunk C, and Chunk G's
   * reference-lint test promotes this to a hard failure.
   */
  lookupTrait(id: string, tier: AbilityTier): TraitLookupResult | null;

  /**
   * Resolve a learned talent (boon or sin) to its effect set. Declared
   * for forward compatibility with Chunk G; **not invoked** in Chunk C
   * (see `TODO(phase6-post-G)` in `effects.mts`).
   */
  lookupTalent(id: string, level: number): TalentLookupResult | null;

  /**
   * Resolve a weapon or armor quality id to its registry entry. Returns
   * `null` when the id is not registered. Per ADR-016, the engine fans
   * out the entry's `effects[]` with implicit `appliesTo`:
   *   * weapon qualities → scoped to the carrying weapon (`buildSlot`)
   *   * armor qualities → applied globally (`collectAllEffects`)
   *
   * F.0c–F.0d: callers warn-once-per-id and skip on miss. F.0e flips
   * this to throw once the registry is populated.
   */
  lookupQuality(id: string): Quality | null;
}
