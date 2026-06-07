# Plan — Documentation cleanup & plan-reference delooping

**Status:** active.
**Owner:** project owner + Copilot
**Trigger:** Phase 6 plans, chunks, items, and amendment sections have leaked
into ~100 code comments. Plans are short-lived; code citing them rots silently.
This plan replaces those references with citations to stable documents and
codifies the discipline going forward.

## Goals

1. Archive completed plans; keep only in-progress plans at the top level.
2. Rename and detoxify `docs/authoring-effects.md` into a stable standalone
   authoring source covering all eight reference catalogs **plus** statuses.
3. Wire the `rpg/` Obsidian vault into the docs graph as the human-readable
   companion to the JSON reference.
4. Sweep `src/`, `scripts/`, `test/` for plan/phase/chunk/item references and
   replace them with stable doc citations or inlined rule statements.
5. Codify "stable surface area" conventions in `copilot-instructions.md` and
   ADRs so this doesn't recur.

## Non-goals

- Rewriting any ADR's substantive content. Only adding a "Stable anchors"
  appendix per ADR-014 and ADR-015, and possibly converting numbered Items
  into named subsections where code cites them.
- Touching `temp/` at all (scratch area).
- Removing the bug trackers under `.github/bugs/*` — those are stable.
- Migrating data, changing engine behaviour, or fixing engine bugs.

## Locked decisions

From Ask-mode Q&A and follow-up:

- **Plans to move to `done/`:** `phase3-plan.md`, `phase4-plan.md`,
  `phase5-plan.md`, `phase6-chunkF-postpass-amendment.md`.
  `phase6-plan.md` stays at top level.
- **Doc rename:** `docs/authoring-effects.md` → `docs/reference-authoring.md`.
- **Audit script:** full sweep — rename internal finding buckets to rule
  names, rewrite numbered report headers to descriptive ones. No one
  consumes its stdout besides us; functionality and readability must not
  suffer, but otherwise free hand.
- **Module headers:** drop `(Phase 6 / Chunk X)` parentheticals; replace
  with a one-liner describing the module's role.
- **ADR-014 / ADR-015 item numbers:** convert numbered Items cited from
  code into stable named subsections (Option 2 — per-ADR "Stable anchors"
  appendix). Add a small `test/adr-anchors.test.mts` lint that scans
  `src/`, `scripts/`, `test/` for `ADR-\d+ §<name>` citations and asserts
  each resolves to an anchor in the named ADR.
- **`rpg/README.md`:** flesh out as part of pass C.
- **Pass D split:** by directory in this plan, but the agent executing
  pass D may further split or combine sub-passes if scope warrants.
- **`temp/`:** untouched.
- **Pass cadence:** A first, re-plan B–E afterwards if needed; otherwise
  proceed in order.
- **Pass B statuses placement:** insert as a new top-level section
  thematically next to Qualities (between §7 Qualities and §8 EffectTarget
  kinds), renumbering subsequent sections (Option A). Nothing outside
  `.github/plans/` cites §-numbers, so the cost is just updating in-plan
  cross-references.
- **Pass B §0.4 tier markers:** kept. Even though Chunk F shipped, the
  A/B/C marker convention still guides authors away from encoding
  non-mechanical effects.
- **Pass B §x.5 numbering:** `§8.5` / `§9.5` left as-is. Half-numbers
  signal "tangential to preceding section"; folding them in would be a
  more invasive rewrite than this pass warrants.
- **Progress tracking:** the source of truth is this on-disk file, not
  `/memories/session/plan.md`. Session memory keeps only in-flight
  scratch notes; checkbox state lives here so it survives session
  boundaries.

## Pass A — Archive completed plans

**Mechanical only. No content changes.**

Move:
- `.github/plans/phase3-plan.md` → `.github/plans/done/`
- `.github/plans/phase4-plan.md` → `.github/plans/done/`
- `.github/plans/phase5-plan.md` → `.github/plans/done/`
- `.github/plans/phase6-chunkF-postpass-amendment.md` → `.github/plans/done/`

Fix relative markdown links inside moved files where they reference
siblings that didn't move (e.g. a link to `phase6-plan.md` becomes
`../phase6-plan.md`).

**No code-comment edits in pass A.** The four existing code-side
references to `.github/plans/...` all point at files that aren't moving
(`phase6-plan.md`, `phase6-chunkF-prereqs-plan.md`), so nothing breaks.
Code-comment cleanup is pass D.

**Done when:** files are in `done/`, in-file links fixed, `npm test`
still green (no code touched, so it should be).

## Pass B — Rewrite `docs/reference-authoring.md`

Rename `docs/authoring-effects.md` → `docs/reference-authoring.md`,
detoxify temporal language, add statuses coverage, repair internal
contradictions, and wire the doc into the broader docs graph.

**B1. Rename and link audit**
1. Move `docs/authoring-effects.md` → `docs/reference-authoring.md`.
2. Update `authoring-effects.md` references in `.github/plans/phase6-plan.md`
   (4 places) and `.github/plans/done/phase6-chunkF-postpass-amendment.md`
   (~6 places).
3. `grep authoring-effects` returns zero hits.

**B2. Strip temporal framing**
1. H1: `# Authoring Spec — Reference Catalog Effects (Phase 6 / Chunk F)`
   → `# Reference Catalog Authoring Spec`.
2. Replace the lead-in (lines 3–5) with a stable intro citing
   data-contracts §1.1 and ADR-014/015/016. No `Status: active`,
   no `Drives the Chunk F bulk authoring pass`.
3. Strip per-section `Status: shipped (2026-05-19)` /
   `post-Chunk-F amendment, Item N` banners (§3 Opportunistic engine
   effects, §10 SpecialAttack/Reaction). Rules in those blockquotes
   stay; meta-status is removed.
4. Remove inline temporal markers from prose: `NEW in Chunk F`,
   `per Chunk F decision`, `After the quality registry lands (Chunk F.0)`,
   `Chunk F is expected to expand`, `TBD pending …`, and the `(Item N)`
   parentheticals in §10 subheadings.
5. §12 "Things this spec does not cover (yet)" — audit each bullet,
   drop items now covered (statuses, EffectFlag placeholder), rephrase
   forward-looking notes without chunk labels.

**B3. Repair §1 special-attack deferral contradiction**
1. "Tier-A worked example — special attack promotion" (lines 244–251)
   currently says schema is TBD and routes authors to Tier C. §10 now
   fully specifies the wire shape. Rewrite as a one-paragraph pointer
   to §10 (post-renumber: §11) with the canonical authoring shape.
2. Same for "Tier-A worked example — reaction promotion" (lines 253–257).
3. Audit §0.5's `"Reactions of any kind … always Tier C"` against §10's
   actual Reaction shape (`Action` with non-`manual` trigger) and
   reconcile — the §0.5 rule is overstated; should say "narrative
   reactions / anything gated on action economy".

