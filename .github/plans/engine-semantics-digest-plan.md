# Engine-Semantics Digest — Scoping & Discussion Plan

> **Status:** ✅ Scoping resolved (2026-08-03) — every §10 question is
> decided; §12 holds the implementation sequence. Authoring the digest is
> the next work item. Originally evicted from
> [`phase6-plan.md`](./phase6-plan.md) "Follow-up (post-G): canonical
> engine-semantics digest" on 2026-07-10 so it could be tackled in isolation
> after Phase 6 Chunk G, **before** Chunk H.
>
> **This is a scoping document, not the digest.** It collects the problem,
> the options, the tradeoffs, a straw-man structure, the ownership /
> enforcement question, and the open decisions — so the isolated session
> starts from a shared frame instead of a blank page. No digest content is
> authored here.

---

## 1. The problem (why this keeps coming up)

The same handful of **RPG-system facts the engine has to honor** get
reconstructed from scattered sources every time engine work happens. During
Chunk G alone the recurring ones were: `setBase` resolution (highest-valued
primary wins), the declarative-vs-derived boundary (passives = engine,
actions = declarative), conditional-secondary handling (NB-34), opaque
triggers / statuses, and the total phase order. These aren't new questions —
they're re-answered from the ADRs, `reference-authoring.md`, the plan's
cross-cutting notes, and the bug trackers each time, because **no single
place states them as the engine's contract with the RPG system.**

### 1a. Live proof the need is real — and that lockstep is the hard part

A repo memory already tries to be this digest:
[`/memories/repo/nagara-rpg-rules.md`](../../) — "Canonical rules reference
for the Nagara tabletop RPG. Used by: character-builder, nagara-addon,
malizia." It has **already drifted stale** against shipped Phase 6, which is
exactly the failure mode we're trying to prevent:

- It still describes the **pre-ADR-014 combat model** — "Dual-wield: primary
  weapon → baseDamage, secondary weapon die → bonusDamage" and weapon
  `type (heavy/light/staff/spear/ranged/unarmed)`. Superseded by the 3-slot
  per-slot fanout (ADR-014).
- "Armor qualities: light, cumbersome, mystical, reinforced" — ADR-014
  reverted armor `type`; the negative quality is a single `hampering`
  literal, and qualities are now a unified registry (ADR-016).
- "Equipment — weapons and armor can carry inline effects" — post-F.0 /
  ADR-016 the quality effects are registry-sourced; item `effects[]` are
  bespoke-only.
- It predates the whole Chunk-F/G semantic layer entirely: no `magicAttribute`
  / `initiativeAttribute`, no `primary` target, no `setBase` highest-wins
  resolution policy, no declarative-actions boundary, no NB-34 conditional-
  secondary skip, no NB-47 talent stance.

Nothing forced that memory to move when the engine moved, so it rotted. The
digest is worth little **unless the lockstep obligation is enforced** (§6).

---

## 2. What it IS and ISN'T (the scope boundary)

- **IS:** a terse, canonical statement of the **RPG-system facts the engine
  encodes and must preserve** — the contract *between the RPG system and the
  engine*. Authored **for agents** (Copilot), since that's who needs to
  reason about the engine. The one-line inclusion test:

  > *"Is this a fact about the RPG system such that, if the game designer
  > changed it, the engine would have to change too?"* If yes → digest.

- **ISN'T:**
  - Engine mechanics / data-flow / pipeline internals → ADRs +
    `docs/architecture.md`.
  - Wire shapes, field layouts, what PATCH accepts → `docs/data-contracts.md`.
  - How to author catalog entries → `docs/reference-authoring.md`.
  - Human-facing rule prose, lore, galleries → the `rpg/` Obsidian vault.

- **Illustrative contents** (from the user's framing + this session — NOT the
  final list): eight primary attributes (5–15, budget 80); secondary
  attributes are derived from primaries (with the default source-primary per
  secondary); an ability may **re-point** which primary feeds a secondary
  (`setBase`) and when several do, the highest-valued primary wins;
  attributes can be enhanced / multiplied / capped; tier stacking is additive
  (novice+adept+master); **passives are engine-computed, actions are
  declarative pass-through**; character-state conditions ("while raging") are
  out of the engine (Tier C, sibling-resolved); triggers and statuses are
  opaque tokens the engine only validates for membership; effect lifecycle
  (`duration`) is sibling-side; combat is 3 per-weapon slots (slot 2 = `own`);
  `magicAttribute` / `initiativeAttribute` are derived, `setBase`-only; flags
  are set-membership (numeric value ignored); talents contribute flags only,
  no level-scaling (NB-47).

