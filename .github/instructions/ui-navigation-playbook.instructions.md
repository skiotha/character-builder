---
applyTo: "public/**/*.css, public/**/*.html, public/**/*.mjs"
---

# UI navigation playbook (current schema-driven UI)

**Why this exists.** The client moved to schema-driven rendering (ADR-009)
but the CSS was never adapted and several features are not wired yet, so the
live UI has drifted from the intended (Figma) design. Until the frontend
catches up (tracked in `docs/roadmap.md`), driving it in a browser takes the
workarounds below. This is a navigational aid, not a spec — update or retire
entries as the client improves. Before retire, confirm that all listed quirks
were ironed out or register a new bug.

## Setup & tooling quirks

- `npm run start:dev` → `http://127.0.0.1:3000`. Catalog `[effects]` warn
  lines at startup are expected authoring noise, not a failure.
- Playwright MCP: element-addressing arguments take `target` (a snapshot ref
  like `e56` or a CSS selector) — not `ref`.
- Safe-to-ignore console noise: favicon fetch failures; one SSE
  `EventSource` error right after navigation (it auto-reconnects).
- Field ids follow `field-<dotted.path>` (`#field-location`,
  `#field-background\.profession`) — escape the dots in CSS selectors.
- Screenshots save into the Playwright server's own cwd, not the workspace;
  treat accessibility snapshots as the verification record.

## Routing & getting around

- The router is hash-driven (`hashchange`): `#dashboard`, `#character/<id>`,
  `#character/new`, anything else → welcome view. A scripted `goto` to a
  hash URL renders the route without a reload; browser back / forward
  re-render too.
- **Back to the dashboard** from the sheet or the creation form: the header
  icon `#home` is `<a href="#dashboard">`. On the welcome page (no token) it
  is a self-link — expected, not a defect (`ux-wishlist.md`).
- The sheet's BIO / INVENTORY / DESCRIPTION nav entries are inert
  placeholders (no `href`) — nothing to click through to yet.
- Routes needing a player token (`#dashboard`, `#character/new`) fall back
  to the welcome view without one; `#character/<id>` renders for anyone,
  as `data-role="public"` when no token matches.
- **NB-52:** a hash change that arrives while a view is still loading is
  dropped (URL and view desync). Wait for the sheet to render before the
  next navigation; don't chain two quick `goto` / `#home` clicks.

## Creating a character

1. Home page → click "Create new character".
2. Fill everything required **before** trying to submit: `characterName`,
   `background.race` (its absence silently blocks submission), and the
   eight primary attributes summing to **exactly 80** (server-enforced).
3. **No visible submit control exists on the creation route.** The form's
   own submit button is hidden; the CREATE CTA in the header belongs to the
   home route; the header icon (`#home`) is the back link to `#dashboard`,
   not a submit control — clicking it abandons the form. Submit by focusing
   any text field **inside the form** and pressing **Enter** (implicit form
   submission).
4. **Client-side validation failures are silent** — no message renders; the
   POST simply never fires. Always confirm through network requests:
   `POST` to the characters endpoint → 201, then a route change to the new
   sheet. No request at all = a required field is missing or invalid.

## Editing on the character sheet

- Fields render `readonly` until a **real click** puts them in edit mode
  (the element gains `data-editing`; the click handler captures the
  pre-edit value for the save diff). Programmatic form-fill can bypass or
  mis-order that and break the save — use **click → type → Tab (blur)**.
- The PATCH fires on blur. Verify: network shows the PATCH with a 2xx, and
  the SSE broadcast refreshes the sheet. The SSE echo of the tab's own PATCH
  changes nothing (structural diff), so expect **one** `updated` flash per
  changed leaf and **one** `render` per affected `nagara-*` host — not two.
  A remote update never overwrites a field that is mid-edit (`data-editing`).
- **Overlay intercepts are common** (unadapted CSS): e.g. the
  character-name block can swallow clicks aimed at Location. If a click is
  intercepted: click the field's `<label>` instead (labels forward
  activation to their control), resize the window larger, or run the
  round-trip on a different field.