**B4. Add §8 Statuses (`statuses.{en,ru}.json`) — Option A insertion**
New section between current §7 Qualities and current §8 EffectTarget
kinds. Contents:
1. Purpose — display-only metadata; engine treats statuses as opaque
   `EffectFlag` tokens (cite ADR-016).
2. Entry shape — `{id, name, description}` only; no effects, no tiers.
3. Resolution — `Action.inflicts[]` carries status ids; audit lint
   verifies every id resolves; sibling apps look up name/description
   for display.
4. Locale parity — same drift rules as other catalogs (id set + order
   frozen; only `name`/`description` may differ; lint catches drift).
5. Authoring new statuses — append to both `statuses.{en,ru}.json` in
   lockstep; if the engine needs to **react** to a status, that's a
   `flag` target, not a status-registry change.

**B5. Add universal rule §0.7 — statuses are opaque tokens**
Mirror of §0.6 for statuses: "Engine code MUST NOT branch on
`Status.name` or `Status.description`. Statuses are looked up by id
only; their text is display data for humans." Cites ADR-016.

**B6. Renumber later sections after the §8 insertion**
Current → new:
- §8 EffectTarget kinds → §9
- §8.5 Roll-time modifier passthrough → §9.5
- §9 WeaponPredicate → §10
- §9.5 condition → §10.5
- §10 SpecialAttack/Reaction → §11
- §11 Authoring workflow checklist → §12
- §12 Things this spec does not cover → §13

