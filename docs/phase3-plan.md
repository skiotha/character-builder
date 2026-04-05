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
    { id: "abilities",            label: "Abilities",            order: 6  },
    { id: "spells",               label: "Spells",               order: 7  },
    { id: "traditions",           label: "Traditions",           order: 8  },
    { id: "sins",                 label: "Sins",                 order: 9  },
    { id: "boons",                label: "Boons",                order: 10 },
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
  - Array fields (abilities, spells, sins): `ui: { section: "abilities", component: "ability-list" }`
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
- [ ] Form renderer can be tested in browser console:
  `renderCharacterForm(schema, charData, "owner", "view")` returns valid DOM
- [x] No regressions in existing HTML views

### Session Closeout

- [ ] Update `docs/roadmap.md`: check off Step 1 items that are done
- [ ] Update `docs/phase3-plan.md`: record actual decisions, deviations,
  and anything discovered during implementation
- [ ] Update `/memories/repo/character-builder.md` with new file locations,
  subpath imports, and any convention changes
- [ ] Create `/memories/repo/phase3-progress.md` summarizing:
  - Session 1 deliverables and their file locations
  - Schema endpoint details (path, response shape, caching)
  - Form renderer API (`renderCharacterForm` signature, component registry)
  - Any open questions or deviations from this plan
  - What Session 2 should start with

---

## Session 2 — Character View Migration

**Goal:** Replace the character view (the most complex view) with
schema-driven rendering. Remove the server character template and view endpoint.
SSE updates flow through the new pipeline.

### 2a. Component Overrides

- [ ] Implement `public/components/portrait.mjs`:
  - Portrait preview with crop transform OR upload placeholder
  - Reuse pan/zoom logic from `public/behaviors/portraitHandler.mjs`
- [ ] Implement `public/components/ability-list.mjs`:
  - Learned abilities with tier/level display
  - Add/remove ability UI; fetches library from `GET /api/v1/abilities`
- [ ] Implement `public/components/sin-list.mjs`:
  - Sin slots, add/remove (DM/owner only)
- [ ] Implement spell-list, boon-list, ritual-list components
  (possibly generic "reference-list" pattern)
- [ ] Implement equipment section components (weapons, armor, inventory)

### 2b. Character View Rewrite

- [ ] Rewrite `public/views/character-view.mjs`:
  - Fetch schema (from cache or API) + character JSON
  - Determine role from `_permissions.role`
  - Call `renderCharacterForm(schema, data, role, "view")`
  - Attach behaviors via `enhanceElement()`
  - Connect SSE stream
- [ ] Wire SSE updates through new pipeline:
  - `setCurrentCharacter(newData)` → `notifyChangedPaths()` → subscriptions
- [ ] Decouple `editable.mjs` from `template-engine.mjs`:
  - Move `updateFieldValue()` to `public/utils/dom.mjs`
  - Update imports in `editable.mjs` and anywhere else that uses it

### 2c. Server Cleanup (Character View Only)

- [ ] Remove `GET /api/v1/view/character/:id` endpoint from `src/app.mts`
- [ ] Remove `src/templates/character.mts`
- [ ] Remove `src/renderers/renderCharacterView.mts`
- [ ] Remove `src/routes/characterViewRoutes.mts`
- [ ] Remove `src/routes/handleGetCharacterView.mts`
- [ ] Update barrel exports (`src/renderers/index.mts`, `src/routes/handlers.mts`)

### Verification

- [ ] Character view loads from JSON + schema, renders correctly
- [ ] All fields display with correct values
- [ ] Editable fields: click → edit → blur → PATCH → SSE broadcast
- [ ] Portrait displays with correct crop transform
- [ ] Abilities, sins display correctly
- [ ] SSE real-time updates (two tabs: edit in one, see update in other)
- [ ] Role-based editability (owner, DM, public)
- [ ] Dashboard and initial views still work (still server HTML)
- [ ] `npm run typecheck` passes

### Session Closeout

- [ ] Update `docs/roadmap.md`: check off Step 2 items
- [ ] Update `docs/phase3-plan.md`: record deviations, open questions
- [ ] Update `/memories/repo/character-builder.md` with removed files,
  new component locations, modified barrel exports
- [ ] Update `/memories/repo/phase3-progress.md`:
  - Session 2 deliverables and file locations
  - Component override API and registry
  - `updateFieldValue` new location
  - Removed server files
  - Any gaps in component implementations (partial overrides, etc.)
  - What Session 3 should start with

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
| `public/components/ability-list.mjs` | 2 |
| `public/components/sin-list.mjs` | 2 |

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
