// ── Reference data registry (re-export shim) ───────────────────────
//
// The interface contract and types live in `./registry-types.mts`.
// Production wiring (inline stub + quality-catalog loader) lives in
// `src/app.mts`; the in-memory test stub lives in
// `test/helpers/registry.mts`. A full production loader for
// traits/talents is tracked under `TODO(trait-talent-registry)` in
// `src/app.mts` / `.github/plans/phase6-plan.md`. See ADR-015 for
// effect targeting and ADR-016 for the quality registry.

export type {
  Registry,
  TraitLookupResult,
  TalentLookupResult,
} from "./registry-types.mts";