- **Amendment (2026-08-03) — gameplay-loop context is IN:** the digest also
  carries a **brief "gameplay loop" section** — the d20 core mechanic (roll
  ≤ attribute), corruption accrual (temporary vs. permanent, learn/cast
  costs), XP earn/spend, traditions — even though those facts fail the
  engine-contract inclusion test. The doc's consumers (agents here, sibling
  repos' agents and devs) employ the rules *around* the engine's numbers;
  leaving them oblivious to how the outputs are used would bite us. Terse
  summary with pointers only — the `rpg/` vault stays canonical for rule
  prose (§6 exemption, §7 structure).

---

## 3. Landscape — where it sits (and what it must NOT duplicate)

| Artifact | Authority over | Audience | The digest's relationship |
| --- | --- | --- | --- |
| `rpg/` vault | Rule **intent** (prose, lore, galleries) | Humans | Upstream source of truth; digest distills the engine-relevant subset. |
| `reference/*.json` | Wire **data** (the catalog) | Engine + siblings | Digest never restates data; may reference vocabularies. |
| `docs/reference-authoring.md` | How to **author** catalog entries | Authors | Adjacent; digest is the *why the engine cares*, not *how to write it*. |
| `docs/data-contracts.md` | **Schema / API** wire contract | All 3 projects | Closest neighbor — boundary must be crisp (§10). Digest = system facts; data-contracts = shapes. |
| ADR-010/014/015/016 | Engine **mechanism** decisions | Engineers | Digest states the *what*; ADRs own the *how*. Digest **points**, never restates. |
| `/memories/repo/nagara-rpg-rules.md` | (attempted) general rules ref | Agent (this repo) | Overlapping + stale (§1a). Its fate is an open question (§10). |

**Duplication is the main risk.** The digest earns its keep only if it states
each fact *once* and points to the ADR/NB that owns the mechanism. If it
restates ADR-015's modifier table or data-contracts' Action shape, it becomes
a fourth thing to keep in sync — the opposite of the goal.

---

## 4. Where it should live — options & tradeoffs

The placeholder listed three; the user added a fourth (memory) and a
combination is possible.