Update intra-doc cross-references (e.g. §1's workflow item that cites
`§7 / §8`, §0.4's reference to engine input). Also update in-plan
references in `phase6-plan.md` / `phase6-chunkF-postpass-amendment.md`
that cite §-numbers (`§10` → `§11`, `§9 / §9.5` → `§10 / §10.5`).

**B7. Add "See also" footer**
Cross-link to ADR-010 / 014 / 015 / 016, `docs/architecture.md`,
`docs/data-contracts.md`, and the `rpg/` vault.

**B8. Wire inbound links from the docs graph**
The authoring doc is currently orphaned (zero references from `docs/`,
`src/`, `test/`, `copilot-instructions.md`). Add:
1. `docs/architecture.md` — point at the new spec from the
   reference-catalog subsection.
2. `docs/data-contracts.md` §1.1 — reciprocal link (currently the
   authoring doc points back at data-contracts but not vice-versa).
3. `.github/copilot-instructions.md` — add a one-sentence pointer in
   the `reference/` paragraph.
4. ADRs 014 / 015 / 016 — each is cited from the authoring doc;
   add a "See also" line in each pointing back, so an ADR reader
   can find the practical authoring guide.

**B9. Fix the `EffectFlag` placeholder remark**
Lines 240–242: replace `"The current set is a placeholder; Chunk F is
expected to expand it"` with the current factual rule: the union is
the live engine vocabulary, append new flags in the same commit that
authors them.

**Verification**
1. `grep -rn 'authoring-effects' .github docs src test scripts public`
   → zero hits.
2. `grep -nE 'Phase [0-9]|Chunk [A-Z]|amendment|TBD|Status: \*\*(shipped|active)\*\*|Item \d+'`
   in `docs/reference-authoring.md` → zero hits.
3. `grep -n statuses docs/reference-authoring.md` → matches in catalog
   list + new §8 + `Action.inflicts[]` explainer.
4. `npm test` green.
5. Read top-to-bottom: no contradictions between §0.5 / §1 / §11.

**Done when:** all of the above pass, the doc reads as a self-contained
spec, and inbound links exist from architecture / data-contracts /
copilot-instructions / ADRs 014–016.

## Pass C — Wire `rpg/` vault into the docs graph

Replace the WIP `rpg/README.md` with a real README. Proposed sections:

1. **Purpose** — Obsidian-authored canonical rules in human language;
   companion to the machine-readable `reference/*.{en,ru}.json` and the
   authoring spec at `docs/reference-authoring.md`.
2. **Structure** — `en/` and `ru/` mirrors; `_meta/CHANGELOG.md` for
   vault edits; `.obsidian/` is vault config (not user-relevant).
3. **Relationship to JSON reference** — vault is the source of truth for
   *human-readable* rules; the JSON catalogs are the projection consumed
   by the engine and sibling apps. When they disagree, fix the JSON.
4. **Authoring workflow** — where to start when adding a new ability /
   spell / quality (Obsidian first → JSON via the authoring spec).

Cross-link from `docs/architecture.md` (RPG vault subsection),
`docs/reference-authoring.md` ("See also"), and `copilot-instructions.md`.

**Done when:** `rpg/README.md` is a meaningful README (≥30 lines);
bidirectional links exist between `rpg/` and `docs/`.

## Pass D — Code-comment delooping

The big mechanical pass. Sweep `src/`, `scripts/`, `test/`. (`temp/`
ignored.)

**Rewrite table:**

| Found in code                                | Replace with                                       |
| -------------------------------------------- | -------------------------------------------------- |
| `// ── X (Phase 6 / Chunk Y) ──`              | `// ── X — one-liner describing module role ──`    |
| `(Item N)` / `(amendment §X)`                 | Inline the rule; cite ADR §named-anchor if useful  |
| `Chunk G ships X` / `Chunk J widened Y`       | Drop temporal framing; state current behaviour     |
| `See .github/plans/phase6-plan.md`            | Replace with ADR / authoring-doc / architecture    |
| `TODO(phase6-chunk-G): ...`                   | `TODO(<topic>): ...` — name the missing capability |
| `Bug #N`                                      | Keep (bug trackers are stable identifiers)         |
| `ADR-NNN`                                     | Keep                                               |
| `ADR-NNN §named-anchor`                       | Keep (newly stable per pass E)                     |

### What counts as a stale cite

A comment / `it()` title / JSDoc cite is **stale** and must be rewritten when it:

1. Names a phase (`Phase 6`), a chunk letter (`Chunk E`, `Chunk J.3`,
   `F.0c`), an amendment section (`amendment §6`), or a numbered Item
   (`Item 11`, `post-pass Item 9`) — even just decoratively in a
   `describe`/`it` title.
2. Points at any file under `.github/plans/` (top-level or `done/`)
   from a non-`TODO` comment, *or* points at a path that has since
   moved under `done/` (broken link). Example: the JSDoc cite of
   `phase6-chunkF-prereqs-plan.md` in
   `test/reference-locale-drift.test.mts` is now a broken link — the
   plan was archived to `done/` on 2026-04-27.
3. Describes the future in temporal terms (`Chunk G ships X`, `Chunk J
   widened Y`, `lands in Chunk E`, `scheduled for removal in Chunk H`).
   Restate as current behaviour or as a conditional (`if/when X is
   added, this becomes Y`) without naming the plan that adds it.
4. Cites a sibling project's internal phase (`bot Phase 2`, `addon
   Phase 1`) from a non-`TODO` comment. Sibling-project phases are as
   temporal as ours; cite the sibling's stable doc instead
   (`bot-integration.md §N`, `addon-integration.md §N` — those are
   stable surfaces).

**Allowed exceptions (do NOT rewrite):**

- `TODO(<scope>): … Tracked in .github/plans/<file>.md` — the implementer
  removes both together when the plan ships. See the TODO convention
  below.
- `Bug #N` and `.github/bugs/*` references — bug trackers are stable.
- `ADR-NNN` and `ADR-NNN §named-anchor` — stable per Pass E.
- Historical comments that genuinely add value (`// Removed in Chunk
  C: <list of removed cases>`) **only** if they're rewritten without
  the chunk label (`// The legacy <name> suite was removed when <X>
  replaced it; see git log for the migration.`).

### Comment-tag convention

Codifying terminology so the executing agent and future readers agree:

| Tag                            | Meaning                                              | May cite open plan? |
| ------------------------------ | ---------------------------------------------------- | ------------------- |
| `TODO(<scope>): …`             | Missing capability; `<scope>` names the capability   | Yes — append `Tracked in .github/plans/<file>.md` |
| `FIXME(<scope>): …`            | Known-broken code path                               | Cite `.github/bugs/<file>.md` entry if one exists |
| `TODO(cleanup-on-<planname>):` | Non-capability comment that cites an open plan and should be revisited when that plan ships | Yes — by definition |
| `NOTE:` / plain `//` comment   | Stable explanatory prose                             | No — cite ADR / authoring doc / architecture |

The `cleanup-on-<planname>` form is new; introduce it only if Pass D
actually needs it. Bias toward rewriting the comment to a stable cite
when possible — it's the lowest-rot option.

**Reciprocal obligation on open plans (Pass E to codify):** every
active plan under `.github/plans/` should carry a "References to
sweep on completion" subsection at its end, listing the
`TODO(cleanup-on-<planname>)` / `TODO(<scope>)` sites that must be
visited when the plan ships. Empty list is fine and explicit. This
shifts the cleanup obligation from "remember to grep" to "follow the
plan's checklist".

### Cite-rewrite discipline (don't smuggle in semantics)

Mechanical cite-cleanup rewrites **citations**, not **meaning**. When
replacing a plan-cite, do not introduce new semantic claims —
words like "forbidden", "required", "deprecated", "invalid",
"must" — unless the claim is verified against the authoritative
source (the ADR + `docs/reference-authoring.md`). Reword to match the
*disposition the authority actually states*, not the name of the
plan-item you're removing.

Worked failure (D3, 2026-06-07): an audit finding bucket named
`amendmentBlockers` was renamed `forbiddenShapes` and its detail
strings reworded to "forbidden — engine inherits…". Reality-check
against [ADR-014 §inheritance-fields](done/phase6-chunkF-postpass-amendment.md)
and `reference-authoring.md` proved the opposite: innate/bespoke
attacks (Cheap Shot, Riposte, the Strangling alchemical attacks,
poisoner/hunter/skirmish reactions) **legitimately** keep hardcoded
`damage`/`attackAttribute`; only slot-bound attacks should inherit.
The section is a *review signal*, not a violations list. Corrected to
`reviewShapes` + "flagged for review". Lesson: if a rewrite makes a
catalog/codebase claim that wasn't in the original comment, stop and
verify before writing it.

### Sub-passes (revised after D-survey, 2026-05-23)

Six sub-passes. Each is one sit-down's worth of work. Rationale for
the split is in the survey notes below the table.

- **D1 — `src/rpg-types.mts` (typings module).** ~11 cites: 6
  `(Item N)` / `(amendment §N)` on Action fields, a Combat header
  ("stubbed in Chunk C, lands in Chunk E"), a `RawEffect` deprecation
  block ("Scheduled for removal in Phase 6 / Chunk H"), a weapon
  comment, and an Action ordering ADR-014 §9 cite. **Doubles as Pass E
  anchor scout**: the `(Item N)` cites here are the source list for
  ADR-014's "Stable anchors" appendix. Deliverable includes a draft
  anchor list (file in session memory or appended to this plan) that
  D2b and Pass E consume.

- **D1.5 — Orphan-TODO sweep across `src/` + `scripts/`.** One-shot
  pre-D2a audit. **Why this exists:** D1 surfaced two
  capability-gap TODOs in a single file (`TODO(rawEffect-removal)`,
  and the prose gap re: Weapon/ArmorPiece runtime structural
  validation) that were not tracked in any plan, bug tracker, or ADR.
  Both were filed in 2026-05-23 as bug entries (#34, #35) and ADR-016
  §7a was extended to record the deliberate "not yet validated"
  stance. The pattern — code comments stating "this is broken" or
  "this is a known gap" with no tracker / plan / ADR cite — is almost
  certainly present in other files too. D2a–D4b will rewrite many of
  these comments mechanically; if we don't audit *before* rewriting,
  we lose the chance to file orphans (the new comment text won't
  preserve "this needs filing" framing).
  - **Scope:** `src/**/*.mts` and `scripts/**/*.mts`. **Skip `test/`** —
    test TODOs are typically "add coverage for X" and rarely orphan
    capability gaps. **Skip `public/`** for now — client-side TODOs
    are Phase 8 territory and have their own audit window.
  - **Grep targets (case-insensitive):** `TODO\(`, `FIXME\(`,
    `// TODO\b`, `// FIXME\b`, `// XXX\b`, `// HACK\b`, `// NOTE:`
    (NOTE only when it documents a known gap, not a benign
    explanation), and standalone `@deprecated` blocks.
  - **For each hit, classify:**
    1. **Tracked** — cite present (`Tracked in .github/plans/...`,
       `See .github/bugs/...#N`, `ADR-NNN §...`). No action.
    2. **Pass D in-scope** — describes plan/chunk wording that D2a–D4b
       will rewrite. No action *yet*; D-sub-pass will handle it.
    3. **Orphan capability gap** — describes a real missing feature or
       known bug with no tracker / plan / ADR cite. **File it now**:
         - Engine bugs / design weaknesses → `engine-weak-points.md`
           (HIGH/MEDIUM/LOW/DEFERRED per severity rubric).
         - API / HTTP / validation / infra → `api-infra-bugs.md`.
         - "Decision deliberately not made yet" → consider extending
           the relevant ADR (precedent: ADR-016 §7a for catalog
           validation scope).
         - After filing, update the in-code comment to cite the new
           tracker entry (`TODO(<scope>): … Tracked in
           .github/bugs/<file>.md #N.`).
    4. **Stale / no longer applicable** — TODO references work that
       has since been done. Delete the comment.
  - **Rubric for "is this an orphan?":** if you can't grep for the
    underlying issue and find it written down somewhere stable
    (`docs/`, `.github/bugs/`, ADR, active plan), it's an orphan.
    Plan citations alone count only if the plan is still active
    (not yet archived to `done/`).
  - **Output:** updated bug trackers, updated in-code comments
    citing them, optional ADR extensions. Record findings inline in
    `/memories/session/plan.md` so D2a–D4b can revisit any item that
    fell through the grep here for any reason.
  - **Done when:** the grep set above returns only entries that fit
    categories 1 or 2.

- **D2a — Registry surface.** `src/app.mts`, `src/rules/registry.mts`,
  `src/rules/registry-types.mts`, `test/helpers/registry.mts`. All
  share one throughline ("Chunk G ships the production loader").
  **Reality-check first**: `src/models/reference.mts` already exists
  and is wired in `app.mts`; the "Chunk G future" framing may already
  be partly or fully false. Restate to match what actually ships
  today, or `TODO(<scope>):` what's still missing.

- **D2b — Engine pipeline.** `src/rules/effects.mts`,
  `src/rules/derived.mts`, `src/rules/applicator.mts`,
  `src/rules/attributes.mts`, **`src/rules/setbase.mts`** (added
  2026-05-24 after addendum sweep — was missed in the original
  scoping). ~26 cites + 2 in setbase/derived caught by the broadened
  pattern. Mostly module-header rewrites
  (`(Phase 6 / Chunk X)` → one-liner role) + inline `Item N` →
  `ADR-014 §named-anchor` using D1's anchor list. Two judgment
  calls: (a) `effects.mts`'s "Chunk G's reference-lint promotes this
  to a hard failure" appears 4×; collapse the language to a
  conditional that doesn't name the plan, (b) `attributes.mts`'s
  header describes a **live** `defense` fallback awaiting a rename —
  restate the live behaviour without chunk framing.

- **D3 — `scripts/audit-reference.mts` (full sweep, single file).**
  ~30+ cites + the `amendmentBlockers` bucket key (4 sites) + the
  report's 12 sections (6 of whose header strings carry `Item N` /
  `amendment` cites). Per the locked decision, rename finding buckets
  to rule names, rewrite header cites to stable form, drop
  `Item N`/`Chunk J.3`/`bug #34` language from comments. Section
  **numbers** 1–12 stay — only the parenthetical cites inside the
  header strings change. Reality-checked end-to-end 2026-06-07; five
  judgment calls / hazards surfaced:

  - **(a) `amendmentBlockers` rename is semantic, not just lexical.**
    The amendment shipped (now in `done/`); this bucket detects
    authoring shapes the amendment *forbade*, and its detail strings
    are written in **future tense about completed work** ("Item 1
    *will* inherit-by-default", "Item 2 *strips* per-spell"). Rename
    the bucket to `legacyShapes` / `forbiddenShapes` **and** flip the
    detail wording to present tense ("hardcoded damage/attackAttribute
    — forbidden; engine inherits from the carrying weapon"). Same
    fiction-detox pattern as D2a's "lookupTalent not invoked" and
    D2b's defense-fallback. (The `addFinding(bucket: keyof typeof
    findings, …)` signature makes the bucket-key rename type-checked —
    a missed call site is a compile error.)
  - **(b) HAZARD — runtime coupling on `/Item (\d+)/`.** Report
    section 6 groups `amendmentBlockers` findings by **regex-scraping
    the literal text "Item N" out of each finding's `detail` string**
    (`f.detail.match(/Item (\d+)/)`). The detail strings it parses are
    exactly the ones (a) rewrites. Strip the `Item N` tokens without
    fixing the grouper and **every finding collapses into the "Other"
    bucket** — a silent functional regression that neither typecheck
    nor `npm test` catches. Fix: add a structured discriminator (e.g.
    a `rule: string` field on `Finding`) and group on that instead of
    re-parsing prose. This also kills a pre-existing lexicographic-sort
    bug ("Item 1" < "Item 11" < "Item 2"). In-scope under the "free
    hand" remit — it's what makes the comment cleanup safe.
  - **(c) reality-check L472 before rewriting.** The comment "the
    parser strip-warns today and will hard-reject after J.4b" is
    **factually false now** — Item 12 already flipped strip-with-warn
    → reject-null (phase6-plan Item 12 ✅). Restate to current
    behaviour, verified against `src/rules/effects.mts` first.
  - **(d) `bug #34` ×2 (L61 file-qualified, L471 bare, both
    lowercase).** Disambiguate both to `engine-weak-points.md #34`
    and normalize casing — Pass-E.5 overlap, same as the D4a flag.
  - **(e) Item 2 anchor home.** Cite the per-spell `attackAttribute`
    strip (L896) as `ADR-015 §spell-tier-actions` (moved from ADR-014
    per 2026-06-07 decision — it's a `magicAttribute` migration,
    ADR-015 §3c), not an ADR-014 action anchor.

  Anchors D3 consumes: `§action-rewrite` / `§inheritance-fields` /
  `§inflicts` / `§is-free` (ADR-014, from D1), `§toughness-write`
  (ADR-014, Item 11), `§opportunistic-effects` (ADR-014, Item 7),
  `§placement-table` (ADR-015, per D2b), `§spell-tier-actions`
  (ADR-015, per (e)). Coins no new anchors. The parser-mirroring
  constant `Set`s (`KNOWN_*`) are legit stable source-file cites and
  **stay**. Wiring this script into `npm test` is **out of scope** —
  phase6-plan already names it the precursor to a Chunk G+
  reference-lint, tracked there.

- **D4a — Engine test suites.** Everything under `test/rules/*.mts`
  (~9 files, ~17 cites). Includes `it()` titles containing `(Item N)`
  / `(Chunk J)` — those show in test output and matter to readers.
  Title rewrites should describe the behaviour being asserted, not
  the plan item that motivated it. File-header `(Phase 6 / Chunk X)`
  banners go.

- **D4b — Top-level test + helpers + broken-link fix.**
  `test/data-contracts.test.mts`, `test/validation.test.mts`,
  `test/reference-locale-drift.test.mts`, **`test/helpers/http.mts`**
  (added 2026-05-24 — missed in original scoping; carries one
  `post-F.0e the engine throws` mile-marker cite). **Includes the
  broken-link fix** on `reference-locale-drift.test.mts:26`: rewrite
  the JSDoc cite of `phase6-chunkF-prereqs-plan.md` (now archived) to
  point at ADR-016 only — that ADR is already cited in the same
  JSDoc. Sibling-project Phase cites in `data-contracts.test.mts`
  get rewritten to cite `bot-integration.md §N` (stable surface)
  instead of "bot Phase 2" — restate, don't strip; these are
  cross-repo context, not stale-in-tree plan-cites.

### Verification per sub-pass

1. `npm run typecheck` clean.
2. `npm test` green.
3. Grep regression check on touched files using the **broadened
   pattern** (locked 2026-05-24 after D2b addendum surfaced missed
   work-package mile-markers; see closure log):
   ```
   Phase [0-9]|Chunk [A-Z]|amendment §|Item [0-9]+|\.github/plans/|phase6-|chunk[A-Z]|\bG2\.[A-Z]\b|\bF\.[0-9][a-z]?\b|\bJ\.[0-9][a-z]?\b
   ```
   returns only intentional `TODO(...)` references with their plan
   citations. The originally-scoped pattern (without the last three
   alternatives) missed `G2.[A-Z]` work-package labels, `F.0[a-z]`
   mile-markers, and `J.[0-9][a-z]?` post-sweep sub-items — all of
   which appear in test files (D4a) and were silently introduced into
   `setbase.mts` (D2b scope addition).

**D3 additionally** — the script has **zero test coverage** (`npm
test` exercises none of its runtime logic; it is a manual one-shot,
not in `package.json` scripts or CI). Typecheck *does* cover it
(`scripts/**` is in `tsconfig`), and the `findings` map is now typed
with `satisfies Record<string, Finding[]>` (was a plain annotation
that collapsed `keyof typeof findings` to `string`), so the
`amendmentBlockers` → `forbiddenShapes` bucket-key rename is genuinely
compile-checked. But the prose-coupled grouping hazard (D3 item b) is
invisible to both typecheck and tests. So: capture the **committed**
script's stdout as a baseline (`git show HEAD:scripts/audit-reference.mts`
→ temp file → run), apply the rewrite, run the working-tree version,
and diff. The diff is **NOT empty by design** — expect exactly: the 6
renamed section headers (6, 8, 9, 10, 11, 12) plus section-6 body
relabel/detox if findings exist. **Structural invariant:** no
section's finding *count* changes, no `(none)`↔findings flip, and no
`"other"` group appears in section 6. (The catalog is clean per
phase6-plan, so section 6 reads `(none)` and only its header line
diffs.) Then **empirically** exercise the grouping fix: temporarily
inject one forbidden shape into a `reference/*.json` file, run the
audit, confirm section 6 lists it under a *rule name* (not `"other"`),
then `git checkout -- reference/<file>` and confirm `git status` clean.

