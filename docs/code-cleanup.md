
## 4. Client Code Hygiene (Phase 5 / Phase 8)

Discovered during Phase 3 Session 4. Low urgency — note for future cleanup.

### 4a. Extract inline DOM builders from render functions

`dashboard-view.mjs` and `initial-view.mjs` have inline helper functions
(`buildWelcomeBlock`, `buildContactsBlock`, `buildMenuBlock`,
`buildCharacterGrid`, error-state block) that construct standalone DOM
fragments. These clog the view files with presentational logic.

**Action:** Audit client views and renderers for similar inline builders.
Consider extracting reusable ones into `public/components/` or as shared
builder functions in `public/utils/dom.mjs`.

### 4b. Extract displayable text constants for l10n

`dashboard-view.mjs` and `initial-view.mjs` have hardcoded English strings
(headings, descriptions, button labels, contact data). Future l10n support
(at minimum EN + RU) requires all user-visible text to live in a central
location.

**Action:** Define a text/locale system and extract all client-side display
strings into it. Applies to all views, components, and error messages.

### 4c. Deduplicate `getNestedValue` utility

Four independent copies exist:

| File | Signature | Notes |
|------|-----------|-------|
| `public/state.mjs` (line 4) | `getNestedValue(obj, path)` | Module-private, inlined during Session 4 |
| `public/renderers/section-renderer.mjs` (line 113) | `getNestedValue(obj, path)` | Module-private |
| `public/validation/engine.mjs` (line 244) | `getNestedValue(obj, path)` | Module-private |
| `public/validation/engine.mjs` (line 82) | `hasPathInSchema(schema, path)` | Same pattern, returns boolean |

All do `path.split(".").reduce(…)` with minor guard variations.

**Action:** Extract a single `getNestedValue` into `public/utils/object.mjs`
(or `public/utils/dom.mjs`) and import it everywhere. `hasPathInSchema` can
call it internally.