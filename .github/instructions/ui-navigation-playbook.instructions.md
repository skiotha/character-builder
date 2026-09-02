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

## Creating a character

1. Home page → click "Create new character".
2. Fill everything required **before** trying to submit: `characterName`,
   `background.race` (its absence silently blocks submission), and the
   eight primary attributes summing to **exactly 80** (server-enforced).
3. **No visible submit control exists on the creation route.** The form's
   own submit button is hidden; the CREATE CTA in the header belongs to the
   home route; the header icon button (`#home`) is `type=submit` but sits
   outside the `<form>` with no `form` attribute, so clicking it does
   nothing. Submit by focusing any text field **inside the form** and
   pressing **Enter** (implicit form submission).
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
  the SSE broadcast refreshes the sheet.
- **Overlay intercepts are common** (unadapted CSS): e.g. the
  character-name block can swallow clicks aimed at Location. If a click is
  intercepted: click the field's `<label>` instead (labels forward
  activation to their control), resize the window larger, or run the
  round-trip on a different field.
- After creation, base primaries are owner-read-only (DM-only writes;
  in-game changes arrive as effects) and every secondary value is
  server-computed — assert those, don't try to edit them.

## Not wired in the client yet — don't hunt for it

- Catalog pickers don't exist: traits, talents, rituals, weapons, armor,
  and manual effects cannot be added through the UI (see `docs/roadmap.md`,
  Phase 6 chunk table). Seed that state via the API (PATCH with catalog
  ids) or fixtures instead.
- **Interim defect — component roots get clobbered after any save.** Until
  the ADR-017 component lifecycle lands, every PATCH response and SSE update
  runs the leaf-field updater over component roots too, so the weapon-slots
  `<ol>`, the trait / talent `<ul>`s and the equipment stubs turn into
  `"[object Object]"` text. The data is fine — **reload the page** to
  restore the sheet; do not read it as a server bug. (Retire this entry when
  ADR-017 ships.)

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
   `/#character/<id>`, then **reload once** — a same-document hash change
   from a scripted `goto` does not re-render the route. The form should
   carry `data-role="owner"`.
4. Useful probes: a `MutationObserver` on every `[data-path]` element
   watching `class` for the `updated` flash lists exactly which elements a
   state update touched; `selectOption` on
   `[data-path="combat.carried"] select[data-slot="0"]` fires a real PATCH.
