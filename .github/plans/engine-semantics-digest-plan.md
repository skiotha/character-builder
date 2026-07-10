# Engine-Semantics Digest — Scoping & Discussion Plan

> **Status:** 🗣️ Discussion — not started. Evicted from
> [`phase6-plan.md`](./phase6-plan.md) "Follow-up (post-G): canonical
> engine-semantics digest" on 2026-07-10 so it can be tackled in isolation
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

The user's core constraint: *any **breaking** change to the engine must be
represented in the digest, and vice-versa.* Two halves:

- **Engine → digest:** a breaking engine-semantics change updates the digest
  in the **same commit** (mirrors the repo's "update the comment in the same
  edit" rule).
- **Digest → engine:** a digest edit that states a new/changed system fact
  implies an engine change must follow — or the entry is marked as
  *specified-but-not-yet-built*.

Prerequisite: **define "breaking engine-semantics change."** Straw-man —
*breaking* (triggers a digest update): add/remove a primary attribute; change
a secondary's default source primary or its formula inputs; change the
`setBase` resolution policy; change tier-stacking; move the
declarative/derived line; change what's opaque (triggers/statuses); change
flag or effect-phase semantics; change the per-slot combat model. *Non-breaking*
(no digest update): internal refactor, rename, perf, added test.

**Enforcement options** (weigh automatable vs. discipline-only):

1. **Stable-anchor scheme + a lint test**, mirroring `adr-anchors.test.mts` /
   `bug-anchors.test.mts`: each digest entry gets a named anchor; code/tests/
   ADRs cite `ES-<anchor>`; a test asserts every cite resolves. Automatable,
   consistent with existing repo machinery — but only enforces *cite
   integrity*, not *content freshness*.
2. **Reciprocal-obligation entry** in a "References to sweep" style list (the
   docs-cleanup Pass E convention already used in this repo).
3. **PR / commit checklist** ("touched `src/rules/**` semantics? update the
   digest").
4. **Instructions-file discipline** (§5) — soft, agent-facing.

No test can prove the *content* is current (that's the general docs-drift
problem), so realistically it's (1)+(3)+(4): make cites lint-able, make the
obligation visible at PR time, and surface it to the agent when a rules file
is open.

---

## 7. Straw-man structure of the digest itself

Terse invariants, grouped by domain. Each entry: **the RPG-system fact** →
**the engine obligation** → **pointer to the ADR/NB that owns the mechanism**
(so the digest states *what*, the ADR owns *how*). Optional stable anchor.

- **Attributes** — the 8 primaries (5–15, budget 80); secondaries and their
  default source-primary; `setBase` re-pointing + highest-wins resolution;
  `magicAttribute` / `initiativeAttribute`.
- **Effects** — modifier verbs as *semantic operations* (not the type union);
  additive tier stacking; total phase order as a *system* guarantee;
  set-membership flags.
- **Combat** — 3 per-weapon slots, `own` slot; passives are engine-derived.
- **Actions** — declarative pass-through; siblings resolve against the live
  weapon; rewrite-by-id.
- **Triggers & statuses** — opaque tokens; engine validates membership only.
- **Talents** — flags only, no level-scaling (NB-47).
- **Out of engine** — character-state conditions (Tier C), effect lifecycle
  (`duration`), corruption cost — all sibling-side.

Format question for the session: flat invariant list vs. the grouped table
above vs. anchored entries à la ADR "Stable anchors."

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

## 10. Open questions for the isolated session

1. **Home:** hybrid git-doc + memory-pointer (recommended §4E), or one of
   A/B/C/D outright?
2. **Fate of `nagara-rpg-rules.md` memory:** retire it and replace with a
   pointer to the git digest? Repurpose it? Split (general rules vs.
   engine-contract)? It currently conflates "all three projects' rules ref"
   with "engine contract" — the digest is only the latter.
3. **Boundary with `data-contracts.md`:** what (if anything) moves out of
   data-contracts into the digest, what stays, what cross-links? (Digest =
   system facts; data-contracts = wire shapes — but today data-contracts
   carries some system prose, e.g. the new conditional-secondary / talent
   notes from Chunk G.2.)
4. **Cross-repo sharing:** siblings (addon, bot) are separate repos and can't
   read this repo's agent memory — does that settle it in favor of a git doc,
   or do we still want a shared-reference mechanism (Option C)?
5. **Anchor + lint scheme:** adopt an `ES-<anchor>` + `engine-semantics-
   anchors.test.mts` (mirroring adr/bug anchors), or keep it lint-free prose?
6. **"Breaking change" definition:** ratify the §6 straw-man list.
7. **Naming + location** of the git doc (`docs/engine-semantics.md`?).
8. **Structure:** which format from §7.

---

## 11. Not in scope here

- Authoring the actual digest content (the follow-on work, once home / shape /
  ownership are decided).
- Chunk H (validators/cleanup) and later — this slots **before** H so H's doc
  updates can target the digest if it exists by then.

## References to sweep on completion

- The [`phase6-plan.md`](./phase6-plan.md) "Follow-up (post-G): canonical
  engine-semantics digest" section now points here — collapse that pointer
  (and archive this plan to `done/`) once the digest ships and its home is
  decided.
