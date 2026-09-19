# Plan — Phase 6 Chunk I: Catalog-Driven Client Pickers

**Status:** active (resumed 2026-09-16) — the client-lifecycle prerequisite
shipped ([ADR-017](../../docs/decisions/017-client-component-lifecycle.md);
plan archived at [`done/client-component-lifecycle-plan.md`](./done/client-component-lifecycle-plan.md)).
Step 0 shipped; steps ½ and 1 are next. Extracted from
[`phase6-plan.md`](./phase6-plan.md) Chunk I, 2026-09-01.
**Owner:** user (design authority) + agent (implementation)
**Trigger:** Chunks A–H made the engine complete, but the UI cannot reach it:
every catalog-fed component renders as a `[component-name]` stub, so a new
character can never gain weapons, armor, traits, talents, or rituals through
the client. The original inline Chunk I outline (authored 2026-04-21) drifted
against the post-H codebase and was re-scoped + decision-locked with the user
on 2026-09-01.

## Drift notes (why the inline outline was rewritten)

Verified against the code on 2026-09-01:

- `equipment-list` is bound to **eight** schema paths, not two:
  `equipment.weapons`, `equipment.ammunition`, `equipment.runes` (max 3),
  `equipment.assassin` (private), `equipment.tools`,
  `equipment.inventory.carried`, `equipment.inventory.home` (private),
  `equipment.artifacts`. Only `weapons` is catalog-validated.
- `effects`, `traditions`, `affiliations`, `notes`, and `rituals` are
  `ui.hidden` in the schema — their "stub components" render nothing today,
  so "implementing" them is not a gap-closing obligation; two stay parked
  (see Non-goals).
- No `/api/v1/traditions` endpoint exists (traditions are curated ability
  ids; a future picker would filter `/api/v1/traits` by
  `source === "abilities"`).
- The outline's verification #1 ("no entries left in `STUB_COMPONENTS`") was
  unachievable as written; the honest end state is exactly
  `{effect-list, tradition-list}` remaining.
- The outline omitted the `combat.carried` **re-indexing obligation**: slots
  reference weapons by `weaponIndex`, so every add/remove of
  `equipment.weapons[]` must re-map the tuple in the same atomic PATCH.

## Step-1 readiness review (2026-09-02) — why the plan was paused

Verified in-browser and via the API before starting step 1:

- **No component re-render contract** _(resolved 2026-09-16)_.
  `bindFieldsToState` piped every `[data-path]` element — component roots
  included — through `updateFieldValue`, and `notifyChangedPaths` treated
  arrays as always-changed, so one slot change (200 OK) turned
  `OL combat.carried`, `UL traits` and the `equipment.weapons` stub into
  `"[object Object]"` text. Fixed as a stand-alone prerequisite — ADR-017
  (light-DOM `nagara-*` elements on `NagaraElement`, structural change
  detection, leaf-only binding, shared `api.patchCharacter`); the
  implementation record with per-step divergences is
  [`done/client-component-lifecycle-plan.md`](./done/client-component-lifecycle-plan.md).
  Step 1 below is rewritten against that contract.
- **Engine ignores the own-slot choice** _(resolved 2026-09-16, step ½)_ —
  NB-49: `deriveCombatSlots` used the first own-quality weapon and never
  read `carried[2].weaponIndex`, so War Claws / Battle Heels could never
  occupy the own slot. Coupled validator defect NB-50: per-field PATCH
  validation ran against the stored `equipment.weapons`, which broke
  decision 4's atomic re-map once the own slot can be a non-first weapon.
  Both were server-side and independent of the client work — fixed in
  **step ½** below; entries archived in `.github/bugs/resolved.md`.
- Side finding filed, not scheduled here: NB-51 (fresh characters omit
  every no-default field — `talents`, `rituals`, … — that the contract
  documents as `[]`).
- Confirmed assumptions: the H.2 validator accepts `id` / `name` / `type` /
  `damage` / `qualities` (+ optional `effects` array) and does not reject
  extra keys; `weapon-slots.mjs` already filters the own slot to own-quality
  with no empty option; dangling `weaponIndex` values degrade to `null`
  slots rather than throwing.