- After creation, base primaries are owner-read-only (DM-only writes;
  in-game changes arrive as effects) and every secondary value is
  server-computed — assert those, don't try to edit them.
- **Portrait upload works on the sheet** for owner / DM: `setInputFiles` on
  `#portrait-input` (inside `<nagara-portrait>`) → one `POST …/portrait`
  then one PATCH carrying six leaves (`portrait.crop.{x,y,scale,rotation}`,
  `portrait.dimensions.{width,height}`); a mouse drag or wheel on the drop
  zone fires one more six-leaf PATCH after ~300 ms. Don't PATCH
  `portrait.crop` wholesale — the node has no permissions and the server
  rejects it. The uploading tab keeps its blob preview until you navigate
  away; assert the server `src` / transform in a **second** tab. Public
  role: the file input is `disabled`. Re-cropping an already-saved portrait
  is not wired yet (Chunk I).
- **Weapons picker works on the sheet** for owner / DM, inside
  `[data-path="equipment.weapons"]` (`<nagara-equipment-list>`):
  `selectOption` on `select.weapon-add-select` (catalog id, e.g.
  `two_handed_sword`; already-owned ids are not listed) enables the Add
  button → one PATCH carrying `equipment.weapons` only. Each row's
  `button.weapon-remove` fires one PATCH carrying **both**
  `equipment.weapons` and the re-mapped `combat.carried` (hand slots
  pointing at the removed weapon → `null`, own slot → `natural_weapon`).
  `natural_weapon` has no remove button. Expect one `render` on every
  `nagara-equipment-list` host (all eight share `deps: ["equipment"]`)
  plus one on `nagara-weapon-slots`, none on the SSE echo. Public role:
  no controls. The other seven equipment lists render a read-only
  "Not editable yet." placeholder.

## Not wired in the client yet — don't hunt for it

- Catalog pickers don't exist for traits, talents, rituals, armor, and
  manual effects — they cannot be added through the UI (see
  `docs/roadmap.md`, Phase 6 chunk table). Seed that state via the API
  (PATCH with catalog ids) or fixtures instead.

## Seeding a fixture via the API

`data/` is gitignored — assume no characters exist. Creating one through
the form works, but the API is faster for a test fixture:

1. `POST /api/v1/characters` with header `x-player-id: <token>` and the
   **full** required payload: `characterName`, `background.{race,age}`,
   the eight `attributes.primary.*` (sum 80), `attributes.secondary`
   (`toughness.{max,current}`, `defense`, `armor`, `painThreshold`,
   `corruptionThreshold`, `corruptionMax`), `experience.{total,unspent}`,
   `corruption.{permanent,temporary}`, `equipment.money`. Any omission is a
   400 with `REQUIRED` details — the form fills these silently, the API
   does not.
2. `PATCH /api/v1/characters/:id` (same header, body `{ updates: [{ field,
   value }] }`). Weapons: keep `natural_weapon` at index 0 and append
   catalog clones with `id` / `name` / `type` / `damage` / `qualities`
   (e.g. `two_handed_sword`; `war_claws` is a second own-quality weapon).
   Traits: `{ id, tier, source }` with a **catalog** id — it is `polearm`,
   not `polearm-mastery`; unknown ids fail with `UNKNOWN_REFERENCE`.
3. In the browser: `localStorage.setItem("x-player-id", "<token>")`, load
   `/#character/<id>` (the hash router renders it directly — no reload
   needed). The form should carry `data-role="owner"`.
4. Useful probes: a `MutationObserver` on every `[data-path]` element
   watching `class` for the `updated` flash lists exactly which elements a
   state update touched; `selectOption` on
   `[data-path="combat.carried"] select[data-slot="0"]` fires a real PATCH.
   To count host renders without touching source, wrap `render` on each
   `customElements.get("nagara-*").prototype` from `page.evaluate` (it is
   looked up dynamically); wrapping `connectedCallback` /
   `disconnectedCallback` does **not** work — reactions are captured at
   `define` time. Prove teardown via DOM + behaviour instead: zero
   `nagara-*` hosts after leaving, and replaying the sheet snapshot into
   `setCurrentCharacter` on the dashboard producing zero renders.
