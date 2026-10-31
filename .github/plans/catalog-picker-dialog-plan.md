# Plan — Catalog picker dialog: traits & talents (XP, traditions, creation parity)

**Status:** active (2026-09-19) — direction agreed with the user; the
second-opinion follow-ups and the XP-transition decision gate below remain
open for step planning. Step-0 metadata decisions recorded 2026-10-23
(see "Step-0 metadata decisions"); step 0 done 2026-10-24. Step-1
decisions recorded 2026-10-24 (see "Step-1 decisions"). Step-2
decisions recorded 2026-10-24 (see "Step-2 decisions"); step 2a done
2026-10-25. Step-2b decisions recorded 2026-10-25 (see "Step-2b
decisions"); step 2b done 2026-10-25. The dialog's visual design runs in
[`catalog-picker-design-plan.md`](./catalog-picker-design-plan.md)
(2026-10-25) and feeds step 2c. Blocks
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
  it is an authored structural `check` field (Step-0 metadata decision
  S0-2).
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
  _Settled 2026-10-24 (S1-2 / S1-4): pre-launch, nothing reads the
  contracts and there is no data to carry over. The new meaning is
  recorded in the authoritative docs only; the contract docs catch up
  at launch. Key validation stays in `checkPickerMetadata` (step 0)._
4. **Medium — Existing-character XP (step 2½, before steps 3–6).** Earlier
  picks may never have been charged, and earlier sins may never have
  credited their XP. Refunding an unpaid trait would manufacture XP.
  Lock the baseline / transition policy early, including how legacy and
  exceptional DM / administrator adjustments are treated, before enabling
  spending or refunds. Do not assume that current totals reconstruct
  acquisition history.
  _Input recorded 2026-10-24 (S1-2): there is no production data and
  development characters are disposable, so a wipe-and-rebuild baseline
  is available. The policy itself is still locked at step 2½._
5. **Medium — Formatter and authoring contract (steps 0 / 3).** None of
  the 375 English rank descriptions checked in the review begins with
  the proposed italic check-attribute markup. Attribute replacement is
  not a substitute for check-attribute metadata. The Order tradition
  mixes mechanized and prose-only effects within a tier, so an
  entry-wide fallback can omit rules; settle per-tier / per-effect
  summary needs before authoring. Specify cumulative tier effects,
  higher-tier action replacement by ID, and the distinction between
  catalog grants and resolved character effects in formatter coverage.
  _Metadata half settled 2026-10-23 (S0-2 / S0-3 below); the formatter
  coverage half stays with step 3._
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

## Step-0 metadata decisions (2026-10-23, with the user)

Locked before the authoring sweep, per open item A and review
follow-ups 3 / 5. Data observations behind them were verified the same day
against `reference/*.en.json` and `rpg/ru/03-reference/*.md`.

- **S0-1. Tradition keys.** The canonical set is the existing spell-tag
  spelling: `order`, `circle`, `theurgy`, `tribe`, `sorcery`, `sirens`,
  `symbolism`, `runes` — one per `mystical-tradition-*` ability
  (`mystical-tradition-witches-circle` → `circle`,
  `mystical-tradition-rune-magic` → `runes`). **`witchcraft` is not a
  tradition:** it is an ordinary magical ability (id `witchcraft`, not a
  spell) and carries no `tradition` field. The `witchcraft` tag on the
  spell `anathema` was an authoring mistake: its `traditions` are
  `["runes", "theurgy", "circle"]`, and its tag should be corrected to
  match during the sweep. Validation rejects any key outside this set.
- **S0-2. Check attribute = structural `check` field.** Optional, holds a
  non-empty array of unique `PrimaryAttributeName`s (`accurate`,
  `cunning`, `discreet`, `appealing`, `quick`, `resolute`, `vigilant`,
  `strong`) — alternatives for **one** roll (OR), since the system lets
  the same activity be tested with different attributes; a single
  attribute is still a one-element array, so consumers never branch on
  shape (amended 2026-10-24 from a scalar after boon authoring showed
  alternatives). **Not localized** (must be identical in en / ru; not on
  the drift allowlist), validated against the primary keys. Placement
  (amended 2026-10-24 to follow the user's authoring): `check` on the
  Tier B / C object in `tiers.<rank>.effects[]` whose description states
  the rolled mechanic — so a rank with two rolls keeps them apart and a
  card can show each roll next to its rule; never on Tier A stat math
  ("X instead of Y" substitutions are `setBase` effects), at rank level
  or inside actions (spells vault has none today). Boons / sins carry an
  entry-level `check` (talents have a single description and numeric
  `levels`).
  Rank prose is left unchanged; no text parser, no delimiter templating.
  Siblings read the field directly.
- **S0-3. `summary` is per rank on traits.** `tiers.<rank>.summary`
  (localized, drift-allowlisted) is a short line for that rank's
  prose-only mechanics; the sheet card shows formatter output for
  mechanized effects / actions plus that rank's `summary`, so mixed tiers
  (34 of 375 trait ranks; e.g. the Order tradition) lose nothing. No
  entry-wide or per-effect summary. Whether talents get an entry-level
  `summary` for the simpler talent card is left to step 5 (13 talents
  carry `effects` today). Context: every trait rank already encodes at
  least one effect / action, 269 ranks are Tier C only, and Tier C effects
  already carry a ~100-char `description`; the summary is the card-sized
  line, not a replacement for those descriptions. Length (added
  2026-10-24): aim ≤ 90 characters in English, lint hard cap 140 code
  points per locale; style rules live in `docs/reference-authoring.md`
  §0.8.
- **S0-4. `startingEquipment` = structured catalog references** (settled
  2026-10-24, resolves open item C). Non-empty array of
  `{ kind: "weapon" | "armor", id, count? }` on ability entries; each `id`
  must resolve in the `kind`'s catalog, `count` is a positive integer
  (default 1), duplicates are rejected. **Not localized** — the picker
  renders item names from the catalogs. Hand-authored by the user: an
  item (usually the cheapest variant) for each weapon type, kind or
  specific weapon the ability names. New `kind`s arrive with new item
  catalogs. Granting the items into a new character's inventory is out of
  scope here (Non-goals); the data is shaped so a later consumer can.

## Step-1 decisions (2026-10-24, with the user)

Settled at the step-1 readiness review. The project is **pre-launch**
(recorded in `AGENTS.md` "Project
Status"): no production data exists, development characters are
disposable, and the cross-project contract docs are provisional drafts.

- **S1-1. NB-51 is fixed in full, not just for arrays.** A fresh character
  carries every non-required, client-visible field the schema declares:
  `[]` for every `type: "array"` field without an authored default
  (generic seeding in `generateDefaultCharacter`), `""` for the optional
  strings (`location`, `background.shadow`, `background.profession`), and
  a complete `portrait` object. Target portrait shape: `{ path: "", crop:
  { x: 0, y: 0, scale: 1, rotation: 0 }, dimensions: { width: 0, height:
  0 }, status: "unset" }` (`"unset"` matches the client's
  `DEFAULT_CHARACTER`; only `"uploaded"` is meaningful to readers). Step 1
  chooses between generic seeding and explicit `default:`s per field. NB-51
  then moves to `resolved.md` with nothing split off.
- **S1-2. No migration, no read-path backfill.** Existing development
  characters are wiped (`scripts/hard-delete.mts --all`) after step 1
  lands instead of being migrated; stale or absent `traditions` on them
  is moot. This also records the follow-up 3 "existing `traditions`
  values" treatment.
- **S1-3. `schemaVersion` stays `2`.** Nothing reads it before launch;
  the project-status note says it is not bumped for pre-launch shape
  changes.
- **S1-4. Contract docs are not step-1 obligations.**
  `docs/data-contracts.md` (now banner-marked provisional),
  `docs/addon-integration.md` and `docs/bot-integration.md` are not
  updated for the `traditions` change; they are rewritten at launch.
  Review follow-up 3 is settled by this (see there). Authoritative docs
  still move in lockstep: `docs/rpg-engine-semantics.md`,
  `docs/reference-authoring.md`, `docs/roadmap.md`.

## Step-2 decisions (2026-10-24, with the user)

Settled at the step-2 readiness review; they answer review follow-ups 2 / 6
for the dialog primitive and replace the provisional API sketch.

- **S2-1. Select, then commit; the caller saves.** Clicking in the left
  column only **selects** (card renderers receive a `select(detail)`
  callback — e.g. a trait card's rank block selects that entry at that
  rank) and marks the selection. A **primary footer button** (caller
  label, e.g. "Learn") commits it; it is disabled until something is
  selected and while the caller's `canCommit(selection)` returns a reason
  string, which the footer shows (affordability, creation tier ceiling).
  No double-click commit — a commit spends XP. Committing resolves the
  promise and closes the dialog; the dialog never PATCHes. The caller
  then saves (one atomic PATCH, or a creation-draft update) and surfaces
  any 422 on the sheet. The promise resolves `Selection[] | null` —
  always an array, one element in this plan — so the roadmap multi-pick
  item turns the single selection into a set without touching callers.
  A selection survives search / filter changes that hide its card (the
  preview and footer keep showing it).
- **S2-2. Dismissal: ✕, Cancel, Escape, outside click.** ✕ in the header
  and Cancel in the footer (Figma's CANCEL) are `<form method="dialog">`
  buttons; Escape is the native `cancel`; an outside click uses
  `closedby="any"` plus a small backdrop-click fallback (Safari lacks
  `closedby` as of 2026-10). All resolve `null`.
- **S2-3. Mounted on `document.body`, closed on navigation.** `showModal()`
  puts the dialog in the top layer, so DOM placement is about lifetime,
  not looks. Inside the host it would die on every `rebuild()` and would
  nest inside the creation `<form>`; on `body` it survives re-renders but
  nothing removes it when the view changes underneath (browser Back while
  it is open). So it closes itself (`null`) on `hashchange` and accepts an
  optional `signal: AbortSignal` for any other caller teardown. Settles
  exactly once; the element is removed on close.
- **S2-4. Opens instantly; loading lives inside.** `entries` is an array
  **or** a promise (e.g. a `createCatalogCache` `get()`). While pending the
  list shows a loader; on rejection, an error line with a Retry button
  that calls a caller-supplied `reload()` (typically `cache.get()` again).
  Callers warm their catalog cache when the sheet / creation form
  renders, so the loader is normally never seen.
- **S2-5. Frozen copy, re-checked on save.** The dialog renders from data
  captured at open; SSE updates while it is open do not re-render it.
  After a pick the caller re-checks against current state (already
  learned, still affordable, still eligible) before saving, and reports
  instead of saving when the pick went stale.
- **S2-6. Focus.** Opening focuses the search box. On close, focus returns
  to the opener if it is still connected, else to a caller-given
  `returnFocus` fallback (hosts `rebuild()` their children, so the opener
  button is often gone by then).
- **S2-7. One dialog at a time.** Opening while a catalog dialog is
  already open resolves `null` immediately.
- **S2-8. Right column: search, filters, preview, recall stubs.** Left
  column: **full-detail cards** (Figma `ability-select-popup`). Right
  column, top to bottom: search + filter chips; a **preview** of the
  current selection as it will look on the sheet (the compact card in the
  frame — Equipment / Stats lines, one line per rank), rendered by an
  optional caller `renderPreview(selection) → Node`, with an empty-state
  hint when nothing is selected; then disabled stub buttons for the
  roadmap remember / recall item (`TODO(trait-recall)`; captions
  **Remember** / **Recall** — open item E). Space check
  against the 1200 × 600 frame: the right column is ~410 px wide, search
  + filters take ~180 px of height, the compact card ~150 × 180 px, the
  stubs one row — it fits; on short viewports the column scrolls
  (design D23: the dialog is now viewport − 64 tall and the card 192 px
  wide, so the column scrolls at common heights too).
  Step 2 ships the slot; step 4 fills it once the step-3 formatter
  exists. If the preview proves cramped in practice, it is dropped
  without touching callers (the option is optional).
- **S2-10. Enter must not dismiss or commit by accident.** In a
  `<form method="dialog">`, Enter in the search box triggers implicit
  submission through the form's **first** submit button in tree order —
  the header ✕ would close the dialog. Keep the search input outside the
  dismiss form (or swallow Enter there); Enter commits only from the
  focused primary button.
- **S2-11. Not the weapons / armor dialog.** The roadmap's weapon-card
  `<dialog>` (Phase 8) will be its own design; this primitive is shaped
  for traits, talents and (Chunk I step 4) rituals only.
- **S2-9. Verification without a harness file.** The step-2 check imports
  `/components/catalog-dialog.mjs` dynamically in the browser
  (Playwright) on a running sheet, against the **traits** catalog (pinned
  in this step), not the weapons catalog. Search / filter / exclude
  logic lives in a pure module so `node:test` covers it.

## Step-2b decisions (2026-10-25, with the user)

Settled at the step-2b readiness review, after 2a landed. They fill the
contract gaps the step-2 sketch left open and amend its `filters` /
`exclude` / `search` shapes (the sketch under step 2 is updated to match).

- **S2b-1. Selection shape.** A `Selection` is `{ entry, detail }`:
  the frozen catalog entry plus the object the card passed to
  `select(detail)` (e.g. `{ tier: "adept" }`, `{ level: 2 }`; `{}` when
  omitted). Identity is `entry.id`. Selecting again replaces the
  selection (same entry with a new detail, or another entry); there is no
  click-again-to-deselect (Cancel covers backing out). Commit resolves
  `[selection]`.
- **S2b-2. Re-render only the affected cards.** On a selection change the
  dialog calls `renderCard` again for the previously selected card and
  the newly selected one (with the new `selection`) and swaps them in
  place; the rest of the list is untouched. Focus is restored to the
  control at the same position among the new card's focusable elements,
  so a keyboard user stays on the rank block they activated. The
  dialog marks the selected card's `<li>` itself; the renderer marks the
  selected rank from `selection`. The 2a `renderCard` signature is
  unchanged.
- **S2b-3. Search fields and matching.** `search: { fields }` where each
  field is an entry key **or** an accessor `(entry) => string | string[]`
  (step 4 needs derived summary text, which is not a stored key). Array
  values (e.g. `tags`) are searched element-wise. Matching: the query is
  split on whitespace and **every** token must occur in some field;
  case-insensitive and diacritic-insensitive (NFD, combining marks
  stripped) on both sides. Empty query matches everything.
- **S2b-4. Filter groups.** `filters: [{ legend, options: [{ label,
  predicate, checked? }] }]`, one `<fieldset>` of checkboxes per group.
  Options are **OR**-ed within a group, groups are **AND**-ed, and a
  group with nothing checked does not restrict (same composition rule as
  ADR-015 conditions). `checked` sets the initial state. Data note: in all
  four trait / talent catalogs `category` equals the stamped `source`, so
  step 4 needs no separate category group; tags (62 distinct on
  abilities) stay in search, not chips.
- **S2b-5. `exclude` is ids.** `exclude?: Iterable<string>` of entry ids,
  removed from the list entirely (decision 13). Other entry-level
  restrictions — e.g. hiding `availability: "faction"` in create mode
  (step 6) — are applied by the caller to `entries` / `reload()` before
  the dialog sees them (`.then(filter)` on a promise).
- **Agent's calls (not user decisions).** Search and filters toggle
  `hidden` on list items rather than re-rendering; a "No matches" line
  shows when everything is hidden; the `canCommit` reason sits in a
  footer status line; the chips stay outside the dismiss forms (S2-10).

## Open items (settle at the step named)

- **A. Tradition key vocabulary (step 0, user).** ✅ _Resolved 2026-10-23
  — see S0-1._ Spell tags and ability ids
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
- **C. `startingEquipment` shape (step 0).** ✅ _Resolved 2026-10-24 — see
  S0-4 (structured weapon / armor references, not prose)._
- **D. Unsubmitted talent choices (step 6).** Decision 9 rules out player
  talent refunds. Define when a creation-draft choice becomes committed
  and how cancellation / revision of an unsubmitted draft works; do not
  silently assume a refund exception for the creation form.
- **E. Remember / recall stub captions (step 2, user).** ✅ _Resolved
  2026-10-24: **Remember** / **Recall** (the Figma wording). "Store" was
  floated and dropped — it collides with the planned gold shop (roadmap
  acquisition items)._

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

- Remember / recall (roadmap Phase 8 UX item; only disabled stubs here);
  styling beyond "usable" outside the catalog dialog (Chunk I step 5 owns
  that pass; the dialog itself is styled in step 2c); RU l10n (Phase 8).
- Rituals picker (Chunk I step 4 — but it reuses `catalog-dialog.mjs`).
- Server-side XP bookkeeping / audit, DM XP grants UI (Phase 8; the DM can
  still PATCH `experience.total` directly).
- Player talent downgrade / removal / refunds; a dedicated DM or
  administrator talent-removal API or editor. Exceptional correction is
  maintenance, not a new picker workflow.
- Weapon / armor acquisition from ability grants (roadmap acquisition
  items); `startingEquipment` is data only here (S0-4) — nothing is
  granted to a character yet.
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
  `tradition` (abilities; one S0-1 key), `traditions` (spells, rituals;
  S0-1 key array), `startingEquipment` (abilities; catalog references —
  S0-4), `availability`
  (abilities; `"creation"` default when absent, `"faction"` hides at
  creation), `check` (on Tier B / C effects in `tiers.<rank>.effects[]`
  on abilities / spells,
  entry-level on boons / sins; an array of primary keys, structural — S0-2) and
  `summary` (`tiers.<rank>.summary` on traits; S0-3). Name the canonical
  tradition keys and the `check` vocabulary there, and make the catalog
  lint reject keys outside them (review follow-up 3). Add
  `summary` to the locale-drift
  allowlist (`test/reference-locale-drift.test.mts`); make any catalog-shape
  lint accept the keys. User then: retire `mystical-powers`, author
  `tradition` × 8, `traditions` on spells + rituals (fix `anathema`'s
  `witchcraft` tag per S0-1), `startingEquipment` where an ability names
  a weapon, `availability: "faction"` where the vault says "not at creation",
  `check` where a vault rank names its roll, and per-rank
  `summary` for prose-only mechanics — in both locales. **Done when:**
  `npm test` green (drift lint proves en/ru
  alignment); a node one-liner lists 8 abilities with `tradition`, 0
  spells without `traditions`, 0 entries named `mystical-powers`.

  > 🔄 **Agent half done 2026-10-23.** Divergences / notes:
  > - Contract lives in `docs/reference-authoring.md` §0.8 (key table,
  >   tradition-key table, per-key rules) plus updated §0.1 / §0.6 /
  >   §1–§5 shapes and the §12 checklist. The §2 "corruption from
  >   `traditions` vs spell tags" sentence is left for step 1, which
  >   changes what the character-side `traditions` holds.
  > - Canonical keys live in `TRADITION_ABILITY_BY_KEY` in
  >   `test/rules/reference-lint.test.mts` (key → owning ability id);
  >   `checkPickerMetadata` rejects unknown keys, a key on the wrong
  >   ability, misplaced keys (entry-level `check` / `summary` on traits,
  >   `summary` on talents / rituals, `check` on rituals, ability-only
  >   keys elsewhere) and non-primary `check` values. Unit tests cover
  >   the failure paths.
  > - The "done when" one-liner is now a test: `picker metadata is fully
  >   authored (en)` runs as `todo` (reports gaps without failing; 126 at
  >   hand-off = 8 abilities + 49 spells + 68 rituals + the placeholder).
  >   **Drop its `todo` option when the user's sweep lands** — that flip
  >   closes step 0.
  > - The vault has no starting-equipment prose and no explicit faction
  >   heading (the faction / profession group is only described as "at
  >   the bottom" of `rpg/ru/03-reference/abilities.md`); both are user
  >   authoring calls. The vault names the tribe tradition "Стихии"
  >   while the RU catalog says "Племя" — flagged to the user, not a
  >   key concern.
  > - **2026-10-24 amendment** (S0-2 / S0-3 / S0-4): `check` became an
  >   array placed on the rolled effect (the user's 25 boon/sin and 45
  >   ability-effect scalars per locale were wrapped in place),
  >   `startingEquipment` became structured catalog references and left
  >   the drift allowlist, and `summary` gained the 140-code-point cap.
  >   `checkPickerMetadata` now walks every entry at any depth against a
  >   per-topic placement table, so a §0.8 key in the wrong object fails
  >   (the previous top-level-only checks missed effect-level keys). The
  >   tradition half of the sweep has landed (the completeness test
  >   reports 0 gaps but stays `todo` until the user finishes `check` /
  >   `summary` / `startingEquipment` / `availability`, which the lint
  >   cannot see as missing).

  > ✅ **Step 0 done 2026-10-24.** The completeness test is a regular
  > gate (0 gaps). Final state, identical in en/ru: 8 `tradition`
  > abilities; `traditions` on all 49 spells and 68 rituals, each
  > matching its tradition tags (`anathema` → `["runes", "theurgy",
  > "circle"]`, stray `witchcraft` / RU `круг` tags fixed); no
  > `mystical-powers`; 6 `faction` abilities; `check` on 45 ability
  > effects, 28 boons, 8 sins. Deferred authoring, outside this gate:
  > - `summary` is `"[placeholder]"` on all 300 ranks per locale that
  >   carry a Tier C effect (154 ability + 146 spell ranks); real text
  >   is authored iteratively against the §0.8 style rules.
  > - `startingEquipment` is on 23 / 75 abilities — weapons / armor
  >   only; abilities naming other items wait for their catalogs.
- **Step 1 — Server groundwork: NB-51 defaults + derived traditions.**
  Applies S1-1 … S1-4.
  - **Defaults (NB-51, S1-1).** `generateDefaultCharacter` seeds `[]` for
    every `type: "array"` field without an explicit default, `""` for the
    optional strings, and the full `portrait` shape. Two traps:
    `portrait.crop` has no `type: "object"`, so the traversal never walks
    into it, and `portrait.path` / `portrait.status` are
    `serverControlled`, which the traversal skips. Their seed has to come
    from somewhere else: the create stamp in `createCharacter`, or a
    targeted seed like the `natural_weapon` one. NB-51 → resolved, moved
    to `resolved.md`.
  - **Derived traditions.** The registry exposes each trait's `tradition`
    (either a field on `TraitLookupResult` or a separate lookup; update the
    test stub `test/helpers/registry.mts`, including `emptyRegistry`).
    `recalculate()` **always** writes `traditions` = sorted unique keys of
    learned abilities carrying one, at any tier (spells do **not**
    contribute — a tradition is granted by its ability). It resets the
    field like `flags`. This reset is what puts `traditions: []` on a fresh
    character: `generateDefaultCharacter` skips server-controlled paths, so
    once `traditions` is server-controlled it is never seeded there.
  - **Schema.** `traditions` → `derived: true, serverControlled: true`,
    stays `ui.hidden`. `checkTraditions` is removed along with its tests
    (`test/reference-validation.test.mts` "traditions" block) and the
    then-unused `abilityIds` in `CatalogIndexes`.
  - **Tests.** New engine tests: learn `mystical-tradition-order` →
    `["order"]`; remove → `[]`; spell alone → `[]`; two traditions →
    sorted. The API gate needs a seeded ability carrying `tradition` in
    `startTestServer` (`test/helpers/http.mts` seeds only `test-ability`
    today).
  - **Docs, same commit.** `docs/rpg-engine-semantics.md` gains an
    `ES §traditions` entry. Its rule comes from the vault:
    `rpg/ru/01-core/abilities.md` "Мистические традиции" (membership is
    a separate ability) and `rpg/ru/01-core/magic.md` (traditions shield
    their own spells' corruption). Also update `ES §phase-order`'s
    sequence and the out-of-engine corruption row.
    `docs/reference-authoring.md` §2: update the "sibling apps compute
    corruption from `traditions` vs spell tags" sentence to "character
    `traditions` (derived keys) vs the spell's `traditions`". Roadmap: the
    "Traditions display surface" item is narrowed (it still says "curated
    ability ids"). Contract docs are skipped per S1-4. ADR-014's
    historical mention stays.
  - **After landing:** wipe the development characters (S1-2).
  **Done when:** `npm test` green; API test: POST fresh character → body
  has `traits: []`, `talents: []`, `rituals: []`, `traditions: []`,
  `effects: []`, `affiliations: []`, `location: ""` and the full
  `portrait` shape (no absent non-required field); PATCH `traits` with a
  tradition ability → `traditions` populated; client PATCH of
  `traditions` → 422 with a `FORBIDDEN` error entry (server-controlled).
  > ✅ **Completed 2026-10-24.** Divergences from the text above:
  > - The portrait `path` / `status` seed is a targeted post-traversal seed
  >   in `generateDefaultCharacter` (not the create stamp), so the
  >   default-shape tests see it without going through `createCharacter`.
  > - `generateDefaultCharacter` now `structuredClone`s authored defaults —
  >   `combat.carried`'s default tuple was previously shared by reference
  >   across every fresh character.
  > - The registry carries `tradition` as an optional field on
  >   `TraitLookupResult` (spread onto every tier), not a separate lookup.
  > - `ES §phase-order`'s sequence was also corrected while there: clamps
  >   come after flags, then per-slot combat fanout → action collection →
  >   tradition derivation.
  > - `docs/reference-authoring.md` gained a Tradition-keys bullet: the
  >   ability's `tradition` is now engine-read (feeds the derived field).
  > - `test/helpers/fixtures.mts` portrait status `"none"` → `"unset"` to
  >   match the new creation seed.
  > - `deferred-tasks.md` orphan note on `traditions` updated (no longer
  >   curated ability ids).
  > - Dev characters wiped (S1-2).
- **Step 2 — Dialog primitive + API plumbing.** Applies S2-1 … S2-11
  and S2b-1 … S2b-5.
  `public/components/catalog-dialog.mjs`: `openCatalogDialog({ title,
  header?, entries, reload?, exclude?: Iterable<id>, search: { fields:
  (key | (entry) → string | string[])[] }, filters: [{ legend, options:
  [{ label, predicate, checked? }] }], renderCard(entry, select,
  selection) → Node, renderPreview?(selection) → Node, commitLabel,
  canCommit?(selection) → true | string, signal?, returnFocus? }) →
  Promise<Selection[] | null>`, `Selection = { entry, detail }`.
  Split into three sub-steps (user, 2026-10-24), each its own commit and
  confirmation stop; the in-browser checks run per S2-9.
  - **Step 2a — Shell.** Native `<dialog>` appended to `document.body`,
    `showModal()`, with the frame's regions as empty containers: header
    (title, caller `header` node such as the XP balance, ✕); left column
    (scrollable list); vertical divider; right column holding the
    `<input type="search">` (present for focus and the Enter guard, not
    yet filtering — 2b wires it); footer (Cancel + primary commit button,
    disabled until 2b wires selection). Dismissal
    (S2-2), close on `hashchange` / `signal` (S2-3), settle-once +
    removal on close, one instance (S2-7), focus in / out (S2-6), Enter
    handling (S2-10), loader / error + Retry for a promised `entries`
    (S2-4). Only the CSS needed to see the regions. Remove `<dialog
    id="modal">` from `index.html` and delete `modal.mjs`. `api.mjs`:
    pin `getTraits()` to `CATALOG_LOCALE` and make it throw on non-2xx
    like `getWeapons()` (it has no callers), add `getTalents()`;
    consumers wrap them in `createCatalogCache` (steps 4 / 5).
    **Done when:** the dialog opens from the traits catalog with a
    throwaway `renderCard`; Enter in search neither closes nor commits;
    ✕, Cancel, Escape and an outside click each resolve `null`; a
    `hashchange` and an aborted `signal` each close it; a pending
    `entries` promise shows the loader and a rejected one shows Retry,
    which recovers; a second open while one is open resolves `null`;
    focus starts in search and returns to the opener (or `returnFocus`
    when the opener is gone); `document.querySelector("dialog")` is
    `null` after every path; `npm test` green.

    > ✅ **Completed 2026-10-25.** Divergences from the text above:
    >
    > - `returnFocus` accepts an element **or** a function returning one,
    >   so a host that rebuilds its subtree while the dialog is open can
    >   hand back the fresh button at close time.
    > - The 2b-only options (`exclude`, `search`, `filters`,
    >   `renderPreview`, `canCommit`) are accepted but ignored; the commit
    >   button stays disabled and `renderCard` receives a no-op `select`
    >   and a `null` selection. The three sites carry
    >   `TODO(catalog-dialog-selection)`, which 2b removes.
    > - "Only the CSS needed to see the regions" also had to neutralize
    >   global layout-layer rules that leak into the dialog: the fixed
    >   `header` (`position: fixed`, `row-reverse`), the 12rem × 5rem
    >   `button`, the reset's `input { all: unset }` (loses
    >   `box-sizing`), and the `p:first-of-type::first-letter` drop cap.
    >   The rules live in an `@scope (dialog.catalog-dialog)` block at the
    >   end of the `layout` layer in `public/common/styles.css`; 2c may
    >   move them into their own sheet.
    > - With no `closedby` support, a backdrop-click fallback (target is
    >   the dialog itself and the point lies outside its box) provides the
    >   outside-click dismissal.
  - **Step 2b — Contents.** Pure search / filter / exclude logic in
    `public/utils/catalog-filter.mjs`, tested in
    `test/client-catalog-filter.test.mts`. Right column: search
    `<input type="search">`, filter chips (`<fieldset>` of checkboxes),
    preview slot with an empty-state hint, disabled **Remember** /
    **Recall** stubs (S2-8). Selection state, selected-card marking,
    primary button enablement and the `canCommit` reason line (S2-1).
    The search input already exists from 2a; 2b wires it to the filter
    module. CSS stays functional: columns, scroll, divider, a visible
    selected state.
    **Done when:** search narrows the list; a filter chip toggles;
    `exclude` hides entries; clicking a card selects it and updates the
    preview; the selection survives a search that hides its card; the
    primary button is disabled with nothing selected and while
    `canCommit` returns a reason (shown), and commits `[selection]`
    otherwise; the stubs are present and disabled; the 2a paths still
    pass; `npm test` green.

    > ✅ **Completed 2026-10-25.** Divergences from the text above:
    >
    > - `renderCard` receives the selection only when it belongs to that
    >   card's entry (`null` otherwise), so "re-render only the old and
    >   new cards" (S2b-2) stays sound — no other card can depend on it.
    > - Hiding is a `hidden` toggle on the cards' `<li>`, not a
    >   re-render; when nothing is visible a "No matches." status line
    >   appears. The `canCommit` reason shows in the footer `<output>`,
    >   and the filter `<fieldset>`s sit outside the dismiss forms, after
    >   the `<search>` element.
    > - Without `renderPreview` the preview shows the entry's name.
    > - Region rules moved to `:scope > header | section | aside |
    >   footer`, so caller cards may use those elements freely.
    > - More global leaks neutralized inside the `@scope` block: the
    >   reset's `input { all: unset }` erases checkboxes
    >   (`input[type="checkbox"] { all: revert }`), the page's `output`
    >   and `h3` type, and the drop cap's accent colour
    >   (`p::first-letter { color: inherit }`). The search field still
    >   takes the global focus background — left for 2c.
    > - In Chrome, the first Escape in a non-empty search field clears
    >   it (native `type=search`, which fires `input`, so the list
    >   resets); the second Escape cancels the dialog.
  - **Step 2c — Dialog CSS pass.** Brings the dialog chrome to the
    redesign now instead of waiting for Chunk I step 5 (which keeps
    the rest of the sheet). Tokens from Figma per the
    **ui-figma-source** rule (`get_variable_defs` on
    `ability-select-popup` and the `view` frame), mapped to `:root`
    custom properties — no hex / fonts from memory. Per the **styling**
    rule: an `@layer`ed, `@scope`d dialog stylesheet with native nesting;
    surface, `::backdrop`, header / title type, columns and divider,
    search and chips, preview frame, stubs, footer buttons (primary vs
    Cancel), hover / `:focus-visible` / selected / disabled states,
    open / close motion with `@starting-style` honoring
    `prefers-reduced-motion`, and a narrow-viewport fallback (columns
    stack, list scrolls). Also the **card contract** the step-4 / 5
    renderers fill: a styled card skeleton (name, attribute lines,
    description, rank row of three blocks as in the frame, selected rank)
    so the real cards land pre-styled. Re-check the frame first: it is
    an early draft, so settle open visual questions with the user before
    styling them. Those questions are worked in
    [`catalog-picker-design-plan.md`](./catalog-picker-design-plan.md);
    2c implements from its approved Figma `picker` frames.
    Behaviour the design adds (design D19, the Message molecule): the
    loader shows only after ~300 ms of pending `entries`, with
    "Loading…" announced but not shown; No matches gains a
    **Clear filters** button that empties the search and unchecks every
    chip (focus moves to the search field, as Retry does); the message
    texts change to "Couldn't load the list." / "Nothing left to learn
    here." / "Nothing matches." / "Select a rank to see it here." (the
    last is caller-tunable for untiered catalogs).
    **Done when:** screenshots at desktop and narrow widths reviewed by
    the user against the frame; keyboard-only run through every control
    shows focus; reduced motion disables the animation; the 2a / 2b
    paths still pass; `npm test` green.
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
  filter groups `source` (ability / spell) and tradition (open item B) —
  no `category` group, it duplicates `source` (S2b-4) — search over
  `name` + `tags` + derived summary text; card = name,
  `startingEquipment`, derived enhanced-attribute line, description, three
  rank blocks with check attribute, **full** effect / specialAttack /
  reaction detail per rank, each rank block selecting that rank (S2-1)
  and labelled with its cumulative cost; `canCommit` reports unaffordable
  / ineligible selections (design D16 / D18: such ranks are
  `aria-disabled` and carry the reason in their head, so `canCommit` is
  the backstop; the footer status describes the selection); the preview
  slot shows `traitCardLines` for the selection. Commit → one PATCH
  `[{ field: "traits", value }, { field: "experience.unspent", value }]`;
  422 → inline error, no state change. Sheet card: compact lines from
  `traitCardLines`, the grade discs as the N/A/M control (design D22:
  a later disc raises, a lower learned disc lowers), a remove button with
  an inline confirmation, each a single atomic PATCH with symmetric
  refund; `experience.unspent`
  shown in the panel heading; `deps = ["traits", "experience"]`. Horizontal
  scroll of cards (interim CSS only). Reassess mutation freshness and
  dialog lifecycle (review follow-ups 2 / 6); choose display locations and
  fixtures for resolved outputs under follow-up 7.
  - **Term markers — non-blocking.** A separate authoring task (design
    plan D17); step 4 does not wait for it.
    - Add the `{kind:id}` / `{kind:id|text}` rule to
      `docs/reference-authoring.md`.
    - Mark both locales: qualities first, plus the `check` attribute
      words.
    - Add a lint test: every marker resolves to a known id, and EN and
      RU carry the same marker set.
    - Teach the renderer to turn markers into Term tooltip triggers and
      highlighted attribute words.

    Until the task lands, the text renders plain and the attribute
    word is highlighted by exact match on the localized name. That
    matches all 45 English check effects; inflected Russian forms stay
    unhighlighted.
  - **Spell check attribute — implied Resolute** (decided 2026-10-31).
    Every spell is cast with Resolute, a system rule rather than
    per-spell data, so the spell data carries no `check` for it. The
    entry and card Attributes line for a spell is Resolute plus any
    `check` authored on its effects, deduplicated. Implement it in
    `traitCardLines` (one place for the entry, preview and sheet card).
    The rule is documented in `docs/reference-authoring.md` §0.8
    (`check`), so the sibling apps derive the same line.
  - The entry density (full / middle / A / B) is chosen in the design
    rounds.

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
  Settle the talent card's summary line here (S0-3): the design
  (design plan D30) reserves one line for it and draws a placeholder.
  Either add an entry-level `summary` to boons / sins (the lint's
  140-code-point cap, both locales), or derive it from `effects`.
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
  decision 5's amendment note and Non-goals, and note in Chunk I step 5
  that the catalog dialog was styled in step 2c here; roadmap: mark the traits /
  talents part of creation parity done (the "remember / recall" and
  "multi-pick" items were added 2026-10-24), narrow the preview-endpoint item's wording; `docs/architecture.md`
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
- Contract bookkeeping for the changed `traditions` values and write
  ownership is deferred to launch (S1-4); no coordinated sibling release
  is required for these provisional contracts.
- Step gates must include the agreed shared-budget, stale-state, teardown,
  mixed-summary and resolved-output cases from the review follow-ups, plus
  the master-tier creation guard and absence of player talent refunds.

## References to sweep on completion

Every code-side `TODO(<scope>)` that cites this plan is listed here, so the
cleanup obligation is "follow this checklist", not "remember to grep". An
empty list is fine — state it explicitly.

- ~~`TODO(picker-metadata)` in `test/rules/reference-lint.test.mts`~~ —
  swept with step 0 (the completeness test is now a regular gate).
- ~~`TODO(catalog-dialog-selection)` × 3 in
  `public/components/catalog-dialog.mjs`~~ — swept with step 2b.
- Expected candidates that will **not** belong here: `TODO(trait-recall)`
  at the dialog's spare column (cites the roadmap item, not this plan);
  `TODO(starting-equipment)` at the card line if it cites the acquisition
  roadmap item.

## Progress

- [x] Step 0 — Authoring sweep (user) + catalog contract (agent)
  _(2026-10-24; summaries are placeholders, authored iteratively)_
- [x] Step 1 — Server groundwork: NB-51 defaults + derived traditions
  _(2026-10-24)_
- [ ] Step 2 — Dialog primitive + API plumbing
  - [x] Step 2a — Shell _(2026-10-25)_
  - [x] Step 2b — Contents _(2026-10-25)_
  - [ ] Step 2c — Dialog CSS pass
- [ ] Step 2½ — Existing-character XP transition (decision gate)
- [ ] Step 3 — XP model + compact formatter
- [ ] Step 4 — Traits picker (view mode)
- [ ] Step 5 — Talents picker (view mode)
- [ ] Step 6 — Creation mode (shared staged draft)
- [ ] Step 7 — Close-out
