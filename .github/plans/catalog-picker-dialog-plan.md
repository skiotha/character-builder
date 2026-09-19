# Plan — Catalog picker dialog: traits & talents (XP, traditions, creation parity)

**Status:** active (2026-09-19) — direction agreed with the user; the
second-opinion follow-ups and the XP-transition decision gate below remain
open for step planning. Nothing implemented yet. Blocks
[`phase6-chunkI-plan.md`](./phase6-chunkI-plan.md) step 3, which is now a
pointer here.
**Owner:** user (design authority + catalog authoring) + agent
(implementation)
**Session note:** every step from 1 on is executed in a fresh agent session
with no memory of this one — this file, the Figma frames named below, the
docs it cites and the **ui-navigation-playbook** rule are the complete
hand-off. Keep this file current as steps land (✅ divergence blockquotes
under each step, same as the Chunk I plan).
**Trigger:** The Chunk I step-3 readiness review (2026-09-19) found that
"traits & talents pickers" is not a one-step job. Traits and talents need
different UX (tiered abilities/spells with rich previews vs. levelled
boons/sins), the Figma design calls for a **popup picker** (search, filter,
preview) rather than an inline `<select>`, and every mechanism the popup
depends on is missing: there is no dialog primitive, XP is never modelled,
`traditions[]` has an ambiguous contract, the catalogs lack the fields the
cards display, and the creation form has no seam for staged picks.
Building all of that inside Chunk I would swallow the chunk; this plan
does it once, properly, and hands Chunk I a finished picker.

## Findings (verified 2026-09-19, nothing modified)

- **Dialog:** `public/components/modal.mjs` is empty; `public/index.html`
  ships a legacy unused `<dialog id="modal">`. No component opens a dialog.
- **Dead controls:** `trait-list.mjs` renders `button[data-action="trait-add"]`,
  `talent-list.mjs` renders `talent-add` / `update-talent-level` — none has
  a handler. Both components are display-only; `trait-list` fetches the
  catalog through a module-scope `ensureLibrary()` at `navigator.language`
  (not `CATALOG_LOCALE`, violating Chunk I decision 9).
- **API client:** `api.getTraits()` exists but is not locale-pinned; there is
  **no** `api.getTalents()`.
- **Catalogs** (`reference/abilities` 76 / `spells` 49 / `boons` 51 /
  `sins` 17 / `rituals` 68): entry keys `id,name,category,description,tags,
  tiers|levels`; tier keys `description,effects,reactions,specialAttacks`;
  effects never carry `name`; 50 `specialAttacks` + 62 `reactions` across 53
  entries; only ~6 talents have effects. **Absent:** any compact summary,
  starting-equipment, structured tradition, creation-availability. The 8
  tradition abilities are `mystical-tradition-*`; `mystical-powers` is a
  placeholder (0 stored characters reference it). Spell `tags` carry
  tradition keys (`sorcery, circle, theurgy, order, tribe, sirens,
  symbolism, runes, witchcraft`) that do **not** match the ability ids
  (`witches-circle`, `rune-magic`; no `witchcraft` ability).
- **Primary-raising abilities:** exactly the 8 `exceptional-attribute-*`
  entries, each `{kind:"primary", stat}` `addFlat +1` per tier — so the
  Figma "enhanced-attribute" card line is fully derivable from effects.
- **Schema** (`src/models/character.mts`): `traits` / `talents` are player
  arrays with `component` overrides; `traditions` is a hidden player-writable
  array validated by `checkTraditions` (curated ability ids) — but nothing
  writes it and the sibling docs describe it as "tradition name strings".
  `experience.total` (hidden, min 50) / `experience.unspent` (min 0, shown as
  "EXP" on the character card) exist, but catalog purchases do not adjust
  them.
- **NB-51:** fresh characters omit array fields entirely
  (`generateDefaultCharacter` only seeds `field.default`).
- **Creation view:** `collectFormData(form)` by `field.name`; the portrait is
  staged and read at submit via
  `form.querySelector("nagara-portrait")?.getPortraitData()` — the seam for
  staged pickers. `handleCreateCharacter` already runs `validateCatalogRefs`
  on the payload.