| Option | Agent-available at the right moment | Human-reviewable (PR) | Shareable with siblings | Lint-enforceable | Staleness risk |
| --- | --- | --- | --- | --- | --- |
| **A. New git doc** (`docs/engine-semantics.md`) | needs a pointer | ✅ | ✅ (they can read this repo's docs) | ✅ | low (if enforced) |
| **B. Section in `data-contracts.md`** | needs a pointer | ✅ | ✅ | ✅ | low, but blurs the shapes-vs-facts boundary |
| **C. Cross-repo shared reference** | weakest (external) | ✅ | ✅ (by construction) | hard (no shared CI) | med — coordination cost |
| **D. Repo memory** (`/memories/repo/…`) | **strongest** (auto-loaded) | ❌ not in git, not in PRs | ❌ siblings can't read agent memory | ❌ no repo test can lint it | **high** — this is exactly how `nagara-rpg-rules.md` rotted |
| **E. Hybrid** (git doc = source of truth **+** memory pointer **+** instructions pointer) | ✅ | ✅ | ✅ | ✅ | low |

**Working recommendation: E (hybrid).** Rationale:

- The digest is a **source of truth** (canonical system facts). My own
  memory-curation rule says *source of truth → repo file; memory holds a
  pointer, not a duplicate* — and *"if it would be stale or wrong in two
  months, it does not belong in repo/user memory."* `nagara-rpg-rules.md` is
  the cautionary tale.
- It needs **human review** (breaking-change gate), **sibling sharing** (the
  addon/bot consume the same RPG contract and are separate repos that can
  read this repo's `docs/` but **cannot** read this repo's agent memory), and
  **lint enforcement** (§6) — all three demand git.
- But the user's real requirement — *"easily available to you, and you know
  where to look and at what moment"* — is a **discoverability** problem, best
  solved by a **memory pointer + an instructions file** that surface the git
  doc at the right moment (§5), not by putting the content in memory.

So: **git doc as the one source of truth; memory + instructions as signposts
to it.** The isolated session should confirm or override this.

---

## 5. "Know where to look, and when" — discoverability

Whatever the home, the agent has to be *pointed* at it at the moment engine
work starts. Candidate mechanisms (combine, don't pick one):

- **An instructions file** (`.github/instructions/engine-semantics.instructions.md`)
  with `applyTo` matching the engine (`src/rules/**`, and the engine-adjacent
  `src/rpg-types.mts`) that says "consult and keep in lockstep with
  `docs/engine-semantics.md` before changing engine semantics." This auto-
  surfaces the moment a rules file is in context.
- **A repo-memory pointer** (one line in `/memories/repo/character-builder.md`
  or a slim dedicated note): "engine-semantics contract lives at
  `docs/engine-semantics.md` — read before engine-semantics work; update it on
  breaking changes."
- **`copilot-instructions.md`** — a line under the engine/rules section.
- **Cross-links** from ADR-010/014/015/016 headers and `data-contracts.md`
  back to the digest, so arriving from any of them lands you there.

---

## 6. The lockstep obligation (the hard requirement)

> **Resolved 2026-08-03.** The original "breaking change" framing is retired
> — the term was wrong and forced a severity classification nobody could
> define. The obligation is a **rule-backed correspondence** between the
> digest and the engine, stated as three invariants.

1. **Membership (iff).** An entry belongs in the digest **iff** it is an
   engine behavior that exists *because an RPG-system rule requires it*.
   §2's inclusion test, made bidirectional — the digest is a justification
   ledger: every major engine operation must name the rule behind it. An
   engine behavior with no rule is a smell to chase; a rule with no engine
   behavior is either explicitly out-of-engine (say so) or a tracked gap.
2. **Doc → reality.** Every behavior the digest states resolves to code
   **or** to a tracked gap — a `TODO(<scope>)` or `NB-<n>`. The digest may
   lead the code (spec-first) only while the gap is tracked.
3. **Reality → doc.** Adding or changing rule-backed engine behavior updates
   the digest **in the same commit** (mirrors the repo's "update the comment
   in the same edit" rule).

What falls out for free: refactors, renames, perf work, function names, and
added tests never trip (2) or (3) — no RPG rule stands behind them — so no
breaking/non-breaking classification is ever needed.

**Exemption:** the gameplay-loop context section (§7) has no code
counterpart; invariants 1–2 do not apply to it. Its soft obligation is to
stay aligned with the `rpg/` vault when the designer changes the loop.

**Enforcement: discipline-only, by decision** (§10 Q5) — the
instructions-file signpost (§5) plus the same-commit habit (3). No lint
test; anchors are citable but unenforced, eyes-open. If a cheap automated
check is ever wanted later, the useful one is invariant 2 ("every entry
names a code path or a tracked gap"), not anchor-cite resolution.

---

## 7. Structure of the digest (resolved 2026-08-03)

Each **contract entry** is a **three-facet record** mirroring §6's
invariants, so the correspondence is auditable by eye (there is no linter):

- **Rule** — the RPG-system fact that requires the behavior (the *why*;
  later, the parked link into the `rpg/` vault).
- **Engine behavior** — what the engine must do (the *what*).
- **Where** — the code path, or the `TODO(<scope>)` / `NB-<n>` if unbuilt,
  plus the ADR that owns the mechanism.

Granularity: **one entry per rule-backed behavior, not per function.** Each
entry gets a stable anchor (§10 Q5).

Sections, in order:

- **Gameplay loop (context — first)** — brief, non-contract orientation for
  sibling consumers and agents: the d20 core mechanic (roll ≤ attribute,
  few exceptions), corruption accrual (temporary vs. permanent, learn/cast
  costs), XP earn/spend and tier costs, traditions. No **Where** facet; §6
  exemption applies; summary with pointers, `rpg/` vault stays canonical.
- **Attributes** — the 8 primaries (5–15, budget 80); secondaries and their
  default source-primary; `setBase` re-pointing + highest-wins resolution;
  `magicAttribute` / `initiativeAttribute`.
- **Pipeline order (first-class)** — the total phase order as a rule-backed
  *system* guarantee: `setBase` → formulas → `addFlat` → `multiply` → `cap`
  → flags, then the per-slot combat fanout. An *operation*, not a
  vocabulary item — the most re-derived fact in Chunk G.
- **Effects** — modifier verbs as *semantic operations* (not the type
  union); additive tier stacking; set-membership flags.
- **Combat** — 3 per-weapon slots (main-hand / off-hand / own); passives
  are engine-derived.
- **Actions** — declarative pass-through; siblings resolve against the live
  weapon; rewrite-by-id.
- **Triggers & statuses** — opaque tokens; engine validates membership only.
- **Talents** — flags only, no level-scaling (NB-47).
- **Out of engine** — behaviors the engine deliberately does *not* compute,
  and who owns them instead: character-state conditions (Tier C), effect
  lifecycle (`duration`), corruption bookkeeping — all sibling-side.

---

## 8. Ownership & maintenance

- **Owner:** the engine author (agent + user) on every breaking change,
  enforced at PR time per §6. Not a separate role — it rides the engine
  change.
- **Cadence:** same-commit-as-the-change (no batched digest sweeps — that's
  how memory rotted).
- **Periodic audit:** a lightweight reconciliation pass (the enforcement in §6
  is meant to make this rarely necessary).

---

## 9. Initial content seed (harvest, then de-stale)

When the digest is built, harvest from — and reconcile against — these,
correcting drift as found:

- `/memories/repo/nagara-rpg-rules.md` (de-stale the combat / armor / effect-
  source sections per §1a; it's the closest existing draft).
- ADR-014 (per-slot combat, declarative actions), ADR-015 (targets, modifiers,
  phases, `magic`/`init`/`primary`, §3a set-membership, §4a setBase
  resolution), ADR-016 (quality registry), ADR-010 (pipeline phases).
- `phase6-plan.md` "Cross-Cutting Notes" (a near-complete invariant list
  already).
- `docs/data-contracts.md` + `docs/reference-authoring.md` (for the boundary,
  not to copy).
- NB-34 (conditional-secondary skip), NB-47 (talent stance).

---

## 10. Open questions — resolved 2026-08-03

1. **Home:** ✅ Hybrid (§4E). Git doc is the sole source of truth. The
   **instructions file is the load-bearing signpost** — repo memory is *not*
   auto-injected into agent context, so the memory pointer is best-effort
   backup only.
2. **Fate of `nagara-rpg-rules.md` memory:** ✅ Harvest fully, then delete.
   The engine-contract subset is de-staled into contract entries; the
   non-engine subset (d20 mechanic, corruption, XP, traditions) is **not
   dropped** — it becomes the brief gameplay-loop context section (§2
   amendment). The pointer folds into `character-builder.md`'s "Phase 6"
   block; no dedicated pointer file. Delete only **after** harvest (it is a
   §9 source).
3. **Boundary with `data-contracts.md`:** ✅ Digest = system facts (*why*);
   data-contracts = wire shapes (*what the JSON looks like*); each points at
   the other. Cross-link now; migrate the stray system prose (the
   conditional-secondary NB-34 / talent-flags NB-47 notes) into the digest
   opportunistically — not a gate on shipping.
4. **Cross-repo sharing:** ✅ Settled by the git doc — siblings add pointer
   lines to this repo's `docs/rpg-engine-semantics.md` (public on GitHub).
   Option C retired.
5. **Anchor + lint scheme:** ✅ Stable anchors per the ADR house convention,
   cited as `ES §<anchor>`; **no lint test** — citable but unenforced,
   eyes-open (§6). The parked idea of linking entries to the RPG system
   stays parked; anchors keep it possible.
6. **"Breaking change" definition:** ✅ Term retired — replaced by the §6
   rule-backed correspondence invariants.
7. **Naming + location:** ✅ `docs/rpg-engine-semantics.md`; signpost
   `.github/instructions/rpg-engine-semantics.instructions.md`. This plan
   file keeps its historical name.
8. **Structure:** ✅ Per §7 — three-facet contract entries, domain sections,
   first-class pipeline-order section, gameplay-loop context up top.

---

## 11. Not in scope here

- Chunk H (validators/cleanup) and later — this slots **before** H so H's
  doc updates can target the digest if it exists by then. (Authoring the
  digest itself is no longer out of scope — it is the next work item,
  sequenced in §12.)

## 12. Implementation sequence

One chunk, ordered — steps 1–2 are the substance, 3–5 are wiring:

1. **Author `docs/rpg-engine-semantics.md`.** Harvest per §9; de-stale
   against ADR-014/015/016 and the NB trackers as §1a found. Structure per
   §7: gameplay-loop context first, then three-facet contract entries with
   stable anchors.
2. **Verification pass (invariant 2).** Walk every entry's **Where** facet:
   the code path exists (`src/rules/**`, `src/models/**`), or the gap is
   tracked as `TODO(<scope>)` / `NB-<n>`. An entry that fails becomes a
   tracked gap or is cut.
3. **Signposts.** (a) `.github/instructions/rpg-engine-semantics.instructions.md`,
   `applyTo: src/rules/**` + `src/rpg-types.mts` — consult before
   engine-semantics work; same-commit rule (§6.3). (b)
   `copilot-instructions.md`: a line under the rules-engine guidance **and**
   add the digest + its `ES §<anchor>` cite format to the "Stable cite
   targets here" binding. (c) Cross-links from ADR-010/014/015/016 headers
   and `data-contracts.md`.
4. **Memory.** Fold the pointer into `/memories/repo/character-builder.md`'s
   "Phase 6" block; delete `/memories/repo/nagara-rpg-rules.md`
   (post-harvest).
5. **Siblings + bookkeeping.** Pointer lines in nagara-addon / malizia docs
   (cross-repo, coordinated separately); collapse the `phase6-plan.md`
   follow-up pointer; archive this plan to `done/`; sweep the list below.

## References to sweep on completion

- The [`phase6-plan.md`](./phase6-plan.md) "Follow-up (post-G): canonical
  engine-semantics digest" section now points here — collapse that pointer
  (and archive this plan to `done/`) once the digest ships (§12 step 5).
