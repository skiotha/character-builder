# Plan — Phase 6 Chunk I: Catalog-Driven Client Pickers

**Status:** active (extracted from [`phase6-plan.md`](./phase6-plan.md) Chunk I, 2026-09-01)
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
- `effects`, `traditions`, `affiliations`, and `notes` are `ui.hidden` in the
  schema — their "stub components" render nothing today, so "implementing"
  them is not a gap-closing obligation; two stay parked (see Non-goals).
- No `/api/v1/traditions` endpoint exists (traditions are curated ability
  ids; a future picker would filter `/api/v1/traits` by
  `source === "abilities"`).
- The outline's verification #1 ("no entries left in `STUB_COMPONENTS`") was
  unachievable as written; the honest end state is exactly
  `{effect-list, tradition-list}` remaining.
- The outline omitted the `combat.carried` **re-indexing obligation**: slots
  reference weapons by `weaponIndex`, so every add/remove of
  `equipment.weapons[]` must re-map the tuple in the same atomic PATCH.

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
- **Step 1 — Weapons picker + free-form placeholders (`equipment-list`).**
  New component registered for all eight paths; branch on path:
  `equipment.weapons` → real picker, the other seven → greyed-out disabled
  placeholder + `TODO(<scope>)`. Picker: fetch `/api/v1/weapons`; add =
  clone catalog entry projected to the engine `Weapon` shape (`id`, `name`,
  `type`, `damage`, `qualities`, plus `effects` when authored non-empty —
  mirror the H.3 `lookupWeapon` projection; strip `description`/`cost` —
  confirm the H.2 validator's accepted key set during implementation);
  remove = auto-unassign + `weaponIndex` re-map per decision 4;
  `natural_weapon` undeletable. Weapon-slots interplay: own-slot select
  filters to own-quality with no empty option; hand slots keep the empty
  option (verify current `weapon-slots.mjs` behavior while there).
  **Done when:** in-browser: add weapon → appears in slot dropdowns →
  assign to main-hand → derived `baseDamage`/`attackAttribute` update via
  SSE → remove the carried weapon → auto-unassign observed →
  `natural_weapon` cannot be removed.
- **Step 2 — Armor slots (`armor-slot`).** For `equipment.armor.body` /
  `.plug`: fetch `/api/v1/armor`, filter entries by `slot` matching the
  position, single-select, `null` clears. Clone minus presentation fields
  (same accepted-key-set check as step 1).
  **Done when:** in-browser: equip body armor → derived `armor` updates;
  clear → reverts; plug slot likewise.
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
  fetch `/api/v1/rituals`; entries `{id, level ≥ 1}`. Schema: unhide `notes`
  + `affiliations` (add `ui.section`/`label`/`order` — the chunk's only
  server-side change; watch schema-serializer / data-contracts tests);
  plain string-row editors for both.
  **Done when:** in-browser: add a ritual; add/edit/remove note and
  affiliation rows; PATCH round-trips + SSE live update.
- **Step 5 — Styling & usability pass.** Creation + character view to
  "usable" (dashboard/initial only if cheap); fix the `#character-name`
  pointer interception (Location field mouse-editable at common viewports);
  seed `ux-wishlist.md` with observations from steps 1–4. Per the
  **styling** rule: `@layer`/`@scope`/native nesting; existing stylesheets
  predate ADR-012 and are not reference implementations.
  **Done when:** full-flow in-browser pass at common viewport sizes.
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
- No server behavior change except the step-4 schema unhide —
  data-contracts tests confirm.
- Grep gate at close-out: no `[component-name]`-style stub renders remain
  for player-editable fields; `STUB_COMPONENTS` matches the step-6 target.

## References to sweep on completion

Every code-side `TODO(<scope>)` that cites this plan is listed here, so the
cleanup obligation is "follow this checklist", not "remember to grep". The
step-1 placeholder TODOs cite roadmap capabilities / NB-14, **not** this
plan, so they do not belong here — only add entries if a TODO gains a
pointer to this plan.

- _(none yet)_

## Progress

- [x] Step 0 — Extraction & bookkeeping (2026-09-01)
- [ ] Step 1 — Weapons picker + free-form placeholders
- [ ] Step 2 — Armor slots
- [ ] Step 3 — Traits & talents pickers
- [ ] Step 4 — Rituals picker + notes/affiliations editors
- [ ] Step 5 — Styling & usability pass
- [ ] Step 6 — Close-out