## Decisions locked (2026-09-01, with the user)

1. **Own slot stays own-quality-only** (ADR-014 unchanged; the
   `validateCombatCarried` rejection in `src/models/character.mts` stays).
   The picker filters own-slot candidates to `qualities.includes("own")`.
   "Several similar weapons" is served by the weapons list + hand slots +
   play-time swaps, not by relaxing the own slot.
2. **`natural_weapon` entry is permanent** in `equipment.weapons[]` — the
   picker never offers deleting it; it is always selectable for the own slot.
3. **Own slot never empty client-side** — clearing it re-selects
   `natural_weapon`. The server keeps rejecting `null` own slots
   (defense-in-depth; no server change).
4. **Removing a carried weapon auto-unassigns**: hand slots → `null`, own
   slot → `natural_weapon`'s index. `equipment.weapons` + `combat.carried`
   are re-mapped and sent in the **same PATCH** (the handler's all-or-nothing
   422 convention makes it atomic).
5. **Creation mode ships nothing this chunk (Option A).** Pickers are
   view-mode-only; the creation form keeps its current scope (identity +
   attributes). Flow: create → land on the sheet → equip there via live
   PATCH. The sanctioned path to creation-time parity is a future stateless
   preview endpoint — filed as a roadmap Phase-8 item, not built here.
   Rejected alternatives: duplicating the effect engine client-side;
   persist-immediately draft characters.
6. **Out of scope, stay `ui.hidden`, zero code**: `effect-list` (DM effects
   editor) and `tradition-list`. Both remain in `STUB_COMPONENTS`; both have
   roadmap Phase-8 homes.
7. **Notes + affiliations unhide** with plain string-row editors
   (add/edit/remove). No new server validators — ADR-003 trusted posture;
   the existing `type: "array"` check suffices. Affiliations' entity-backed
   future stays a roadmap item.
8. **The seven free-form equipment arrays** (everything `equipment-list`
   covers except `weapons`) render as **visible, disabled placeholders** with
   `TODO(<scope>)` comments at the render sites. Runes cataloging is NB-14.
9. **Locale:** pickers fetch at the server's `DEFAULT_LOCALE` (EN); stored
   entries carry EN display strings cloned from catalog entries. This keeps
   the picker wire shape identical to what H.2 validates, so H.2's
   "revisit no-canonicalization alongside Chunk I" rider is discharged as a
   no-op. RU l10n of the client is Phase 8.
   _Mechanism (2026-09-16):_ `parseLocale` prefers `Accept-Language` over
   `DEFAULT_LOCALE`, so a bare catalog fetch from a RU browser would
   **store** RU names. Every picker fetch therefore sends an explicit
   `?locale=` from a `CATALOG_LOCALE = "en"` constant in `public/api.mjs`
   (EN is the project-wide default, so hardcoding is safe). Phase 8's l10n
   item notes the consequence: RU display must resolve names by `id` from
   the catalog, not from the stored string.
10. **Figma scope clarified** (rule edited in step 0): the Figma file is the
    authority for how things **look**, not for what things **are** —
    information architecture and behavior are owned by the schema, ADRs, and
    docs.
11. **Styling bar is "usable"** for the creation form and character view
    (dashboard/initial only if cheap). Includes fixing the `#character-name`
    pointer-interception defect from H.2's UI pass (no NB — fixed in-chunk).
12. **Sibling parity:** pickers clone catalog entries client-side, so the
    character wire shape does not change → no sibling-doc updates expected;
    re-confirmed at close-out.

_Added 2026-09-16 (with the user), during the step-1 readiness check:_

13. **No duplicate weapons.** Nothing in the RPG system forbids two copies
    of the same catalog weapon, but it is meaningless for the player, so the
    picker omits catalog entries whose `id` is already present in
    `equipment.weapons[]`. Client-side only — ADR-003 trusted posture, no
    server validator.
