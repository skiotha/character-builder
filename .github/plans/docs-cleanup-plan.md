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

**Sub-passes (by directory; agent may resplit/combine as needed):**

- D1 — `src/rpg-types.mts` + `src/app.mts`
  - `src/rpg-types.mts` has ~6 references (RawEffect deprecation,
    combat slot comments, Action amendment fields, weapon comment).
  - `src/app.mts` has `TODO(phase6-chunk-G)` for the registry stub.
- D2 — `src/rules/*` (every module header + many inline)
  - `derived.mts`, `applicator.mts`, `effects.mts`, `attributes.mts`,
    `registry.mts`, `registry-types.mts`.
- D3 — `scripts/audit-reference.mts`
  - Full sweep: rename internal finding buckets to rule names
    (`placement`, `inflicts`, `isFree`, `inheritance`, …); rewrite
    numbered report headers to descriptive form (e.g.
    `"8. Action ids (… Item 9)"` → `"8. Action ids — rewrite group dedupe"`).
  - Functionality and readability must not regress.
- D4 — `test/**/*.test.mts` + `test/helpers/*`
  - Test file headers (`// (Phase 6 / Chunk E)` etc.) and inline
    citations (`// (Item N)`, `// Chunk J widening`, `// Chunk-C
    regression`).
  - Direct plan-file references in `test/reference-locale-drift.test.mts`
    and `test/validation.test.mts`.

**Verification per sub-pass:**
1. `npm run typecheck` clean.
2. `npm test` green.
3. Grep regression check on touched directory:
   `grep -rE 'Phase [0-9]|Chunk [A-Z]|amendment §|Item [0-9]+|\.github/plans/' <dir>`
   returns only intentional in-flight `TODO(...)` references.

**Done when:** the grep above is empty across `src/`, `scripts/`, `test/`
modulo in-flight TODOs whose plan still exists at the top level of
`.github/plans/`.

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
  - [ ] D1 — `src/rpg-types.mts` + `src/app.mts`
  - [ ] D2 — `src/rules/*`
  - [ ] D3 — `scripts/audit-reference.mts`
  - [ ] D4 — `test/**/*.test.mts` + `test/helpers/*`
- [ ] Pass E — copilot-instructions + ADR anchors + `test/adr-anchors.test.mts`