- **Vault rules** (`rpg/ru/01-core`): ability/spell tiers cost 10 / +20 /
  +30 XP (cumulative 10 / 30 / 60); spells are acquired like abilities;
  boons cost 5 XP per level; sins **grant** 5 XP per level; rituals are free
  and untiered; creation budget is 50 XP (covering "5 novice" and
  "2 novice + 1 adept"). Budget alone does not define creation
  eligibility: master-tier traits remain forbidden even after sin grants
  raise the budget (decision 15). Some
  faction / profession abilities are not available at creation; the italic
  word opening a rank text in the vault is its check attribute, but that
  markup is absent from the English catalog descriptions (review follow-up 5).
- **Figma** (`fileKey` `n61wtRUXEaxhSc2gnL640J`): popup `1166:237`
  `ability-select-popup` — title, stacked ability cards (name /
  starting-equipment / enhanced-attribute / description / three rank
  texts), vertical divider, right column with search ("…filter mystical
  powers") and a **recall** area ("remember abilities and recall them to
  compare"), CANCEL action. Panel `1017:14` — "Abilities" + unspent XP
  (`15`), compact cards (Equipment / Stats lines, N/A/M line), big yellow
  plus = vacant card, yellow line = horizontal scrollbar.

## Decisions locked (2026-09-19, with the user)

1. **One prerequisite plan, iterated.** Traits and talents share one
   dialog primitive but ship as separate steps; Chunk I step 3 becomes a
   pointer to this plan and flips when it closes.
2. **XP is client arithmetic, with server non-negativity checks.** The
  client computes the
   cost delta from rule constants (`public/utils/xp.mjs`) and sends
   `experience.unspent` (and `experience.total` for sins) **in the same
   atomic PATCH** as the `traits` / `talents` change. The server's existing
  `min: 0` on `unspent` rejects negative submitted balances with 422;
  it does **not** detect stale balances or prove correct charging.
  Client-side pricing remains the ADR-003 trusted-posture choice; the
  concurrency policy is reassessed under review follow-up 2. Sins add
  `+5 × level` to **both** `total` and `unspent`. Refunds are symmetric
  on downgrade / remove for **traits only** (abilities and spells),
  subject to the existing-character policy locked at step 2½. Talents
  are not refundable (decision 9).
3. **`traditions[]` becomes engine-derived.** The engine fills it at recalc
   from learned traits that carry an authored `tradition: "<key>"` field;
   the schema marks it `derived` + `serverControlled`; the picker never
   writes it; `checkTraditions` goes away. The stored values are tradition
  **keys** shared with structural spell / ritual `traditions` metadata,
  not localized display tags. The key vocabulary is reconciled in step 0
  (see open item A); contract coordination is low priority (review
  follow-up 3).
4. **`mystical-powers` is retired.** It was a placeholder for spells; spells
   are ordinary traits (`source: "spell"`). Authoring is the user's (step 0).
5. **Creation mode gets the picker in this plan** — amends Chunk I
   decision 5 for traits / talents only. Staged / deferred-buffer mode via
   the `getPortraitData()`-style seam; XP is pure client math, so the
   Phase 8 preview endpoint is **not** a prerequisite. Abilities not
   available at creation carry an authored `availability` flag and are
   hidden in create mode.
6. **Observability:** `specialAttacks` / `reactions` (and effects) are shown
   **in full detail in the picker** and **in compact form on the sheet
   cards**. Compact lines are **derived by a client formatter** from
  mechanized effects / actions; authored summaries cover prose-only
  mechanics (Tier C), including those within otherwise mechanized
  entries. Summary placement and granularity must be settled in step 0
  before the authoring sweep (review follow-up 5).
7. **No authored `attribute` field.** The Figma "enhanced-attribute" line is
   derived from `primary` effects (verified: only the 8
  `exceptional-attribute-*` abilities raise primaries). A rank's check
  attribute is a separate concept, not supplied by a `setBase` summary;
  its representation remains to be settled in steps 0 / 3.
8. **Tier / level choice is "both":** pick the tier / level in the popup
  **and** change it later on the sheet card. Traits allow up / down /
  remove; talents allow level up only. Creation also obeys decision 15.
9. **Talents share the dialog** with a simpler card: boons + sins, `source`
  filter, level `1..levels`, sins shown as XP-granting. **Neither boons
  nor sins are refundable:** no player downgrade or removal action.
  Exceptional corrections belong to DM / administrator maintenance,
  potentially direct character-file edits, not a dedicated removal API
  or editor in this plan. Unsubmitted draft semantics are open item D.
10. **Remember / recall is out** (roadmap Phase 8 UX item); the dialog
    layout leaves the right column free for it.
11. **NB-51 is folded into step 1** (`default: []` on array fields so fresh
    characters carry `traits: []`, `talents: []`, `traditions: []`, …).
12. **Dialog primitive shape** (agent's call, user deferred): a
    function-style module `public/components/catalog-dialog.mjs` over a
    native `<dialog>` created on demand and removed on close (ADR-012
    native widgets), `showModal()`, Promise-returning, **not** a
    `NagaraElement` and not schema-bound — it is a transient picker, not a
    sheet region. The legacy `<dialog id="modal">` and empty `modal.mjs`
    are removed.
13. **No duplicates:** entries already learned are omitted from the list
    (mirrors Chunk I decision 13).
14. **Locale:** all picker fetches pin `CATALOG_LOCALE` (Chunk I decision
    9). Stored `traits[]` / `talents[]` entries keep the wire shape
    `docs/data-contracts.md` §1.2 already specifies (`id`, `tier` |
   `level`, `source` only); display strings are resolved from the catalog,
   not cloned into learned entries. The traditions ownership / value
   change is recorded separately under review follow-up 3, without
   claiming compatibility merely because its JSON type stays the same.
15. **Creation has an adept tier ceiling.** Preserve the creation rule in
   [traits.md](../../rpg/ru/01-core/traits.md): neither an ability nor a
   spell may be selected or raised to master during creation, even when
   sins make 60 or more XP available. Affordability and tier eligibility
   are separate guards; step 6 must cover both picking and submission.

## Review follow-ups (2026-09-19)

These concerns were accepted by the user in the second-opinion review.
They are **step-planning obligations**, not fully specified solutions:
reassess each in isolation at the owning steps below, and record the
decision there before implementing the affected behavior. Existing API
sketches remain provisional where a follow-up changes their assumptions.

1. **High — Shared creation state (steps 3 / 6).** Independent 50-XP
  balances for traits and talents would double-spend the creation budget.
  Establish one draft balance shared by both pickers; merging two
  component-owned experience objects at submit is not sufficient. Also
  derive draft tradition membership from staged traits for spell filters.
2. **High — Stale XP and concurrent writes (steps 3–6, with dialog
  integration in step 2).** Atomic batches and `min: 0` do not protect
  calculations made from an old balance. Reassess local operation
  serialization, confirmation against current state, SSE changes while a
  picker is open, and an explicit detected-conflict versus accepted-risk
  policy for other tabs / clients. Do not silently turn this into a
  server-pricing rewrite.
3. **Low — Tradition contract coordination (steps 0 / 1 / 7).** Writable
  ability IDs becoming server-owned tradition keys is a **breaking
  behavior change**, despite retaining `string[]`. Its operational
  gravity is low here: contracts are provisional, siblings are not
  actively developed, and they will adapt. Record the new meanings and
  existing-data handling without making coordinated sibling releases a
  prerequisite. Canonical-key validation must catch unknown keys; locale
  parity alone does not establish correctness.
4. **Medium — Existing-character XP (step 2½, before steps 3–6).** Earlier
  picks may never have been charged, and earlier sins may never have
  credited their XP. Refunding an unpaid trait would manufacture XP.
  Lock the baseline / transition policy early, including how legacy and
  exceptional DM / administrator adjustments are treated, before enabling
  spending or refunds. Do not assume that current totals reconstruct
  acquisition history.
5. **Medium — Formatter and authoring contract (steps 0 / 3).** None of
  the 375 English rank descriptions checked in the review begins with
  the proposed italic check-attribute markup. Attribute replacement is
  not a substitute for check-attribute metadata. The Order tradition
  mixes mechanized and prose-only effects within a tier, so an
  entry-wide fallback can omit rules; settle per-tier / per-effect
  summary needs before authoring. Specify cumulative tier effects,
  higher-tier action replacement by ID, and the distinction between
  catalog grants and resolved character effects in formatter coverage.
6. **Medium — Dialog ownership and failure paths (steps 2 / 4–6).** A
  body-mounted dialog is outside its caller's automatic subtree cleanup.
  Define owner-disconnect / navigation cancellation, settle-once cleanup,
  focus restoration, stale selection handling, and dropping late
  responses after teardown. Include catalog-load and mutation failure /
  retry behavior, not just pick / Escape success paths.
7. **Medium — Observable engine verification (step 4).** The actual
  `polearm` entry grants +2 bonus damage at novice and Reach Strike at
  adept, not qualities or flags. Weapon slots currently do not display
  flags. Choose accurate fixtures and explicit display locations for
  resolved outputs before claiming the G.2-deferred verification is
  discharged; catalog previews alone do not prove engine application.

## Open items (settle at the step named)

- **A. Tradition key vocabulary (step 0, user).** Spell tags and ability ids
  disagree (`circle` vs `witches-circle`, `runes` vs `rune-magic`,
  `witchcraft` has no ability). Pick one key set, author `tradition` on the
  8 abilities and `traditions: []` on spells / rituals with it, and make
  `docs/reference-authoring.md` name it. Structural keys, not localized
  `tags`, become the matching contract; document the sibling-facing change
  at low coordination priority (review follow-up 3).
- **B. Spell filtering in the picker (step 4).** Proposed: show all spells;
  a "my traditions" chip restricts to spells whose `traditions[]`
  intersects the character's derived `traditions[]`; spells outside it
  carry a small "outside your traditions" badge. Adjust if the user wants
  the default inverted.
- **C. `startingEquipment` shape (step 0).** Display-only prose string for
  now (allowlisted in the locale-drift lint); the Phase 8 acquisition
  model structures it into weapon ids later.
- **D. Unsubmitted talent choices (step 6).** Decision 9 rules out player
  talent refunds. Define when a creation-draft choice becomes committed
  and how cancellation / revision of an unsubmitted draft works; do not
  silently assume a refund exception for the creation form.

## Goals

1. A player can add, upgrade / downgrade and remove traits (abilities +
  spells), and add / upgrade talents (boons + sins), through a searchable,
  filterable popup with full previews. XP is charged / granted correctly;
  only traits offer player refunds.
2. The same picker works on the creation form against the 50-XP budget,
  adjusted by sins and shared across both pickers, with no master-tier
  traits, producing a valid POST payload.
3. `traditions[]` is trustworthy and engine-owned; the catalogs carry every
   field the cards display; the reference-authoring contract documents them.
4. The engine's `specialAttacks` / `reactions` / effects become
   UI-observable per trait (compact) and per catalog entry (full).

## Non-goals

- Remember / recall (roadmap Phase 8 UX item); styling beyond "usable"
  (Chunk I step 5 owns the pass); RU l10n (Phase 8).
- Rituals picker (Chunk I step 4 — but it reuses `catalog-dialog.mjs`).
- Server-side XP bookkeeping / audit, DM XP grants UI (Phase 8; the DM can
  still PATCH `experience.total` directly).
- Player talent downgrade / removal / refunds; a dedicated DM or
  administrator talent-removal API or editor. Exceptional correction is
  maintenance, not a new picker workflow.
- Weapon / armor acquisition from ability grants (roadmap acquisition
  items); `startingEquipment` is display-only here.
- Corruption computation (sibling apps own it; we only supply keys).
- Traditions **display** surface beyond what the spell cards show
  (roadmap Phase 8 item stays, narrowed to "display").

## Steps

Each step is its own commit and confirmation stop with a verifiable gate.
The policy-only step 2½ may be settled earlier, but must be locked before
step 3 or any spending / refund workflow. The review follow-ups above are
revisited during planning of their owning steps, not deferred to close-out.

- **Step 0 — Authoring sweep (user) + catalog contract (agent).** Agent
  first: extend `docs/reference-authoring.md` with the optional keys
  `tradition` (abilities; one key), `traditions` (spells, rituals; key
  array), `startingEquipment` (abilities; prose), `availability`
  (abilities; `"creation"` default when absent, `"faction"` hides at
  creation), `summary` (prose-only mechanics, including mixed entries;
  placement / granularity settled under review follow-up 5). Resolve the
  check-attribute representation and canonical-key validation before the
  authoring sweep (review follow-ups 3 / 5). Add `startingEquipment` and
  `summary` to the locale-drift
  allowlist (`test/reference-locale-drift.test.mts`); make any catalog-shape
  lint accept the keys. User then: retire `mystical-powers`, resolve open
  item A, author `tradition` × 8, `traditions` on spells + rituals,
  `startingEquipment` where the vault lists it, `availability: "faction"`
  where the vault says "not at creation", summaries for Tier C mechanics
  at the agreed granularity — in both locales. **Done when:** the metadata
  decisions are recorded before authoring; `npm test` green (drift lint proves en/ru
  alignment); a node one-liner lists 8 abilities with `tradition`, 0
  spells without `traditions`, 0 entries named `mystical-powers`.
- **Step 1 — Server groundwork: NB-51 defaults + derived traditions.**
  `generateDefaultCharacter` seeds `[]` for every `type: "array"` field
  without an explicit default (NB-51 → resolved, moved to `resolved.md`).
  Registry exposes each trait's `tradition`; `recalculate()` writes
  `traditions` = sorted unique keys of learned abilities carrying one
  (spells do **not** contribute — a tradition is granted by its ability).
  Schema: `traditions` → `derived: true, serverControlled: true`, stays
  `ui.hidden`; `checkTraditions` removed with its tests; new engine tests
  (learn `mystical-tradition-order` → `["order"]`; remove → `[]`; spell
  alone → `[]`). Docs in the same commit: `docs/rpg-engine-semantics.md`
  gains an `ES §traditions` entry; `docs/data-contracts.md` L79-87 and
  §1.2 say derived + key vocabulary; `docs/reference-authoring.md` L322
  pointer; `docs/addon-integration.md` / `docs/bot-integration.md` get a
  note about the changed values / ownership, not a compatibility claim;
  record treatment of existing `traditions` values (review follow-up 3).
  Roadmap "Traditions display surface" item narrowed.
  **Done when:** `npm test` green; API test: POST
  fresh character → body has `traits: []`, `talents: []`, `traditions:
  []`; PATCH `traits` with a tradition ability → `traditions` populated;
  client PATCH of `traditions` → 4xx (server-controlled).
- **Step 2 — Dialog primitive + API plumbing.**
  `public/components/catalog-dialog.mjs`: `openCatalogDialog({ title,
  entries, exclude, search: { fields }, filters: [{ label, predicate }],
  renderCard(entry) → Node, renderPreview(entry) → Node, renderPick(entry)
  → Node })` — builds a native `<dialog>` (heading, search `<input
  type="search">`, filter chips as `<input type="checkbox">` /
  `<fieldset>`, scrollable card list, preview column, Cancel), appends to
  `document.body`, `showModal()`, resolves `Promise<pick | null>` where
  the pick node dispatches a `catalog-pick` `CustomEvent` with `detail`;
  Escape / Cancel / `close` resolve `null`; the element is removed on
  close; keyboard focus lands in the search box. Remove `<dialog
  id="modal">` from `index.html` and delete `modal.mjs`. `api.mjs`: pin
  `getTraits()` to `CATALOG_LOCALE`, add `getTalents()`; both wrapped in
  `createCatalogCache`. Reassess the API sketch for caller-owned
  cancellation, state freshness and failure handling (review follow-ups
  2 / 6) before committing to its signature.
  **Done when:** a throwaway harness page (not
  committed) opens the dialog with the weapons catalog, search narrows the
  list, a filter chip toggles, a pick resolves the promise, Escape resolves
  `null`, and `document.querySelector("dialog")` is `null` afterwards;
  the teardown / focus / failure cases agreed for follow-up 6 are covered;
  `npm test` green.
- **Step 2½ — Existing-character XP transition (decision gate).** Lock
  the policy with the user before implementing the XP model or enabling
  spending / refunds. Review current totals against potentially unpaid
  traits and uncredited sins; choose explicitly among normalization,
  grandfathering, an approved reset of disposable data, or another stated
  baseline. Define trait refund eligibility and treatment of legacy,
  free / DM-granted and manually corrected acquisitions without assuming
  that acquisition history exists. Honor decision 9: this is not a route
  to player talent refunds. Record any required migration / maintenance
  work, its owner and its completion gate; data changes need explicit
  approval. **Done when:** a durable XP-policy decision is recorded,
  including worked legacy and new-character cases, and any transition
  work is assigned before dependent implementation starts. Required data
  preparation must finish before spending / refunds are enabled. This is
  a decision gate, not permission to modify existing characters now.
- **Step 3 — XP model + compact formatter (pure modules + tests).**
  Requires the step-2½ decision. Reassess shared draft accounting and
  mutation freshness (review follow-ups 1 / 2), and use the step-0
  formatter metadata decisions (follow-up 5).
  `public/utils/xp.mjs`: `TRAIT_TIER_COST = { novice: 10, adept: 20,
  master: 30 }` (incremental), `traitCumulativeCost(tier)`,
  `traitDelta(fromTier | null, toTier | null)`, `talentDelta(source,
  fromLevel, toLevel)` for additions / increases only → `{ unspent,
  total }` deltas (boon: `−5 × Δlevel` unspent; sin: `+5 × Δlevel` to
  both), `canAfford(unspent, delta)`, `CREATION_BUDGET = 50`. Creation
  tier eligibility is checked separately from affordability (decision 15).
  `public/utils/trait-format.mjs`:
  `summarizeEffect(effect)` (`+1 Quick`, `Acc → Dis`, `+2 Defense (heavy
  armor)`, `Flag: fearless`, `Quality: piercing (polearm)`),
  `summarizeAction(action)` (`SA · name · trigger`), `traitCardLines(entry,
  tier)` → `{ equipment, stats, actions }` with prose summaries alongside
  mechanized output as agreed in step 0. Do not implement the unsupported
  leading-italic check-attribute parser. Tests
  `test/client-xp.test.mts`, `test/client-trait-format.test.mts` (import
  the `.mjs` directly, like `test/client-armor.test.mts`). **Done when:**
  tests cover policy-eligible trait refund round-trips, boon charges / sin
  grants on additions and upgrades, forbidden player talent decreases,
  mixed-picker draft spending and the creation tier ceiling; formatter
  coverage includes mixed prose / mechanics, cumulative effects and
  action replacement, not just one case per effect / action kind.
- **Step 4 — Traits picker (view mode).** `trait-list.mjs` becomes a real
  editor on `createCatalogCache(api.getTraits)`: vacant card opens
  `openCatalogDialog` with all traits minus learned ids (decision 13),
  filters `source` (ability / spell), `category`, tradition (open item B),
  search over `name` + `tags` + derived summary text; card = name,
  `startingEquipment`, derived enhanced-attribute line, description, three
  rank blocks with check attribute, **full** effect / specialAttack /
  reaction detail per rank, tier pick buttons labelled with cumulative
  cost and disabled when unaffordable. Pick → one PATCH
  `[{ field: "traits", value }, { field: "experience.unspent", value }]`;
  422 → inline error, no state change. Sheet card: compact lines from
  `traitCardLines`, N/A/M control as up / down buttons, remove button,
  each a single atomic PATCH with symmetric refund; `experience.unspent`
  shown in the panel heading; `deps = ["traits", "experience"]`. Horizontal
  scroll of cards (interim CSS only). Reassess mutation freshness and
  dialog lifecycle (review follow-ups 2 / 6); choose display locations and
  fixtures for resolved outputs under follow-up 7.
  **Done when:** in-browser: add `polearm` (novice) → unspent −10 and
  +2 bonus damage on a carried long-quality weapon; upgrade to adept →
  −20 more and Reach Strike appears; downgrade → +20; remove → back to
  start for a policy-eligible purchase. Verify qualities / flags with
  separate appropriate fixtures and visible resolved output before closing
  the G.2-deferred verification. Add a tradition
  ability → `traditions` populated in the PATCH response; overspend →
  422 surfaced, nothing changes; one render per host per PATCH, none on
  the SSE echo; public role: zero controls.
- **Step 5 — Talents picker (view mode).** `talent-list.mjs` on
  `createCatalogCache(api.getTalents)`; same dialog with `source` filter
  (boon / sin), simpler card (name, description, effects summary if any,
  level pick `1..levels` with cost / gain), sheet card level-up only.
  No player downgrade, remove or refund controls; exceptional correction
  remains DM / administrator maintenance (decision 9). Reassess freshness
  and failure handling under review follow-ups 2 / 6.
  Boon PATCH carries `talents` + `experience.unspent`; sin PATCH carries
  `talents` + `experience.unspent` + `experience.total`. **Done when:**
  in-browser: add a boon level 1 → −5; level up → −5; add a sin level 2 →
  `+10` on both `total` and `unspent`; player downgrade / removal is
  unavailable for both sources; overspend → 422 surfaced.
- **Step 6 — Creation mode (shared staged draft).** In `mode === "create"`
  traits and talents use one creation-owned draft and one experience
  balance starting at `CREATION_BUDGET` (sins raise it), never PATCH.
  Resolve the exact staging / subscription interface here (review
  follow-up 1), not independent experience objects merged at submit.
  Draft tradition membership follows staged traits. Hide `availability:
  "faction"` entries; enforce the adept tier ceiling independently of XP
  on selection and submission. Settle unsubmitted talent-choice semantics
  (open item D) without assuming a player refund exception. The creation
  view submits one coherent `traits` / `talents` / `experience` snapshot,
  replacing the hidden `experience.total` input.
  **Done when:**
  in-browser: create with 2 novice + 1 adept → POST 201, sheet shows
  unspent 0 and the three traits; mixed trait / boon spending uses the same
  pool; sin grants update both pickers' available budget; master remains
  unavailable and cannot be submitted even with 60+ XP. Staged traditions
  update spell filtering; faction-only abilities are absent from the create
  dialog, present on the sheet dialog; draft revision follows the recorded
  item-D ruling.
- **Step 7 — Close-out.** Flip the Chunk I step-3 notch, refresh Chunk I
  decision 5's amendment note and Non-goals; roadmap: mark the traits /
  talents part of creation parity done, add "remember / recall" UX item,
  narrow the preview-endpoint item's wording; `docs/architecture.md`
  mentions `catalog-dialog.mjs`; reconcile the review follow-ups with their
  step decisions and the XP-transition gate; sweep the References list
  below; update repo memory with the picker recipe.
  **Done when:** `npm run typecheck`
  + `npm test` green; grep gate: no `data-action="trait-add"` /
  `talent-add` / `update-talent-level` dead attributes remain; no
  `id="modal"`.

## Verification

- These are **future implementation gates**; no tests or runtime checks
  are part of this planning-only revision.
- `npm run typecheck` clean; `npm test` green at every implementation step.
  Step 2½ closes by an explicit policy decision and assigned transition
  work, not a test run.
- Per-step in-browser gates above (Playwright MCP per the
  **ui-browser-verify** rule); prepend the UTF-8 console line before node
  commands in PowerShell.
- Server behaviour changes only in step 1 (defaults, derived traditions,
  validator removal) in the current outline. Reassess that boundary if
  the transition, concurrency or creation-guard decisions need more;
  data-contracts / schema-serializer tests confirm the learned-entry wire
  shapes remain unchanged.
- Low-priority contract bookkeeping at steps 1 / 7 records the changed
  `traditions` values and write ownership; no coordinated sibling release
  is required for these provisional contracts.
- Step gates must include the agreed shared-budget, stale-state, teardown,
  mixed-summary and resolved-output cases from the review follow-ups, plus
  the master-tier creation guard and absence of player talent refunds.

## References to sweep on completion

Every code-side `TODO(<scope>)` that cites this plan is listed here, so the
cleanup obligation is "follow this checklist", not "remember to grep". An
empty list is fine — state it explicitly.

- _(none yet)_ — expected candidates: `TODO(trait-recall)` at the dialog's
  spare column (cites the roadmap item, not this plan, so it will **not**
  belong here); `TODO(starting-equipment)` at the card line if it cites
  the acquisition roadmap item (likewise not here).

## Progress

- [ ] Step 0 — Authoring sweep (user) + catalog contract (agent)
- [ ] Step 1 — Server groundwork: NB-51 defaults + derived traditions
- [ ] Step 2 — Dialog primitive + API plumbing
- [ ] Step 2½ — Existing-character XP transition (decision gate)
- [ ] Step 3 — XP model + compact formatter
- [ ] Step 4 — Traits picker (view mode)
- [ ] Step 5 — Talents picker (view mode)
- [ ] Step 6 — Creation mode (shared staged draft)
- [ ] Step 7 — Close-out