14. **Weapon acquisition model is deferred — step 1 adds straight from the
    catalog as a stopgap.** In the finished app a player equips only from
    their **inventory**, which is populated by (a) creation-time ability
    grants (e.g. a bow-related ability adds a bow — creation only, never
    afterwards), (b) a shop that exchanges gold for catalog weapons, and
    (c) DM grants from the reference list. None of that exists yet and it
    lands after Phase 6 / after this chunk — registered as the roadmap
    Phase 8 item **"Weapon acquisition model: inventory → equip"**. The
    step-1 add control carries a `TODO(weapon-acquisition)` citing that
    roadmap item, so the direct-catalog add is visibly a deliberate
    interim, not the intended end state.

## Goals

1. Every character-sheet field a player is meant to edit is editable through
   the UI: weapons (with slot assignment), armor, traits, talents, rituals,
   notes, affiliations.
2. The engine's derived outputs (per-slot combat values, flags,
   specialAttacks, reactions) become UI-observable — discharging the manual
   verification deferred from Chunk G.2.
3. The client reaches "usable" — a player can create and maintain a real
   character without raw API calls.

## Non-goals

- Creation-form pickers / live effect-aware previews at creation (Phase 8
  preview endpoint).
- DM `effect-list` editor; traditions surface (both stay hidden + stubbed).
- Catalogs or structured editors for the seven free-form equipment arrays.
- RU localization; weapon-cards `<dialog>` UI (both Phase 8).
- `DEFAULT_CHARACTER` staleness in `public/utils/rpg.mjs` (Phase 8 parity
  item); NB-48 parent-object PATCH bypass (field-level PATCHes only here).

## Steps

Each step is its own commit + confirmation stop, independently manually
testable. Per-step gates: `npm run typecheck` + `npm test` green, and an
in-browser pass over the touched view (Playwright MCP, per the
**ui-browser-verify** rule) — client code has no automated coverage.

- **Step 0 — Extraction & bookkeeping.** Create this file; shrink
  `phase6-plan.md` Chunk I to a pointer (heading kept verbatim); fix the two
  "Chunk I step 7" cross-references there; clarify the Figma rule in **both
  mirrors** (`.github/instructions/ui-figma-source.instructions.md` +
  `.cursor/rules/ui-figma-source.mdc`, same commit); create
  `.github/plans/ux-wishlist.md` (empty structure); roadmap: Chunk I row →
  in progress, Phase 8 gains the preview-endpoint, DM-effects-editor,
  affiliations-entity, traditions-surface, and free-form-catalogs items.
  **Done when:** `npm test` green (anchor lints pass over the edited files).
- **Step ½ — Own-slot engine fix (NB-49) + merged-batch validation
  (NB-50).** Server-only, no client dependency. `deriveCombatSlots` honors
  `carried[2].weaponIndex` when it indexes an own-quality weapon, falling
  back to the first own-quality weapon, then to `natural_weapon` synthesis;
  `ES §carried-slots` Engine bullet updated in the same commit.
  `validateCharacterUpdate` builds the merged clone before the per-field pass
  and hands it to `validateFieldValue` as `allData`. Tests: honored / invalid
  / missing own index in `test/rules/`; weapons-shrink + carried re-map with
  a non-zero own index passes in `test/validation.test.mts`. Both NB entries
  move to `resolved.md`.
  **Done when:** `PATCH combat.carried = [null, null, { weaponIndex: <war_claws> }]`
  round-trips with that index; `npm test` green.

  > ✅ **Completed 2026-09-16.** Divergences from the text above:
  > - The function is `deriveCombatSlots` (the plan said `deriveCombat`);
  >   the module's pipeline header comment was updated alongside the digest.
  > - The validator's pre-apply is **guarded**: an update whose
  >   `applyFieldUpdate` throws (an earlier update in the same batch replaced
  >   its parent with a primitive) is reported as a `VALIDATION` error on
  >   that field instead of propagating; a third `test/validation.test.mts`
  >   case covers it.
  > - An API E2E was added on top of the unit cases: `test/api.test.mts`
  >   runs the NB-49 repro (own → `war_claws`, index survives recalc, slot
  >   carries `deep_wounds`) and then the NB-50 shrink + re-map batch in one
  >   PATCH. `test/helpers/http.mts` now seeds `war_claws` into the test
  >   weapons catalog to make that possible.