**Done when:** the grep above is empty across `src/`, `scripts/`,
`test/` modulo `TODO(<scope>): … Tracked in .github/plans/<file>.md`
references whose target plan still exists at the top level of
`.github/plans/` (i.e. not yet archived to `done/`).

## Pass E — Codify in copilot-instructions and ADRs

**Copilot-instructions** — add a "Documentation discipline" subsection:

> **Stable docs vs. plans.** Code comments may cite stable docs (ADRs,
> `architecture.md`, `data-contracts.md`, `reference-authoring.md`,
> `.github/bugs/*`). They must **not** cite `.github/plans/*`, phase
> names, chunk letters, or numbered amendment items. Plans live in
> `.github/plans/` and are archived to `done/` once shipped.
>
> The only allowed plan reference is inside a `TODO(...)` whose lifetime
> matches the plan's; the implementer removes the TODO and the citation
> together when the plan ships.
>
> **Comment-tag convention.**
> - `TODO(<scope>): …` — missing capability; `<scope>` names the
>   capability (not the plan). May append `Tracked in
>   .github/plans/<file>.md`.
> - `FIXME(<scope>): …` — known-broken path; cite `.github/bugs/*` if
>   tracked there.
> - `TODO(cleanup-on-<planname>): …` — non-capability comment that
>   nevertheless cites an open plan and must be revisited on the
>   plan's archival. Prefer rewriting to a stable cite when possible.
> - Plain `//` / `NOTE:` — stable explanatory prose; no plan cites.
>
> **Reciprocal plan obligation.** Every active plan under
> `.github/plans/` carries a "References to sweep on completion"
> subsection listing the code-side cites
> (`TODO(<scope>)` / `TODO(cleanup-on-<planname>)`) that must be
> visited when the plan ships. Empty list is fine and explicit. The
> plan's own "Done when" checklist gains a
> `grep -rn TODO(<scope>) src test scripts` step.
>
> **ADR sub-citations.** When citing inside an ADR, use the ADR's
> "Stable anchors" appendix (`ADR-NNN §named-anchor`). Plain heading
> numbers may be renumbered; named anchors may not. `test/adr-anchors.test.mts`
> enforces that every cited anchor resolves.

