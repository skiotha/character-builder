# Phase 3 — Schema-Driven Rendering: Session Plan

> Detailed implementation plan for [Phase 3](roadmap.md#phase-3--schema-driven-rendering).
> Each session leaves the app in a working state. Foundation first (additive),
> then migrate views one at a time, then cleanup.
>
> **Basis:** [ADR-009](decisions/009-schema-driven-rendering.md)
> (supersedes [ADR-004](decisions/004-hybrid-spa-server-views.md)).
> DOM conventions follow [ADR-012](decisions/012-standards-first-html-css.md).

---

## Current State (pre-Phase 3)

- **Server:** 4 template files (`src/templates/*.mts`, all `@ts-nocheck`),
  4 thin renderer wrappers (`src/renderers/*.mts`), 4 view endpoints
  (`GET /api/v1/view/{initial,dashboard,creation,character/:id}`)
- **Client:** Views fetch server HTML via `api.fetchView()`, hydrate via
  `template-engine.mjs`, attach behaviors via `enhanceElement()`, connect
  SSE via `characterStream.mjs`, update fields via `subscribeField()` +
  `updateFieldValue()`
- **Schema:** `CHARACTER_SCHEMA` in `src/models/character.mts` defines field
  types, validation, permissions, defaults. `SchemaFieldUI` interface exists
  in `src/types.mts` with partial properties (`label`, `placeholder`, `help`,
  `order`, `hidden`, `quickActions`). Some fields already have `ui` metadata.
- **Client validation:** `public/validation/schema.mjs` partially duplicates
  the server schema — to be replaced by served schema.
- **Behaviors:** Decoupled system that works on any DOM with `data-behavior`
  attributes. `editable.mjs` imports `updateFieldValue` from
  `template-engine.mjs` (coupling to remove).
- **State:** Reactive state with `subscribeField(path, callback)` and
  `notifyChangedPaths(old, new)` — well-suited for the new model.
- **Stubs:** `public/components/form-field.mjs` and `public/components/modal.mjs`
  are empty.

---

## Design Decisions

1. **`editableBy` NOT added** to UI metadata — derive from existing
   `permissions.{role}.write` at render time. Avoids duplicating permission
   data already present in the schema.
2. **Dashboard/landing NOT schema-driven** — dedicated render functions.
   Per ADR-009: they're simple views that don't benefit from the form renderer.
3. **Schema caching:** ETag + `Cache-Control` on server; session-level cache
   in `state.mjs` on client. Refresh on version mismatch.
4. **Incremental migration:** App works after each session with a mix of old
   server-rendered views and new client-rendered views.
5. **`updateFieldValue` relocation:** Move from `template-engine.mjs` to
   `public/utils/dom.mjs` in Session 2, before `template-engine.mjs` is
   deleted in Session 4.

---

## Cross-Cutting Concerns

### `editable.mjs` → `template-engine.mjs` coupling

`updateFieldValue()` is imported from `template-engine.mjs` by `editable.mjs`.
Must relocate to `public/utils/dom.mjs` in Session 2 before the template
engine is removed in Session 4.

### Client validation schema duplication

`public/validation/schema.mjs` partially duplicates `CHARACTER_SCHEMA`.
After the schema endpoint exists, the client should use the served schema.
`public/validation/engine.mjs` and `public/validation/ui.mjs` remain — they
are generic validators that operate on any schema object.

### Behavior system compatibility

Behaviors are decoupled — they process `data-behavior` attributes on any DOM.
The form renderer must emit the same attribute values the templates emit.
`enhanceElement()` and `cleanupBehaviors()` are called by views — no changes
needed.

### SSE integration

Current: SSE → `setCurrentCharacter()` → `notifyChangedPaths()` →
`subscribeField` callbacks → `updateFieldValue()`. New: same flow, but
`updateFieldValue()` lives in a utility. The reactive state system needs no
changes.

### Response sanitization gaps

`sanitizeCharacterForRole()` only strips top-level fields — doesn't respect
`hidden` or permission-gated nested fields. Not a Phase 3 blocker. Tracked
in Phase 5.

---

## Session 1 — Schema Foundation + Client Form Renderer

**Goal:** Build the entire foundation — schema UI metadata, server endpoint,
and client renderer — without breaking any existing functionality. All additive.

### 1a. Server: Expand SchemaFieldUI

- [x] Expand `SchemaFieldUI` interface in `src/types.mts`:
  - `section: string` — section ID from registry
  - `displayAs?: string` — render hint: `"input"` | `"number"` | `"select"` |
    `"textarea"` | `"readonly"`
  - `component?: string` — override renderer: `"portrait"` | `"ability-list"` |
    `"sin-list"` | `"spell-list"` etc.
  - `options?: unknown[]` — for select fields
  - Keep existing: `label`, `placeholder`, `help`, `order`, `hidden`,
    `quickActions`

### 1b. Server: Section Registry

- [x] Define section registry (in `src/models/character.mts` or a new
  `src/models/sections.mts`):
  ```
  SECTIONS = [
    { id: "portrait",             label: "Portrait",             order: 1  },
    { id: "attributes.primary",   label: "Primary Attributes",   order: 2  },
    { id: "attributes.secondary", label: "Secondary Attributes", order: 3  },
    { id: "combat",               label: "Combat",               order: 4  },
    { id: "experience",           label: "Experience",           order: 5  },
    { id: "traits",               label: "Traits",               order: 6  },
    { id: "traditions",           label: "Traditions",           order: 8  },
    { id: "talents",              label: "Talents",              order: 9  },
    { id: "information",          label: "Information",          order: 11 },
    { id: "equipment",            label: "Equipment",            order: 12 },
    { id: "background",           label: "Background",           order: 13 },
  ]
  ```
  Section list is preliminary — align with the template TEXTS structure during
  implementation.

### 1c. Server: UI Metadata on CHARACTER_SCHEMA

- [x] Add `ui` metadata to every field in `CHARACTER_SCHEMA` (~60+ fields):
  - Server-controlled fields: `ui: { hidden: true }`
  - Primary attributes: `ui: { section: "attributes.primary", label: "…", order: N, displayAs: "number" }`
  - Secondary (derived) attributes: `ui: { section: "attributes.secondary", displayAs: "readonly" }`
  - Array fields (traits, talents): `ui: { section: "traits", component: "trait-list" }`
  - Use the template `TEXTS` objects as the canonical source for labels and
    section assignments.

### 1d. Server: Schema Serializer + Endpoint

- [x] Build `serializeSchema(schema)` — walk `CHARACTER_SCHEMA` and produce a
  JSON-safe representation:
  - Strip functions (`validate`)
  - Convert `RegExp` patterns to strings
  - Preserve `permissions`, `ui`, `type`, `required`, `min`, `max`, `default`, etc.
- [x] Add `GET /api/v1/schema` route in `src/app.mts`:
  - Response: `{ fields: {…}, sections: […], version: <schemaVersion> }`
  - Headers: `ETag` (schema hash or static version), `Cache-Control: public, max-age=86400`

### 1e. Client: Form Renderer

- [x] Build `public/renderers/form-renderer.mjs`:
  - `renderCharacterForm(schema, data, role, mode) → DOM`
  - `mode`: `"view"` (character sheet) or `"create"` (creation form)
  - Groups fields by `ui.section`
  - Sorts sections by registry `order`, fields within section by `ui.order`
  - Delegates to `renderField()` or component override per `ui.component`
  - Emits `data-path`, `data-behavior`, `data-role-allowed` attributes
  - Skips `hidden` fields
  - Returns `<form>` with `data-mode`, `data-character-id`, `data-role`

### 1f. Client: Field Component

- [x] Implement `public/components/form-field.mjs`:
  - `renderField(path, fieldSchema, value, role) → DOM`
  - Handles `displayAs` variants: `input`, `number`, `select`, `textarea`, `readonly`
  - Applies validation attributes (`min`, `max`, `minLength`, `maxLength`, `pattern`)
  - Sets `name` / `data-path`
  - Sets `data-behavior="edit-enabled"` when field is writable for role

### 1g. Client: Section Rendering + Component Override Registry

- [x] Build section rendering infrastructure (inline in form-renderer or
  separate `public/renderers/section-renderer.mjs`)
- [x] Stub component override registry:
  `{ "portrait": renderPortrait, "ability-list": renderAbilityList, … }`
  Full implementations deferred to Session 2.

### 1h. Client: Schema Fetching & State

- [x] Add `getSchema()` to `public/api.mjs`
- [x] Add `state.schema` to `public/state.mjs` — populated on first fetch,
  cached for session lifetime

### Verification

- [x] `npm run typecheck` passes
- [x] Server starts; existing views still work (nothing removed)
- [x] `GET /api/v1/schema` returns well-formed JSON with all fields and sections
- [x] Form renderer can be tested in browser console:
  `renderCharacterForm(schema, charData, "owner", "view")` returns valid DOM
- [x] No regressions in existing HTML views

### Session Closeout

- [x] Update `docs/roadmap.md`: check off Step 1 items that are done
- [x] Update `docs/phase3-plan.md`: record actual decisions, deviations,
  and anything discovered during implementation
- [x] Update `/memories/repo/character-builder.md` with new file locations,
  subpath imports, and any convention changes
- [x] Create `/memories/repo/phase3-progress.md` summarizing:
  - Session 1 deliverables and their file locations
  - Schema endpoint details (path, response shape, caching)
  - Form renderer API (`renderCharacterForm` signature, component registry)
  - Any open questions or deviations from this plan
  - What Session 2 should start with

> **Note:** Progress info was recorded directly in
> `/memories/repo/character-builder.md` rather than a separate
> `phase3-progress.md` file — keeps all repo context in one place.

---

## Session 2 — Character View Migration

**Goal:** Replace the character view (the most complex view) with
schema-driven rendering. Remove the server character template and view endpoint.
SSE updates flow through the new pipeline.

### 2a. Component Overrides

- [x] Implement `public/components/portrait.mjs`:
  - Portrait preview with crop transform OR upload placeholder
  - Reuse pan/zoom logic from `public/behaviors/portraitHandler.mjs`
- [x] Implement `public/components/trait-list.mjs`:
  - Learned traits with tier/level display
  - Add/remove trait UI; fetches library from `GET /api/v1/abilities`
- [x] Implement `public/components/talent-list.mjs`:
  - Talent slots, add/remove (DM/owner only)
- [ ] Implement ritual-list component
  (possibly generic "reference-list" pattern)
- [ ] Implement equipment section components (weapons, armor, inventory)

### 2b. Character View Rewrite

- [x] Rewrite `public/views/character-view.mjs`:
  - Fetch schema (from cache or API) + character JSON
  - Determine role from `_permissions.role`
  - Call `renderCharacterForm(schema, data, role, "view")`
  - Attach behaviors via `enhanceElement()`
  - Connect SSE stream
- [x] Wire SSE updates through new pipeline:
  - `setCurrentCharacter(newData)` → `notifyChangedPaths()` → subscriptions
- [x] Decouple `editable.mjs` from `template-engine.mjs`:
  - Move `updateFieldValue()` to `public/utils/dom.mjs`
  - Update imports in `editable.mjs` and anywhere else that uses it

### 2c. Server Cleanup (Character View Only)

- [x] Remove `GET /api/v1/view/character/:id` endpoint from `src/app.mts`
- [x] Remove `src/templates/character.mts`
- [x] Remove `src/renderers/renderCharacterView.mts`
- [x] Remove `src/routes/characterViewRoutes.mts`
- [x] Remove `src/routes/handleGetCharacterView.mts`
- [x] Update barrel exports (`src/renderers/index.mts`, `src/routes/handlers.mts`)

### Verification

- [x] Character view loads from JSON + schema, renders correctly
  (functional: loads and renders all sections; CSS compatibility deferred —
  see Session 2.5)
- [x] All fields display with correct values
- [x] Editable fields: click → edit → blur → PATCH → SSE broadcast
- [x] Portrait displays with correct crop transform
- [~] Traits, talents display correctly — **N/A:** no existing characters have
  traits or talents. Add/remove UI was never functional pre-schema-renderer.
  Components render correct empty states ("No traits learned", "No talents").
  Will verify with real data when trait/talent management is implemented.
- [x] SSE real-time updates (two tabs: edit in one, see update in other)
- [ ] Role-based editability (owner, DM, public) — **deferred:** DM login
  requires env file; owner editability verified, DM/public deferred to Phase 5
  hardening
- [x] Dashboard and initial views still work (still server HTML)
- [x] `npm run typecheck` passes

### Deviations & Open Questions

1. **CSS / DOM structural mismatch (critical).** The schema-driven renderer
   produces 15 flat `<section>` elements where the existing CSS expects 5
   semantic groups (`attributes`, `talents`, `portrait`, `traits`,
   `information`) each with internal sub-structure (`div#primary`,
   `div#secondary`, `div#main`, `div#mystic`, `div#social`). The CSS uses
   a named 5-area grid (`grid-template-areas`) and anchor positioning
   (`position: fixed; position-anchor: --portrait`) that depend on this
   structure. The renderer currently breaks the character-view layout.
   **Resolution:** Session 2.5 added below to restructure the section
   registry and renderer before Session 3.

2. **Lost `<nav>` sidebar.** The old template included a `<nav>` element
   outside `<form>` with section jump links. The form renderer only
   produces `<form>` content. The nav must be generated by
   `character-view.mjs` or become part of the renderer's output.

3. **Unnecessary `.schema-section` class** on all sections. Per ADR-012,
   type-based selectors should be preferred. The class adds no value when
   sections can be targeted via `section[data-section]` or just `section`
   within a `@scope`. Remove in Session 2.5.

4. **`character-form` class on unique form.** The form already has
   `id="character-form"`. Redundant class removed.

5. **Renderer changes kept:**
   - `form.id = "character-form"` — needed for CSS targeting
   - `div.input` / `div.textarea` wrapper classes — matches existing CSS
     field wrapper selectors (not `div.form-field`)
   - `section.id` from `sectionConfig.id` — needed for CSS targeting
   - `h3` heading level — matches existing CSS heading selectors
     (h3 inside character-view scope = `var(--header-36)` gold)

6. **CSS changes reverted.** All CSS modifications (form grid override,
   section placement rules, experience position override, label fixes)
   were reverted. CSS must be approached through a planned audit, not
   sporadic patches. The character-view CSS remains as-is from the
   pre-schema-renderer state.

### Session Closeout

- [x] Update `docs/roadmap.md`: check off Step 2 items
- [x] Update `docs/phase3-plan.md`: record deviations, open questions
- [x] Update `/memories/repo/character-builder.md` with removed files,
  new component locations, modified barrel exports

> **Note:** Progress recorded in `/memories/repo/character-builder.md`
> rather than a separate `phase3-progress.md` file, same as Session 1.

---

## Session 2.5 — Renderer Restructuring & CSS Compatibility

**Goal:** Restructure the section registry and form renderer to produce DOM
that matches the existing CSS grid structure. Restore the 5 semantic
parent-section grouping. Perform a focused CSS compatibility pass to make
the character view visually functional.

**Must precede:** Session 3 (creation view reuses the same renderer).

### Problem Statement

The existing CSS (in `@scope (main#creation-view, main#character-view)`)
defines a 5-area named grid:

```
grid-template-areas:
  "attributes talents portrait information information"
  "traits traits traits information information";
```

Each area corresponds to a semantic `<section>` with internal sub-structure:

| CSS target | Expected DOM | Schema equivalent |
|---|---|---|
| `section#attributes` | `h3` + `output` + `div#primary` (8 inputs) + `div#secondary` (6 outputs) | `attributes.primary` + `attributes.secondary` |
| `section#talents` | `h3` + `ul` of talent items | `talents` |
| `section#portrait` | label + file input + preview | `portrait` |
| `section#traits` | `h3` + `output` + `ul` of trait items | `traits` |
| `section#information` | `h3` + `div#main` (personal + equipment) + `div#mystic` + `div#social` | `information` + `equipment` + `combat` + `experience` + `corruption` + `background` |

The character view also has:
- `div#character-name` — fixed-position name banner (outside sections)
- `<nav>` — section jump links (outside form)
- `section#experience` — anchor-positioned below portrait

The renderer currently produces 15 flat sections that don't match any of this.

### Approach: Two-Level Section Hierarchy

Restructure `SCHEMA_SECTIONS` into a parent/child model:

```typescript
interface SchemaSection {
  id: string;
  label: string;
  order: number;
  parent?: string;  // parent section ID, omitted for top-level
}
```

Top-level sections (rendered as `<section id="...">` with `grid-area`):

| ID | Label | Grid area | Children |
|---|---|---|---|
| `attributes` | Attributes | `attributes` | `attributes.primary`, `attributes.secondary` |
| `talents` | Talents | `talents` | (direct field: talents) |
| `portrait` | Portrait | `portrait` | (component override) |
| `traits` | Traits | `traits` | (direct field: traits) |
| `information` | Information | `information` | `combat`, `experience`, `corruption`, `equipment`, `background` |

Child sections render as `<div>` or sub-`<section>` inside their parent,
with IDs matching CSS expectations (`div#primary`, `div#secondary`,
`div#mystic`, `div#social`, etc.).

The form renderer gains a two-pass approach:
1. Collect top-level sections and their children
2. Render each top-level section, nesting children inside it

### Future potential

This two-level rendering architecture could later be generalized for
non-schema views (dashboard, initial) if the parent/child model proves
flexible enough. This should be evaluated but is **not a goal** of this
session — we avoid speculative generalization.

### Tasks

- [x] Restructure `SCHEMA_SECTIONS` to include `parent` property
- [x] Add top-level parent sections to the registry
- [x] Update `SchemaSection` interface in `src/types.mts`
- [x] Update form renderer: two-pass rendering (parents → children)
- [x] Update section renderer: handle child sections as sub-elements
- [x] Remove `.schema-section` class from sections (use type selectors)
- [x] Generate `<nav>` with section jump links in character-view.mjs
- [x] Generate `div#character-name` in character-view.mjs
- [x] CSS compatibility pass: targeted adjustments to make the new DOM
      work with existing CSS selectors (documented, not sporadic patches)
- [x] Verify character view renders with correct layout at 1920px
- [x] Verify creation view (still server-rendered) is unaffected
- [x] `npm run typecheck` passes

### CSS Approach

CSS changes in this session are **compatibility adjustments only** — making
the new renderer DOM work with existing CSS selectors. They should be:
- Clearly commented with rationale
- Minimal: override only what the structural change broke
- Preserving: comment out replaced rules rather than deleting them
- Documented in this plan with before/after comparison

A full CSS audit and modernization is deferred to Phase 8 (Polish).

---

## Session 3 — Creation View Migration

**Goal:** Reuse the form renderer in creation mode. Wire attribute budget
tracking and form validation.

### 3a. Creation Mode in Form Renderer

- [ ] Extend form renderer for `mode: "create"`:
  - Owner-writable fields become editable inputs
  - Required fields get `required` attribute
  - No `data-character-id` (doesn't exist yet)
  - Secondary attributes: readonly, auto-calculated from primary
  - Derived fields hidden or shown as placeholders

### 3b. Attribute Budget + Secondary Calculation

- [ ] Wire attribute budget calculator:
  - Listen to primary attribute input changes
  - Display remaining budget (80 − total)
  - Recalculate secondary attributes from primary on change
  - Reuse RPG formulas from `public/utils/rpg.mjs` or
    `public/validation/engine.mjs`

### 3c. Form Validation Integration

- [ ] Update `FormValidator` (`public/validation/ui.mjs`) to work with
  renderer-generated DOM:
  - Ensure renderer sets `name` attribute on creation-mode fields
  - Or update `FormValidator` to use `data-path`

### 3d. Creation View Rewrite

- [ ] Rewrite `public/views/creation-view.mjs`:
  - Fetch schema → `renderCharacterForm(schema, {}, "owner", "create")`
    with empty data (defaults from schema)
  - Wire portrait upload handler
  - Wire form submission: validate → POST → navigate to character view
  - Wire attribute budget display

### 3e. Server Cleanup (Creation View)

- [ ] Remove `GET /api/v1/view/creation` endpoint from `src/app.mts`
- [ ] Remove `src/templates/creation.mts`
- [ ] Remove `src/renderers/renderCreationView.mts`
- [ ] Update `src/renderers/index.mts` barrel

### Verification

- [ ] Creation form renders from schema
- [ ] All required fields present and marked required
- [ ] Attribute budget tracking works (sum = 80)
- [ ] Secondary attributes auto-calculate on primary change
- [ ] Portrait upload works in creation mode
- [ ] Form submission creates character correctly
- [ ] Post-creation, character view loads with correct data
- [ ] `npm run typecheck` passes

### Session Closeout

- [ ] Update `docs/roadmap.md`: check off Step 3 items
- [ ] Update `docs/phase3-plan.md`: record deviations
- [ ] Update `/memories/repo/character-builder.md` with removed files
- [ ] Update `/memories/repo/phase3-progress.md`:
  - Session 3 deliverables
  - Creation-mode renderer details
  - Budget/validation integration approach
  - Removed server files
  - What Session 4 should start with

---

## Session 4 — Dashboard + Landing + Final Cleanup

**Goal:** Migrate remaining views, remove all server rendering infrastructure.

### 4a. Dashboard View

- [ ] Rewrite `public/views/dashboard-view.mjs`:
  - Fetch character list from `GET /api/v1/characters?playerId=…`
  - Render character cards client-side via expanded
    `public/components/character-card.mjs`
  - Port `scaleCropForContainer()` from `src/templates/dashboard.mts`
  - Wire action buttons (create, view)

### 4b. Landing Page

- [ ] Rewrite `public/views/initial-view.mjs`:
  - Render entirely client-side (static content + behavior wiring)
  - Port content from `src/templates/initial.mts` TEXTS object
  - Wire CREATE button, recovery modal

### 4c. Final Server Cleanup

- [ ] Remove view endpoints from `src/app.mts`:
  - `GET /api/v1/view/dashboard`
  - `GET /api/v1/view/initial`
- [ ] Delete `src/templates/` directory entirely (all 4 files)
- [ ] Delete `src/renderers/` directory entirely (barrel + renderer files)
- [ ] Remove `#renderers` subpath import from `package.json`
- [ ] Remove `handleGetCharacterView` from `src/routes/handlers.mts`

### 4d. Final Client Cleanup

- [ ] Delete `public/template-engine.mjs`
- [ ] Remove `templates` alias from `public/index.html` import map
- [ ] Remove `fetchView()` from `public/api.mjs`
- [ ] Remove template caching from `public/state.mjs`
  (`getTemplate`, `cacheTemplate`, `getCachedTemplate`)
- [ ] Remove `public/validation/schema.mjs` — replaced by served schema

### Verification

- [ ] Full end-to-end: landing → create → dashboard → character view →
  edit → SSE update
- [ ] No 404s on removed endpoints (client no longer calls them)
- [ ] No dead imports or references to removed files
- [ ] `npm run typecheck` passes

### Session Closeout

- [ ] Update `docs/roadmap.md`: mark Phase 3 as DONE, check off all Step items
- [ ] Update `docs/phase3-plan.md`: mark as completed, record final notes
- [ ] Update `/memories/repo/character-builder.md`:
  - `#renderers` alias removed
  - New client file locations (renderers, components)
  - Template engine and template caching removed
  - Schema endpoint documented
  - Phase 3 marked complete; next up: Phase 4
- [ ] Delete `/memories/repo/phase3-progress.md` (no longer needed)
- [ ] Record any new deferred tasks discovered during Phase 3 in
  `docs/deferred-tasks.md`

---

## File Reference

### Server — to modify

| File | Session | Change |
|------|---------|--------|
| `src/types.mts` | 1 | Expand `SchemaFieldUI` |
| `src/models/character.mts` | 1 | Add `ui` metadata, section registry |
| `src/app.mts` | 1–4 | Add schema endpoint (1), remove view endpoints (2–4) |
| `src/renderers/index.mts` | 2–4 | Update barrel, eventually delete |
| `src/routes/handlers.mts` | 2, 4 | Remove view handler exports |
| `package.json` | 4 | Remove `#renderers` subpath |

### Server — to delete

| File | Session |
|------|---------|
| `src/templates/character.mts` | 2 |
| `src/renderers/renderCharacterView.mts` | 2 |
| `src/routes/characterViewRoutes.mts` | 2 |
| `src/routes/handleGetCharacterView.mts` | 2 |
| `src/templates/creation.mts` | 3 |
| `src/renderers/renderCreationView.mts` | 3 |
| `src/templates/dashboard.mts` | 4 |
| `src/templates/initial.mts` | 4 |
| `src/renderers/renderDashboardView.mts` | 4 |
| `src/renderers/renderInitialView.mts` | 4 |
| `src/renderers/index.mts` | 4 |

### Client — to create

| File | Session |
|------|---------|
| `public/renderers/form-renderer.mjs` | 1 |
| `public/renderers/section-renderer.mjs` | 1 (if separate) |
| `public/components/portrait.mjs` | 2 |
| `public/components/trait-list.mjs` | 2 |
| `public/components/talent-list.mjs` | 2 |

### Client — to modify

| File | Session | Change |
|------|---------|--------|
| `public/api.mjs` | 1, 4 | Add `getSchema()` (1), remove `fetchView()` (4) |
| `public/state.mjs` | 1, 4 | Add schema state (1), remove template caching (4) |
| `public/components/form-field.mjs` | 1 | Implement (currently empty) |
| `public/components/character-card.mjs` | 4 | Expand for dashboard |
| `public/views/character-view.mjs` | 2 | Rewrite |
| `public/views/creation-view.mjs` | 3 | Rewrite |
| `public/views/dashboard-view.mjs` | 4 | Rewrite |
| `public/views/initial-view.mjs` | 4 | Rewrite |
| `public/behaviors/editable.mjs` | 2 | Decouple from template-engine |
| `public/utils/dom.mjs` | 2 | Receive `updateFieldValue()` |
| `public/validation/ui.mjs` | 3 | Adapt to renderer DOM |

### Client — to delete

| File | Session |
|------|---------|
| `public/template-engine.mjs` | 4 |
| `public/validation/schema.mjs` | 4 |