- **Step 1 — Weapons picker + free-form placeholders (`equipment-list`).**
  _(Rewritten 2026-09-16 against ADR-017; `public/components/weapon-slots.mjs`
  is the reference port.)_
  - **Component shape.** `public/components/equipment-list.mjs` defines
    `<nagara-equipment-list>` extending `NagaraElement` (`base.mjs`) with
    `static deps = ["equipment", "combat.carried"]` (the picker rebuilds on
    any equipment array and must re-map slots, so it needs the tuple too).
    Export `renderEquipmentList = componentFactory(EquipmentListElement)`
    and register it in `public/renderers/component-registry.mjs` for all
    eight
    `equipment-list` paths, removing `"equipment-list"` from
    `STUB_COMPONENTS`. `render(character)` branches on `this.path`:
    `equipment.weapons` → real picker; the other seven → a greyed-out,
    disabled placeholder listing the stored entries read-only, with a
    `TODO(<scope>)` at the render site (cite the roadmap capability / NB-14
    for runes, never this plan). Rebuild via `this.rebuild(...nodes)`; do
    **not** read `getState()` inside `render` (ADR-017 §render-arg). Gate
    every write on `isWritable(this.fieldSchema, this.role, this.mode)`; in
    `create` mode the element renders once with no add / remove controls
    (decision 5).
  - **Catalog fetch.** `api.getWeapons()` (add to `public/api.mjs` beside
    `getTraits()`, sending `?locale=${CATALOG_LOCALE}` — decision 9
    mechanism); fetch lazily on first render and cache per element
    instance. Late catalog responses check `this.isConnected` before
    touching the DOM.
  - **Add** = clone the catalog entry projected to the engine `Weapon`
    shape (`id`, `name`, `type`, `damage`, `qualities`, plus `effects` only
    when authored non-empty — mirror the H.3 `lookupWeapon` projection;
    strip `description` / `cost`; the H.2 validator's accepted key set was
    re-confirmed 2026-09-16: `id` in catalog, `name`/`type` strings,
    numeric `damage`, registry-checked `qualities`, optional `effects`
    array, extra keys tolerated). The add `<select>` lists only catalog
    entries not already in `equipment.weapons[]` (decision 13) and carries
    a `TODO(weapon-acquisition)` citing the roadmap Phase 8 acquisition
    item (decision 14). Picker controls stay unnamed and use
    `type="button"` — both views live inside a `<form>` and the creation
    view collects `form.elements` by `name`. **Remove** = splice +
    auto-unassign per decision 4: hand slots pointing at the removed index
    → `null`, own slot → `natural_weapon`'s new index, all other
    `weaponIndex` values shifted. `natural_weapon` is never offered for
    removal (decision 2).
  - **Write path.** One `api.patchCharacter(this.character.id, updates)`
    carrying both `equipment.weapons` and the re-mapped `combat.carried`
    (stripped `{ weaponIndex }` entries, as `weapon-slots` sends) so the
    server's all-or-nothing 422 keeps it atomic. On resolve: `if
    (!this.isConnected) return;` then branch on `result.success` →
    `setCurrentCharacter(result.character)` (the element and
    `<nagara-weapon-slots>` both re-render from their deps; the SSE echo is
    a no-op) or `console.error`. Depends on step ½ for a non-first own
    index to validate.
  - **Weapon-slots interplay.** No changes expected: the own-slot `<select>`
    already filters to own-quality with no empty option and the hand slots
    keep the empty option; verify while there.
  - **Verification instrumentation:** the archived lifecycle plan's fixture
    recipe (also in the **ui-navigation-playbook** rule): wrap `render` on
    `customElements.get("nagara-equipment-list").prototype` and
    `…("nagara-weapon-slots")` to assert exactly one render each per PATCH.
  **Done when:** in-browser: add weapon → appears in slot dropdowns →
  assign to main-hand → derived `baseDamage`/`attackAttribute` update from
  the PATCH response (one render per host, none on the SSE echo) → remove
  the carried weapon → auto-unassign observed in the same PATCH →
  `natural_weapon` cannot be removed; public role sees the list read-only;
  creation form still renders the placeholder without controls.

  > ✅ **Completed 2026-09-16.** Divergences from the text above:
  > - The pure logic (catalog projection, tuple strip, carried re-map on
  >   remove, owned-id filter) lives in `public/utils/weapons.mjs` with
  >   `test/client-weapons.test.mts` covering it; the component imports
  >   those helpers rather than inlining them.
  > - The catalog is cached at **module scope** (one fetch per page load,
  >   shared by every host), not per element instance; a failed fetch
  >   resets the promise so the next render retries.
  > - **Add** PATCHes `equipment.weapons` only (appending never disturbs
  >   indices); **remove** sends the two-field batch as planned.
  > - A `p.weapon-catalog-status` line shows "Loading weapon catalog…" and,
  >   on fetch failure, "Weapon catalog unavailable — adding is disabled."
  >   with the add controls omitted.
  > - The placeholder branch's TODO scope is `TODO(equipment-catalogs)`.
  > - Browser pass: add `two_handed_sword` → 1 PATCH, 1 render on each of
  >   the 8 `nagara-equipment-list` hosts + 1 on `nagara-weapon-slots`, no
  >   SSE-echo renders; assign main-hand → `baseDamage` 10 / `accurate`;
  >   remove → one PATCH carrying both fields, main-hand back to empty;
  >   `war_claws` → own → remove → own back to `natural_weapon`; public
  >   role zero controls; creation form 8 hosts, zero controls, POST 201.
- **Step 2 — Armor slots (`armor-slot`).** For `equipment.armor.body` /
  `.plug`: fetch `/api/v1/armor`, filter entries by `slot` matching the
  position, single-select, `null` clears. Clone minus presentation fields
  (same accepted-key-set check as step 1).
  - **Plug ruling (2026-09-19).** A plug's own `armor` field is never read
    by the engine (`ES §secondaries` reads only the body piece); plugs
    contribute solely through their qualities' registry effects. No engine
    / validator / ES change — the digest and `docs/reference-authoring.md`
    now state it explicitly, and every authored plug carries `armor: 0`.
  - **Placeholder catalog.** The catalog had **no** plug entries; three
    `plug_test_*` placeholders (`hampering_2` + one of `fortified` /
    `protective` / `oiled`) make the slot exercisable. Replacing them is a
    roadmap Phase 8 item ("Author the plug armor catalog"). `flexible` is
    avoided so the numbers are unambiguous (NB-33).
  - **Acquisition.** Picking straight from the catalog is a stopgap
    mirroring step 1: `TODO(armor-acquisition)` at the picker cites the new
    roadmap Phase 8 "Armor acquisition model: inventory → equip" item.
  **Done when:** in-browser: equip body armor → derived `armor` updates;
  clear → reverts; plug slot: equip a `fortified` plug with body empty →
  `armor` +1 and `defense` −2 from qualities alone; clear → reverts.
  API test covers the plug path end-to-end.

  > ✅ **Completed 2026-09-19.** Divergences from the text above:
  > - Pure helpers (`projectCatalogArmor`, `armorSlotFromPath`,
  >   `catalogEntriesForSlot`) live in `public/utils/armor.mjs` with
  >   `test/client-armor.test.mts`; the component imports them.
  > - The step-1 module-scope catalog cache was extracted into
  >   `public/utils/catalog-cache.mjs` (`createCatalogCache(fetcher,
  >   label)`) and `equipment-list.mjs` was refactored onto it, behaviour
  >   unchanged; `armor-slot.mjs` shares the same primitive.
  > - `api.getArmor()` added beside `getWeapons()`.
  > - Each host is a `<label>` wrapping one unnamed `<select>` (`— none —`
  >   + slot-filtered options labelled `name (armor N · qualities)`), a
  >   `p.armor-catalog-status` loading / error line while the catalog is
  >   not in hand, and a read-only `<dl>` (Armor, Qualities from
  >   `qualitiesEffective ?? qualities`). A stored id the catalog does not
  >   offer stays visible as a disabled `(unknown: id)` option.
  > - `deps = ["equipment.armor"]` only; `armor-slot` removed from
  >   `STUB_COMPONENTS`; interim CSS block under `div#equipment`.
  > - Test seed: `fortified` and `hampering_2` carry their real registry
  >   effects in `test/helpers/http.mts` plus a `test-plug-fortified`
  >   entry; new PATCH test asserts `armor` +1 / `defense` −2 /
  >   `qualitiesEffective`, then reverts on `null`.
  > - Browser pass (owner): body `light_armor` → 1 PATCH, `armor` 0→4,
  >   `defense` 10→8, 1 render on each of 2 `nagara-armor-slot` + 8
  >   `nagara-equipment-list` hosts, 0 on `nagara-weapon-slots`, 0 on the
  >   SSE echo; clear → reverts; plug `plug_test_fortified` → `armor` 1,
  >   `defense` 8, summary shows `hampering_2, fortified`; clear → reverts.
  >   Public role: both selects disabled. Creation form: 2 hosts, disabled,
  >   unnamed (not in form data), POST 201.