**ADRs** — append a "Stable anchors" appendix to ADR-014 and ADR-015
(the two with code citations). Convert numbered items currently
referenced from code (as discovered during pass D) into headings with
explicit anchors, e.g.:

```markdown
### Action rewrite by id {#action-rewrite}
```

Concrete anchors expected from current code:
- ADR-014: `§action-rewrite` (Item 9), `§toughness-write` (Item 11),
  `§slot-2-invariants`, `§inheritance-fields` (post-Chunk-F Item 1),
  `§inflicts` (Item 6), `§is-free` (Item 8), `§opportunistic-effects`
  (amendment Item 7).
- ADR-015: `§3a-set-membership`, `§3b-attack-attr-setbase-only`,
  `§3f-armor-conditions`, `§5-trigger-vocabulary`,
  `§placement-table` (Item 12 — moved here from ADR-014 to match the
  cite D2b already wrote in `effects.mts`; the `appliesTo`/`condition`
  accept-lists are ADR-015 §3 vocabulary, not an ADR-014 combat rule),
  `§primary-bucketing` (Item 10, ADR-015 §3 primary target kind),
  `§spell-tier-actions` (Item 2 — moved here 2026-06-07; the per-spell
  `attackAttribute` strip is a `magicAttribute` migration, ADR-015
  §3c). (Letter/section identifiers already stable; documenting them
  in the appendix freezes them.)

**Anchor lint** — add `test/adr-anchors.test.mts`:
- Scan files under `src/`, `scripts/`, `test/` for
  `ADR-(\d{3})\s+§([a-z0-9][a-z0-9-]*)`.
- For each `(ADR, anchor)` pair, read the corresponding ADR file and
  assert the anchor is listed in its "Stable anchors" appendix.
- ~30–40 lines, no new dependencies.

**Done when:** copilot-instructions has the new subsection; ADR-014 and
ADR-015 each carry a Stable anchors appendix; `npm test` green
including the new lint.

## Pass E.5 — Bug-tracking conventions (brainstorm-first)

