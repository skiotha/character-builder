// ── Reference data registry ─────────────────────────────────────────
//
// The real loader (reading `reference/{abilities,spells,...}.{en,ru}.json`)
// lands in **Phase 6 / Chunk G**. Chunk C ships only the interface
// (`./registry-types.mts`) and an inline empty stub in `src/app.mts`.
//
// See `.github/plans/phase6-plan.md` and ADR-015.

export type {
  Registry,
  TraitLookupResult,
  TalentLookupResult,
} from "./registry-types.mts";