- **Step 3 — Traits & talents pickers.** Extend the display-only
  `renderTraitList` / `renderTalentList` with add/remove. Traits:
  `/api/v1/traits` (merged, `source`-stamped); stored shape per
  `docs/data-contracts.md` §1.2 (id, tier ∈ novice/adept/master, source);
  tier picker inline. Talents: `/api/v1/talents`; level within `1..levels`
  from the catalog entry.
  **Done when:** in-browser: add Polearm Mastery + a polearm → slot
  qualities / flags / specialAttacks / reactions populate (first half of the
  G.2-deferred verification); tier/level bounds enforced by the UI.
- **Step 4 — Rituals picker + notes/affiliations editors.** `ritual-list`:
  fetch `/api/v1/rituals`; entries `{id, level ≥ 1}`. Schema: unhide
  `rituals`, `notes` + `affiliations` (add `ui.section`/`label`/`order` —
  the chunk's only server-side change after step ½; watch
  schema-serializer / data-contracts tests); plain string-row editors for
  notes and affiliations.
  **Done when:** in-browser: add a ritual; add/edit/remove note and
  affiliation rows; PATCH round-trips + SSE live update.
- **Step 4½ — Portrait re-crop on the sheet + crop / pan-zoom math fix.**
  Registered 2026-09-11 from lifecycle-plan step 3, which shipped view-mode
  portrait upload (`<nagara-portrait>` → `api.uploadPortrait` → six-leaf
  crop PATCH) but deliberately left two gaps. **(a) Re-crop without
  re-upload:** today the drop zone only opens the file picker while no image
  is staged, so an already-saved portrait cannot be panned / zoomed again —
  the element must enable the pan-zoom session on the server image (same
  `onCropChange` → six-leaf PATCH path) and offer an explicit "replace"
  affordance instead of the click-to-pick guard. **(b) The crop math is
  wrong** (user-reported): the translate / scale / constrain calculations in
  `portraitHandler.mjs` (`processImageFile` initial fit, `pan`,
  `handleZoom`, `constrainImageToViewport`) do not behave as expected and
  must be re-derived — pick one coordinate convention (image-origin offset
  in viewport px vs. centre-anchored), make zoom anchor at the pointer, and
  make the constraint keep the image covering the viewport. Crop values are
  viewport-pixel-relative, so both routes must keep rendering the zone at
  the same size (30rem×45rem measured on both, 2026-09-11) or the stored
  crop must become size-independent — decide here. Sibling readers of
  `portrait.crop` (addon / bot contracts) must be checked before changing
  the stored meaning.
  **Done when:** in-browser: pan / zoom an already-saved portrait → PATCH
  → second tab shows the same framing; replace via the affordance still
  works; a stored crop reproduces pixel-identically on creation and sheet;
  the `TODO(portrait-recrop)` site is removed.
