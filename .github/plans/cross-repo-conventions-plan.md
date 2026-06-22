# Plan — Cross-repo convention sharing

**Status:** deferred (seeded 2026-06-22). Do not execute until the sibling
projects stabilize. This is the spun-out Step 4 of
[`docs-cleanup-plan.md`](docs-cleanup-plan.md) Pass F.
**Owner:** project owner + Copilot
**Trigger:** the documentation/comment conventions codified in Pass F apply
to character-builder **and** the siblings (addon, malizia) — ideally all our
projects. character-builder is the proving ground; once the conventions
settle here, they propagate.

## Goal

Share the project-agnostic conventions bundle
(`.github/instructions/conventions.instructions.md`, built in Pass F2) into
the sibling repos so CI and non-local agents in each repo see the same
rules, without per-repo drift.

## Locked decisions (from Pass F brainstorm, 2026-06-22)

- **The bundle is the unit of sharing.** It is written project-agnostic (no
  character-builder-specific filenames); each repo's own
  `copilot-instructions.md` supplies the concrete cite targets.
- **In-repo visibility is required** — CI and non-local agents must see the
  conventions, so user-level VS Code instructions are out; the shared
  content must be committed in each repo.
- **Stabilize first, then propagate.** Sharing not-yet-settled rules
  triples the cost of every later tweak, so this waits until the bundle has
  lived in character-builder for a while.
- **Siblings may adopt a subset.** Both are barely scaffolded and have no
  `.github/bugs/` trackers; the comment-tag taxonomy, doc-graph principle,
  and plan-bookkeeping rule are universal, but the ADR-anchor and
  bug-tracker conventions only apply once a sibling has those artifacts.

## Open questions (resolve when this plan is picked up)

- **Mechanism.** Leading candidates:
  - **Vendored copies + sync script + drift-guard test** — committed copies
    in each repo; a small script propagates from a canonical source; a test
    asserts the copy matches. Matches the project's "projection/generated"
    style; no submodule ergonomics.
  - **Git submodule** — a tiny `nagara-conventions` repo pinned into each
    sibling. Git-native single source of truth; submodule ergonomics cost.
  - (Symlink / junction rejected: git-portability + agent-resolution
    fragility.)
- **Canonical home.** A dedicated `nagara-conventions` repo vs. designating
  character-builder as the home the siblings vendor from.
- **Per-sibling adoption scope.** Full bundle vs. universal subset, decided
  per sibling based on what scaffolding (ADRs, bug trackers) it has.

## References to sweep on completion

- _(none yet — this plan owns no in-code `TODO(<scope>)` sites.)_

## Done when

- The conventions bundle is present and current in addon and malizia (full
  or agreed subset); a drift-guard keeps the copies aligned; each sibling's
  `copilot-instructions.md` points at it; the chosen mechanism is documented.
