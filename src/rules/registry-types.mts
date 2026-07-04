// ── Registry interface ─────────────────────────────────────────────
//
// Reference data lookup boundary. The engine queries this at recalc time
// to resolve character traits / talents into `ResolvedEffect`s and
// triggered actions.
//
// Production wiring lives in `src/rules/registry.mts` (`loadRegistry`,
// wired at startup in `src/app.mts`); the in-memory test stub lives at
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
  /**
   * Special attacks granted by this trait at the queried tier.
   *
   * **Ordering contract (ADR-014 §action-rewrite):** entries MUST
   * appear in tier-ascending order — `novice` first, then `adept`,
   * then `master`. The engine collection step (`collectActions` in
   * `derived.mts`) relies on this order for last-write-wins dedupe by
   * `Action.id`, so a master-tier rewrite of a same-id entry replaces
   * the lower tier's version. The in-memory test stub and the future
   * production loader both produce arrays in this order; do not re-sort.
   */
  specialAttacks: SpecialAttack[];
  /** Reactions granted at the queried tier. Same ordering contract as `specialAttacks`. */
  reactions: Reaction[];
}

export interface TalentLookupResult {
  effects: ResolvedEffect[];
}

export interface Registry {
  /**
   * Resolve a learned trait (ability or spell) to its tier-flattened
   * effect set. Returns `null` when the id is unknown; `collectAllEffects`
   * warns and skips on miss. The reference-lint test catches unknown
   * authored trait ids at build time.
   */
  lookupTrait(id: string, tier: AbilityTier): TraitLookupResult | null;

  /**
   * Resolve a learned talent (boon or sin) to its effect set. Returns
   * `null` when the id is unknown; `collectAllEffects` warns and skips
   * on miss (symmetric to `lookupTrait`). Level is ignored — talents
   * contribute set-membership flags; numeric level-scaling is
   * unimplemented.
   */
  lookupTalent(id: string, level: number): TalentLookupResult | null;

  /**
   * Resolve a weapon or armor quality id to its registry entry. Returns
   * `null` when the id is not registered. Per ADR-016, the engine fans
   * out the entry's `effects[]` with implicit `appliesTo`:
   *   * weapon qualities → scoped to the carrying weapon (`buildSlot`)
   *   * armor qualities → applied globally (`collectAllEffects`)
   *
   * Unknown ids throw (ADR-016 strictness).
   */
  lookupQuality(id: string): Quality | null;
}