- **Step 5 — Styling & usability pass.** Creation + character view to
  "usable" (dashboard/initial only if cheap); fix the `#character-name`
  pointer interception (Location field mouse-editable at common viewports);
  seed `ux-wishlist.md` with observations from steps 1–4. Per the
  **styling** rule: `@layer`/`@scope`/native nesting; existing stylesheets
  predate ADR-012 and are not reference implementations.
  _Carried in from step 1 (2026-09-16; observed, not blocking testing):_
  - The `div#equipment` block is squeezed at the default viewport — the
    legacy layout gives it no room once a list holds more than a tile, so
    the weapons picker is functional but cramped. Give the section real
    width / wrapping at common viewports.
  - The picker's interim styles live in a `nagara-equipment-list` nested
    block inside `div#equipment` in `public/common/styles.css`, written to
    **override** the legacy icon-tile rules (`ul { display: flex }`,
    `li { 9rem × 9rem }`, `button { all: unset }`) and the layout-layer
    `button` sizing by specificity. Fold them into the redesigned equipment
    styling instead of keeping the override stack; decide whether the
    seven free-form placeholders stay as greyed lists or get a single
    "not editable yet" block.
  - The add row is `<label>Add weapon <select>…</select></label>` +
    `<button type="button">Add</button>`; Figma may want a different
    affordance (inline search, dialog) — check the source before restyling.
  **Done when:** full-flow in-browser pass at common viewport sizes,
  including the equipment section with three-plus weapons stored.