**Status:** deferred. Do **not** start until Pass E ships. Motivated
by JC-A in Pass D2b (2026-05-24): I tried to rewrite a `Bug #34` cite
in `src/rules/effects.mts` as stale, conflating
`engine-weak-points.md #34` with `api-infra-bugs.md #34`. User caught
it: numbering is **per-file** across the two trackers, so bare
`Bug #N` cites are ambiguous and the file must be spelled out. The
fix in D2b was disambiguation only; this Pass codifies the convention
properly across the codebase and decides whether the trackers stay
split at all.

**Why brainstorm-first:** the two questions — "how should bug
tracker files be named / composed?" and "per-file or global
numbering?" — are tightly coupled. Composition decides whether the
numbering question even has two answers. We commit to a layout
first, then the numbering rule falls out.

### Composition ideas (pick one before scoping the rest of the pass)

1. **Status quo, disambiguated.** Keep `engine-weak-points.md` and
   `api-infra-bugs.md` as separate trackers; mandate that every
   in-code cite spells the file (`engine-weak-points.md #34`, never
   bare `#34`). Numbering stays per-file. Minimal disruption; lowest
   ceremony; risk that the next contributor still writes `Bug #N`.
2. **Single merged `bugs.md`.** Collapse both trackers into one file
   with global numbering. The numbering question becomes moot.
   Trade-off: loses the engine-vs-infra split that currently makes
   triage cheap (the two domains have different reviewers and
   different fix shapes).
3. **Subfolder layout `bugs/{engine,infra}.md`.** Same content split
   as today, but the path itself forces full-file cites
   (`bugs/engine.md #34`). Cleans up the cite ambiguity without
   merging domains. Cheap rename + grep sweep.
4. **By severity / urgency** (`bugs/critical.md`, `bugs/deferred.md`).
   Optimizes for "what should I work on next." Trade-off: a bug's
   severity often changes as scope is understood, so entries would
   migrate between files; that breaks stable cite ids by design.
   Probably wrong shape.
5. **By lifecycle** (`bugs/open.md`, `bugs/resolved.md`,
   `bugs/wontfix.md`). Mirrors a kanban board. Same migration
   problem as #4 — closed bugs would change file, invalidating every
   in-code cite pointing at history. Wrong shape for our cite
   pattern (we cite bugs from comments precisely to preserve
   "why" across fixes).

Leading candidates are (1) and (3). (1) costs only a convention doc +
sweep; (3) additionally costs a rename. (2) is on the table if we
decide the domain split isn't carrying its weight — worth a quick
look at how often a bug is mis-filed across the two before committing.

### Scope (once a composition is chosen)

- **Reality check first** — grep `Bug #\d+` across `src/`,
  `scripts/`, `test/`, and the ADR set; classify every hit as
  unambiguous (already spells the file), ambiguous, or wrong-file.
  Numbers from this drive the rest of the scope.
- **Cite convention.** Document the chosen form in
  `copilot-instructions.md` near the existing Bug Trackers section.
  Mirror the ADR-anchor convention: "never bare; always
  `<file>.md #N`" or "never bare; always `<path>#N`".
- **Backfill sweep.** Rewrite every ambiguous in-code cite to the
  canonical form. Touch ADRs and the trackers themselves (entries
  cross-reference each other today with the bare form).
- **Optional lint** — `test/bug-anchors.test.mts` mirroring
  `test/adr-anchors.test.mts`: grep for `Bug #\d+` patterns in
  source, assert each one matches the canonical shape. ~30 lines,
  zero deps. Worth it if the backfill sweep finds >5 hits.
- **Numbering rule** — falls out of composition. For (1)/(3),
  document per-file numbering explicitly in each tracker's header.
  For (2), renumber on merge and document global numbering. For
  (3), decide whether the rename event is also the renumber event
  (probably not — keep ids stable so historical cites resolve).

**Done when:** copilot-instructions documents the cite form;
trackers carry the numbering rule in their headers; every in-code
`Bug #N` cite uses the canonical shape; optional lint test green if
adopted; `npm test` green.

## Pass F — extract conventions into instruction files (brainstorm-first)

**Status:** deferred. Do **not** start until Pass E ships. This entry
exists only to preserve the conventions we've accumulated so they
don't get lost.

**Why a separate pass.** Passes A–E have, as a side effect, codified
several conventions that currently live only inside this plan and the
Pass E copilot-instructions snippet:

1. **Comment-tag taxonomy** — `TODO(<scope>)` / `FIXME(<scope>)` /
   `TODO(cleanup-on-<planname>)` / plain `NOTE:` (Pass D rubric).
2. **Plan bookkeeping** — every active plan under `.github/plans/`
   carries a "References to sweep on completion" subsection, empty
   at plan creation, filled as `TODO(...)` cites accrue, and folded
   into the plan's "Done when" checklist (Pass D reciprocal-obligation
   note + Pass E copilot-instructions snippet).
3. **Stable-vs-mutable doc graph** — ADRs / `docs/*.md` / `.github/bugs/*`
   are stable cite targets; `.github/plans/*` are not (Pass D
   "What counts as a stale cite" rubric).
4. **ADR stable-anchor discipline** — `ADR-NNN §named-anchor` over
   numbered headings; Stable anchors appendix; `test/adr-anchors.test.mts`
   lint (Pass E).
5. **Code-doc scale ladder** — module header / function JSDoc / inline
   `//` (already in `.github/copilot-instructions.md`; cross-referenced
   from per-language instructions in this pass).

**Brainstorm questions to answer before splitting work:**

- New `.github/instructions/bookkeeping.instructions.md` (no `applyTo`,
  always loaded) for items 1–3 — or fold into
  `.github/copilot-instructions.md` (Pass E already adds a subsection
  there)? Risk of duplication if both.
- Per-language instruction files (`hypertext.instructions.md`,
  `styling.instructions.md`, `typesctipt.instructions.md` — sic
  typo) currently say nothing about comment style. Move the JSDoc-in-
  `.mjs` requirement and the module-header rule out of
  `copilot-instructions.md` into the matching `applyTo`-scoped files?
  Pro: shorter root file, rules co-located with the code they govern.
  Con: rules then load only when the matching file is touched, so they
  miss "create new module" scenarios from scratch.
- Does any of this rise to an ADR? Probably not — ADRs record **design
  decisions about the product**, not about how we document the
  codebase. But "stable-vs-mutable doc graph" arguably *is* a design
  decision (it shapes how every future contribution cites prior art).
  Defer the ADR/no-ADR call to the brainstorm.
- Plan template: should `.github/plans/` get a `TEMPLATE.md` that
  pre-seeds the "References to sweep on completion" subsection so new
  plans start correct-by-construction? Tiny file, high payoff.

**Deliverables (tentative, refine in brainstorm):**

- One or more files under `.github/instructions/` covering the
  bookkeeping conventions above, with `applyTo` patterns chosen per
  brainstorm.
- Updates to existing per-language instruction files for any
  comment-related rules that belong there.
