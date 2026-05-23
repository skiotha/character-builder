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
  `src/rules/attributes.mts`. ~26 cites. Mostly module-header rewrites
  (`(Phase 6 / Chunk X)` → one-liner role) + inline `Item N` →
  `ADR-014 §named-anchor` using D1's anchor list. Two judgment
  calls: (a) `effects.mts`'s "Chunk G's reference-lint promotes this
  to a hard failure" appears 4×; collapse the language to a
  conditional that doesn't name the plan, (b) `attributes.mts`'s
  header describes a **live** `defense` fallback awaiting a rename —
  restate the live behaviour without chunk framing.

- **D3 — `scripts/audit-reference.mts` (full sweep, single file).**
  ~30+ cites + the `amendmentBlockers` bucket key (4 sites) + 6
  numbered report headers. Per the locked decision, rename buckets to
  rule names (`placement`, `inflicts`, `isFree`, `inheritance`, …),
  rewrite headers to descriptive form, drop `Item N`/`Chunk J.3`
  language from comments. Functionality and readability must not
  regress; bucket names must still be greppable from the report
  output.

- **D4a — Engine test suites.** Everything under `test/rules/*.mts`
  (~9 files, ~17 cites). Includes `it()` titles containing `(Item N)`
  / `(Chunk J)` — those show in test output and matter to readers.
  Title rewrites should describe the behaviour being asserted, not
  the plan item that motivated it. File-header `(Phase 6 / Chunk X)`
  banners go.

- **D4b — Top-level test + helpers + broken-link fix.**
  `test/data-contracts.test.mts`, `test/validation.test.mts`,
  `test/reference-locale-drift.test.mts`. **Includes the broken-link
  fix** on `reference-locale-drift.test.mts:26`: rewrite the JSDoc
  cite of `phase6-chunkF-prereqs-plan.md` (now archived) to point at
  ADR-016 only — that ADR is already cited in the same JSDoc.
  Sibling-project Phase cites in `data-contracts.test.mts` get
  rewritten to cite `bot-integration.md §N` (stable surface) instead
  of "bot Phase 2".

### Verification per sub-pass

1. `npm run typecheck` clean.
2. `npm test` green.
3. Grep regression check on touched files:
   `grep -rE 'Phase [0-9]|Chunk [A-Z]|amendment §|Item [0-9]+|\.github/plans/' <files>`
   returns only intentional `TODO(...)` references with their plan
   citations.

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
  `§slot-2-invariants`, `§spell-tier-actions`, `§inheritance-fields`
  (post-Chunk-F Item 1), `§placement-table` (Item 12),
  `§inflicts` (Item 6), `§is-free` (Item 8), `§opportunistic-effects`
  (amendment Item 7).
- ADR-015: `§3a-set-membership`, `§3b-attack-attr-setbase-only`,
  `§3f-armor-conditions`, `§5-trigger-vocabulary`. (Letter/section
  identifiers already stable; documenting them in the appendix freezes
  them.)

**Anchor lint** — add `test/adr-anchors.test.mts`:
- Scan files under `src/`, `scripts/`, `test/` for
  `ADR-(\d{3})\s+§([a-z0-9][a-z0-9-]*)`.
- For each `(ADR, anchor)` pair, read the corresponding ADR file and
  assert the anchor is listed in its "Stable anchors" appendix.
- ~30–40 lines, no new dependencies.

**Done when:** copilot-instructions has the new subsection; ADR-014 and
ADR-015 each carry a Stable anchors appendix; `npm test` green
including the new lint.

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
  - [ ] D1.5 — Orphan-TODO sweep across `src/` + `scripts/` (pre-D2a; file capability-gap TODOs into bug trackers before mechanical rewrites lose them; partial credit already earned 2026-05-23: filed #34 `Weapon/ArmorPiece runtime structural validation` in `api-infra-bugs.md` DEFERRED, filed #35 `RawEffect wire shape leak` in `engine-weak-points.md` DEFERRED, extended ADR-016 §7a, updated `src/rpg-types.mts` comments to cite both)
  - [ ] D2a — Registry surface (`src/app.mts`, `src/rules/registry.mts`, `src/rules/registry-types.mts`, `test/helpers/registry.mts`); reality-check vs `src/models/reference.mts` first
  - [ ] D2b — Engine pipeline (`src/rules/{effects,derived,applicator,attributes}.mts`)
  - [ ] D3 — `scripts/audit-reference.mts` (bucket rename + header rewrite + comment cleanup)
  - [ ] D4a — Engine test suites (`test/rules/*.mts`) including `it()` titles
  - [ ] D4b — Top-level test + helpers (`test/{data-contracts,validation,reference-locale-drift}.test.mts`) + fix broken-link cite of archived `phase6-chunkF-prereqs-plan.md`
- [ ] Pass E — copilot-instructions + ADR anchors + `test/adr-anchors.test.mts`
- [ ] Pass F — extract accumulated conventions into instruction files (brainstorm-first, see §Pass F below)