- **Step 6 — Close-out.** Formal E2E scenario: create a fresh character via
  UI → add weapon → see it in the slot dropdown → assign to main-hand →
  derived values update → add a trait → registry-driven outputs (per-slot
  values, flags, specialAttacks, reactions) populate — completes the manual
  verification deferred from Chunk G.2. Author `docs/client-pickers.md`
  as-built (per component: endpoint, entry shape, PATCH shape, validation
  relied on). Update `.github/copilot-instructions.md` + `AGENTS.md` where
  touched surfaces changed; refresh repo memory. Roadmap Chunk I row → ✅;
  flip the pointer note in `phase6-plan.md`; re-confirm sibling parity
  (decision 12); sweep the references list below.
  **Done when:** `STUB_COMPONENTS` is exactly
  `["effect-list", "tradition-list"]`; all bookkeeping lands in one commit.

## Verification

- `npm run typecheck` clean; `npm test` green at every step.
- Per-step in-browser gates above; step 6 runs the end-to-end scenario.
- No server behavior change except step ½ (engine + validator fixes) and
  the step-4 schema unhide — data-contracts tests confirm.
- Grep gate at close-out: no `[component-name]`-style stub renders remain
  for player-editable fields; `STUB_COMPONENTS` matches the step-6 target.

## References to sweep on completion

Every code-side `TODO(<scope>)` that cites this plan is listed here, so the
cleanup obligation is "follow this checklist", not "remember to grep". The
step-1 placeholder TODOs cite roadmap capabilities / NB-14, **not** this
plan, so they do not belong here — only add entries if a TODO gains a
pointer to this plan.

- `public/behaviors/portraitHandler.mjs` — `TODO(portrait-recrop)` at the
  drop-zone click guard (step 4½ removes it).

## Progress

- [x] Step 0 — Extraction & bookkeeping (2026-09-01)
- [x] _(prerequisite)_ [`done/client-component-lifecycle-plan.md`](./done/client-component-lifecycle-plan.md) — shipped 2026-09-16
- [x] Step ½ — Own-slot engine fix (NB-49) + merged-batch validation (NB-50) (2026-09-16)
- [x] Step 1 — Weapons picker + free-form placeholders (2026-09-16)
- [x] Step 2 — Armor slots (2026-09-19)
- [ ] Step 3 — Traits & talents pickers
- [ ] Step 4 — Rituals picker + notes/affiliations editors
- [ ] Step 4½ — Portrait re-crop on the sheet + crop / pan-zoom math fix
- [ ] Step 5 — Styling & usability pass
- [ ] Step 6 — Close-out