- Optional `.github/plans/TEMPLATE.md`.
- Optional ADR if the brainstorm concludes one is warranted.
- Update `.github/copilot-instructions.md` to point at the new
  instruction files instead of duplicating their content.

**Sequencing:** brainstorm first (one Plan-mode session, output is a
written split), then execute in one or two passes. Do not start until
Pass D and Pass E are both `[x]`.

**Done when:** the conventions enumerated above each have exactly one
canonical home in `.github/`; `.github/copilot-instructions.md` no
longer duplicates rules that belong in `instructions/`; new plans can
be scaffolded from a template (if one is chosen); 625+ tests green.

## Risks & open questions

- **Pass D scope.** Sub-pass split is by directory but the executing
  agent should feel free to re-split (e.g. `src/rules/applicator.mts`
  alone if it's heavy) or combine (D1 with D2 if context permits).
- **Anchor naming.** The list above is a starting point — actual
  anchor names get finalized in pass E based on what pass D actually
  needs. Some may turn out to be one-shot citations not worth
  promoting to anchors; inline the rule instead.
- **`scripts/audit-reference.mts` rename.** Locked decision: free hand,
  no consumer impact. Bucket names should still be greppable from the
  report output.
- **`temp/`.** Untouched per locked decision. Has stale plan references
  but is scratch.

## Resumability checklist

If this work spans multiple sessions, the next session should:

1. Read this plan top-to-bottom.
2. Read `/memories/session/plan.md` (if it exists) for in-flight pass
   notes.
3. Run the pass-D grep to see what's left:
   `grep -rE 'Phase [0-9]|Chunk [A-Z]|amendment §|Item [0-9]+|\.github/plans/' src/ scripts/ test/`
4. Continue with the next unchecked box below.

### Progress

- [x] Pass A — archive completed plans (2026-05-19; plan saved; 4 files moved; inbound links updated in `phase6-plan.md`, `copilot-instructions.md`, `docs/roadmap.md`; outbound links in moved files rewritten `../../` → `../../../`; 625 tests green)
- [x] Pass B — rewrite `docs/reference-authoring.md` (2026-05-19; renamed from `authoring-effects.md`; H1 + lead-in detoxified; nine-catalog list incl. statuses; §0.7 opaque-status rule added; §0.5 reaction overstatement softened; EffectFlag placeholder remark fixed; §1 special-attack / reaction TBD stubs rewritten to point at §11; §3 shipped banner stripped; §6 Chunk-F temporal markers removed; new §8 Statuses inserted; §8–§12 renumbered to §9–§13; §11 shipped banner + Item-N parentheticals stripped; §13 stale bullets removed; See-also footer added; inbound links wired from architecture.md / data-contracts.md / copilot-instructions.md / ADRs 014/015/016; phase6-plan + engine-weak-points §-refs updated; 625 tests green)
- [x] Pass C — wire `rpg/` vault (2026-05-22; `rpg/README.md` fleshed out with Purpose / Layout / Locales / Frontmatter / Wikilinks / Relationship to `reference/` / Authoring workflow / See also; EN+RU framed as co-equal locales with structural-parity rule and a "ru-first during WIP" carve-out; inbound links wired from `docs/architecture.md` §3.10 (also corrected stale "ru canonical" framing), `docs/reference-authoring.md` See-also footer, and `.github/copilot-instructions.md` `rpg/` bullet; 625/625 tests green)
- [ ] Pass D — code-comment delooping
  - [x] D1 — `src/rpg-types.mts` (2026-05-23; 9 cite blocks rewritten; `(ADR-014, Item 9)` → `§action-rewrite`; amendment §1.1/§1.2/"rest of Item 1" → `§inheritance-fields` with shared `TODO(weapon-inheritance)` tracking phase6-plan; amendment §6 → `§inflicts`; amendment §8 → `§is-free`; Combat header "stubbed in Chunk C / lands in Chunk E" restated as current per-slot fanout; Weapon/ArmorPiece preamble reality-checked against `src/models/reference.mts` and rewritten to current state with quality-registry-only validation note; `RawEffect` removal converted to `TODO(rawEffect-removal)` with no plan cite; draft anchor list saved to `/memories/session/plan.md`; 625/625 tests green)
  - [x] D1.5 — Orphan-TODO sweep across `src/` + `scripts/` (pre-D2a; file capability-gap TODOs into bug trackers before mechanical rewrites lose them; partial credit earned 2026-05-23: filed #34 `Weapon/ArmorPiece runtime structural validation` in `api-infra-bugs.md` DEFERRED, filed #35 `RawEffect wire shape leak` in `engine-weak-points.md` DEFERRED, extended ADR-016 §7a, updated `src/rpg-types.mts` comments to cite both. Closed 2026-05-24: grep sweep over `src/**/*.mts` + `scripts/**/*.mts` returned 14 hits / 5 real sites; net new orphan = 1, filed #36 `enforceConsistency redundancy` in `engine-weak-points.md` DEFERRED and rewrote `TODO(phase6-chunk-H?)` → `TODO(enforce-consistency-redundancy)` in `src/rules/derived.mts`; other 4 sites flagged in `/memories/session/plan.md` for D2a/D2b mechanical rewrites)
  - [x] D2a — Registry surface (`src/app.mts`, `src/rules/registry.mts`, `src/rules/registry-types.mts`, `test/helpers/registry.mts`); reality-check vs `src/models/reference.mts` first (closed 2026-05-24: renamed `TODO(phase6-chunk-G)` → `TODO(trait-talent-registry)` in `src/app.mts`; rewrote module headers to drop `Phase 6 / Chunk X` banners and stale "lands in Chunk G" framing; dropped `F.0c`/`F.0d`/`F.0e` mile-marker labels in favour of stable ADR-016 cites; rewrote `ADR-014, Item 9` → `ADR-014 §action-rewrite`; dropped dangling `TODO(phase6-post-G)` cross-ref; **discovered + corrected stale-at-original-write JSDoc claim** that `lookupTalent` is "not invoked" — `collectAllEffects` actually walks `character.talents[]` with warn-and-skip symmetric to traits; filed engine-weak-points #37 DEFERRED on `src/rules/registry.mts` re-export shim redundancy as code-organization cleanup; 625/625 tests + typecheck green; regression grep clean — 4 intentional phase6-plan cites all anchored to `TODO(trait-talent-registry)`)
  - [x] D2b — Engine pipeline (`src/rules/{effects,derived,applicator,attributes,setbase}.mts`) (closed 2026-05-24: 4 files rewritten with ~22 cite edits; dropped `Phase 6 / Chunk C|E` banner suffixes from all 4 module headers; rewrote `(ADR-014, Item 9)` → `(ADR-014 §action-rewrite)` ×3 in `derived.mts`; rewrote `(Item 10)` → `(ADR-015 §primary-bucketing)` ×3 in `applicator.mts`; dropped `(F.0e behaviour)` / `(F.0e flipped this from warn-and-skip)` / `(ADR-016, F.0e)` mile-marker labels in favour of stable `ADR-016 strictness` cites; dropped `Chunk G's reference-lint promotes this to a hard failure.` from two user-visible runtime warn-strings + adjacent comments (still flagged informatively in JSDoc); rewrote `Item 12 placement table (Chunk J, revised 2026-05-19)` block in `effects.mts` to cite `ADR-015 §3 / §placement-table`; **disambiguated bare `Bug #34` → `engine-weak-points.md #34`** per JC-A locked decision (bug cite was correct, only the file needed spelling — see memory note added 2026-05-24); reworked dangling `TODO(phase6-chunk-E)` reference to deferred equipment effects by restating that armor effects ARE handled here and weapon effects fan out per-slot via `deriveCombatSlots`; rewrote `TODO(phase6-chunk-G)` framing on talent walker to `TODO(trait-talent-registry)` block with phase6-plan cite parallel to D2a pattern; **deleted stale-at-original-write `defense`-fallback paragraph** from `attributes.mts` header — claim was fiction, verified L60-67 reads `body.armor ?? 0` with no fallback (`defense` is a separate Quick-based secondary attribute) — replaced with terse "armor sourced from `equipment.armor.body.armor` directly" note; 2 new ADR-015 anchors needed for Pass E (`§placement-table`, `§primary-bucketing`); intentional `TODO(enforce-consistency-redundancy)` block in `derived.mts` preserved untouched (cites `engine-weak-points.md`, not plans); 625/625 tests + typecheck green; regression grep clean — 1 intentional `phase6-plan.md` cite anchored to `TODO(trait-talent-registry)`. **Addendum 2026-05-24:** user spotted `(G2.B / G2.C)` in `src/rules/setbase.mts:19`; full-tree audit with broadened pattern surfaced (i) `setbase.mts` was never assigned to any D-pass (engine-pipeline scope miss), (ii) `derived.mts:282` carried the same `(G2.B / G2.C)` parenthetical that the original D2b pattern missed, (iii) `G2.[A-Z]` work-package labels, `F.0[a-z]` mile-markers, and `J.[0-9][a-z]?` post-sweep sub-items were absent from the original regression grep. Both parentheticals dropped (function names beside them convey the role; cite was pure redundancy). Verification grep pattern broadened in §"Verification per sub-pass"; D2b scope retroactively expanded to include `setbase.mts`; D4b scope expanded to include `test/helpers/http.mts` (`post-F.0e the engine throws` cite); D4a flagged for Pass-E.5 overlap (`Bug #34, Chunk J` in `test/rules/effects.test.mts:122` needs disambiguation in the same sweep). 625/625 still green post-addendum.)
  - [x] D3 — `scripts/audit-reference.mts` (bucket rename + header rewrite + comment cleanup) (closed 2026-06-07: ~26 cite edits across one file. **Phase 1 (hazard fix):** added `rule?: string` to `Finding`; replaced report section-6's `f.detail.match(/Item (\d+)/)` prose-scraping with grouping by `f.rule` (kills the collapse-to-"Other" hazard AND a latent lexicographic Item-sort bug); introduced explicit `type FindingBucket` union (not `Record<string,…>`) so a mistyped/renamed bucket key in `addFinding` is now a genuine compile error — the original plan assumed `keyof typeof findings` was already literal but the annotation was `Record<string, Finding[]>` which collapsed it to `string`. **Phase 2-3 (cites + detox):** `(ADR-014, Item 9)`→`§action-rewrite`, amendment `§1`/`§1.1`→`§inheritance-fields`, `Item 6`→`§inflicts`, `Item 8`→`§is-free`, `Item 11`→`§toughness-write`, `Item 12`→ADR-015 `§placement-table`, `Item 2`→ADR-015 `§spell-tier-actions`, `Item 7`→`§opportunistic-effects`; dropped all `Chunk J`/`J.3`/`J.4b` framing; L468 reality-checked vs `effects.mts` (parser already reject-nulls, comment said "strip-warns today" — fixed); `bug #34`→`engine-weak-points.md #34` ×2. **MID-PASS COURSE-CORRECTION:** initially renamed the bucket `amendmentBlockers`→`forbiddenShapes` and reworded details to "forbidden", but reality-check against the amendment ([Item 1](done/phase6-chunkF-postpass-amendment.md) L44-48) + [`reference-authoring.md`](../../docs/reference-authoring.md#L293) proved this a **fiction**: section 6 is a *review signal*, not a violations list — innate/bespoke attacks (Cheap Shot, Strangling, Riposte, poisoner/hunter reactions) **legitimately** keep hardcoded damage, and spell-tier `attackAttribute` is a **valid optional field**. Walked back to `reviewShapes` + neutral "flagged for review" wording across all 8 sites. **Verification:** typecheck clean; empirical grouping test (inject spell-tier `attackAttribute` → confirmed grouped under `spell-tier-actions: 1`, NOT `other`, then reverted clean); before/after stdout diff showed only the intended header/label/detox changes with all 63 finding counts unchanged; 625/625 tests; regression grep + `forbidden` residue both zero. **Section numbers 1-12 unchanged; `KNOWN_*` mirror-Sets kept.** Surfaced + filed a separate audit-logic finding (`engine-weak-points.md #38`, DEFERRED): the spell-tier `attackAttribute` audit check contradicts `reference-authoring.md` which lists it as a valid field — latent (zero live data triggers it), resolution is a small docs+lint edit, OUT of D3 (cite-cleanup) scope. **Reference-data verdict (investigated 2026-06-07 at user request):** the catalog is **healthy** — slot-bound attacks (`intrigues-backstab`, `knife-mastery-stab`) are correctly re-authored to inherit via `damageBonus`/`appliesTo`/`isFree`; the 63 `inheritance-fields` review findings are all legitimately-bespoke innate attacks (Cheap Shot, Riposte, Strangling alchemical attacks, poisoner/hunter/skirmish reactions) the amendment explicitly says keep hardcoded damage. Section 6 is a review signal working as intended, not a violation list.)
  - [ ] D4a — Engine test suites (`test/rules/*.mts`) including `it()` titles
  - [ ] D4b — Top-level test + helpers (`test/{data-contracts,validation,reference-locale-drift}.test.mts`) + fix broken-link cite of archived `phase6-chunkF-prereqs-plan.md`
- [ ] Pass E — copilot-instructions + ADR anchors + `test/adr-anchors.test.mts`
- [ ] Pass E.5 — Bug-tracking conventions (brainstorm-first, see §Pass E.5 below)
- [ ] Pass F — extract accumulated conventions into instruction files (brainstorm-first, see §Pass F below)
