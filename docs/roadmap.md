# Nagara Character Builder — Roadmap

> Multi-session work plan. Each phase is self-contained and leaves the project
> in a working state. Phases can span multiple sessions but should not be
> left half-finished.
>
> See also: [.github/ROADMAP.md](../.github/ROADMAP.md) for the summary.

---

## Phase 0 — Documentation & Decisions ✓ DONE

**Goal:** Cement what exists, why it exists, and what's changing — before
touching code.

- [x] `docs/architecture.md` — system overview, component diagram, layers
- [x] `docs/data-contracts.md` — character schema, API contracts, cross-project shapes
- [x] `docs/decisions/001-zero-dependencies.md`
- [x] `docs/decisions/002-file-based-storage.md`
- [x] `docs/decisions/003-self-asserted-identity.md`
- [x] `docs/decisions/004-hybrid-spa-server-views.md`
- [x] `docs/decisions/005-sse-realtime.md`
- [x] `docs/decisions/006-project-restructure.md`
- [x] `docs/decisions/007-strict-cors.md`
- [x] `docs/decisions/008-typescript-strip-types.md`
- [x] `docs/decisions/009-schema-driven-rendering.md`
- [x] `docs/decisions/010-effect-resolution-pipeline.md`
- [x] `docs/decisions/011-typed-effect-targets.md`
- [x] `docs/decisions/012-standards-first-html-css.md`
- [x] `docs/roadmap.md` — this file
- [x] `.github/ROADMAP.md` — summary
- [x] `.github/copilot-instructions.md` — agent configuration

**Deliverable:** Complete reference documentation. Every subsequent phase
has a written basis for its decisions.

---

## Phase 1 — Project Restructure ✓ DONE

**Goal:** Professional directory layout. No behavior changes. All tests (even if minimal) must pass before and after.

**Basis:** [ADR-006](decisions/006-project-restructure.md)

- [x] Create target directory structure (`src/`, `public/`, `data/`, `config/`,
      `scripts/`, `test/`)
      _(`rpg/` added later as the canonical RPG rules vault — see §3.9 in architecture.md)_
- [x] Move server source: `server/nagara/*` → `src/`
- [x] Move server bootstrap: `server/server.mjs` → `src/server.mts`,
      `server/config.mjs` → `src/lib/config.mts`, etc.
- [x] Move client: `client/` → `public/`, `assets/` → `public/assets/`
- [x] Move runtime data: `server/data/` → `data/`
- [x] Move watcher: `server/watcher.js` → `scripts/watcher.mts`
- [x] Move tests: `server/tests/` → `test/`
- [x] Update `package.json` imports map for new paths (drop '@' from the client's import map)
- [x] Update `index.html` import map for new public structure
- [x] Update `README.md` with new project structure
- [x] Verify the server starts and serves pages correctly
- [x] Single commit for the entire restructure

**Deliverable:** Cleanly-organized project that runs identically to before.

---

## Phase 2 — TypeScript Migration ✓ DONE

**Goal:** `.mts` files with strong typing. Node 24 engine.

**Basis:** [ADR-008](decisions/008-typescript-strip-types.md)

- [x] Add `tsconfig.json` (mirrors mychar/malizia)
- [x] Add `@types/node` devDependency
- [x] Update `package.json` engine to `">=24.0.0"`
- [x] Update `package.json` scripts (strip-types removed — default in Node 24+)
- [x] Rename files `.mjs` → `.mts` (done in Phase 1 restructure)
- [x] Define core interfaces:
  - [x] `Character` — full character object (`src/rpg-types.mts`)
  - [x] `CharacterIndex` — index.json structure (`src/types.mts`)
  - [x] `SchemaField` — schema definition shape (`src/types.mts`)
  - [x] `Effect`, `Trait` — sub-objects (`src/rpg-types.mts`)
  - [x] `Request`, `Response` extensions (`NagaraRequest` in `src/types.mts`)
- [x] Add type annotations to leaf modules: `config`, `logger`, `auth`, `utils`
- [x] Add type annotations to models: `storage`, `schema`, `traversal`, `validation`
- [x] Add type annotations to rules: `attributes`, `applicator`, `derived`
- [x] Add type annotations to handlers and routes
- [x] Add type annotations to middleware, SSE, renderers
- [x] Run `npm run typecheck` clean
- [x] Split types: `src/rpg-types.mts` (RPG domain) + `src/types.mts` (app infra)
- [x] Barrel files: `src/rules/index.mts`, `src/renderers/index.mts` created
- [x] Subpath import aliases: `#types`, `#rpg-types`, `#renderers`, `#models/*`

**Notes:**
- Templates (`src/templates/`) have `@ts-nocheck` — minimal investment since
  they are being removed in Phase 3. Full typing deferred to Phase 3 cleanup.
- Middleware chain type mismatch identified and documented — deferred to Phase 5
  (see Medium Priority).

### Schema Review (gate before Phase 3) ✓ DONE

Before extending the schema with UI metadata, review and stabilize its
data structure. This requires domain context from the RPG rules.

- [x] Walk through every top-level section with RPG rules reference in hand:
  - [x] `attributes` — added `armor` and `corruptionMax` derived stats
  - [x] `traits` / `effects` — replaced `traits` with `abilities`, `spells`,
        `rituals`, `boons`, `sins` (reference-based model); later merged
        abilities+spells→traits, sins+boons→talents with source discriminators
  - [x] `equipment` — flattened `professional` → `assassin`/`tools`,
        renamed `inventory.self` → `carried`, armor body/plug are object|null
  - [x] `background` — reviewed, no changes needed
  - [x] `corruption` / `experience` — reviewed, no changes needed
  - [x] `assets` → renamed to `affiliations` (array of `{ name, reputation }`)
- [x] Identify fields that were added ad-hoc and may belong elsewhere
- [x] Identify fields that exist in the schema but are never populated
- [x] Check whether the `Character` interface exposes any structural awkwardness
- [x] Rework permission model: replaced boolean `true`/`false` with separate
      `{ read, write }` permissions per role
- [x] Update `data-contracts.md` §1 to reflect schema changes
- [x] Migrate existing character JSON files to new schema shape
- [x] Added `combat` section (derived from equipped weapons)
- [x] Added `traditions` (array, replaces singular `tradition`)
- [x] Added `schemaVersion` field

> **Why here:** Phase 3 bakes the schema into the UI via metadata. Any
> structural changes after that point require updating both the data schema
> and the UI metadata. Fix the foundation first.

**Deliverable:** Fully typed codebase. `tsc` passes with zero errors.
Schema structure reviewed and stabilized for Phase 3.

---

## Phase 3 — Schema-Driven Rendering

**Goal:** Replace server-rendered HTML templates with schema-driven client
rendering. Single rendering path for initial load and SSE updates.

**Basis:** [ADR-009](decisions/009-schema-driven-rendering.md)
(supersedes [ADR-004](decisions/004-hybrid-spa-server-views.md))

**Detailed plan:** [phase3-plan.md](../.github/plans/phase3-plan.md) — session-by-session
breakdown with file references, verification steps, and session closeout
checklists.

### Step 1 — Schema & Renderer Foundation (Session 1) ✓ DONE

- [x] Expand `SchemaFieldUI` in `src/types.mts` with `section`, `displayAs`,
      `component`, `options`
- [x] Define section registry (visual grouping and sort order)
- [x] Add `ui` metadata to every field in `CHARACTER_SCHEMA`
- [x] Build `serializeSchema()` (JSON-safe schema representation)
- [x] Add `GET /api/v1/schema` endpoint (ETag-cacheable)
- [x] Build generic client form renderer: `(schema, data, role, mode) → DOM`
  - [x] Iterates schema fields grouped by section
  - [x] Generates inputs with `data-path`, `data-behavior`, `data-role-allowed`
  - [x] Respects `hidden`, permissions, `displayAs` metadata
  - [x] Supports component overrides for non-standard sections
- [x] Implement `public/components/form-field.mjs`
- [x] Add `getSchema()` to `public/api.mjs` + schema state
- [x] Stub component override registry

### Step 2 — Character View Migration (Session 2) ✓ DONE

- [x] Implement component overrides (portrait, traits, talents — core set;
      equipment remain stubs)
- [x] Rewrite `character-view.mjs` to fetch JSON + schema, render client-side
- [x] Wire SSE updates through same rendering pipeline
- [x] Decouple `editable.mjs` from `template-engine.mjs`
      (move `updateFieldValue()` to `public/utils/dom.mjs`)
- [~] Verify role-based editability — owner verified; DM/public deferred
      (DM login requires local env file, tracked in Phase 5)
- [x] Remove `GET /api/v1/view/character/:id` endpoint
- [x] Remove `src/templates/character.mts`
- [x] Remove `src/renderers/renderCharacterView.mts`
- [x] Remove `src/routes/characterViewRoutes.mts` +
      `src/routes/handleGetCharacterView.mts`

### Step 2.5 — Renderer Restructuring & CSS Compatibility ✓ DONE

The schema-driven renderer produces 15 flat sections; CSS expects 5 semantic
groups (`attributes`, `talents`, `portrait`, `traits`, `information`) with
internal sub-structure. A two-level section hierarchy (parent/child) is
needed to produce DOM that matches the CSS grid. Also restores lost `<nav>`
and `div#character-name`. See [phase3-plan.md § Session 2.5](../.github/plans/phase3-plan.md)
for full details.

- [x] Restructure section registry with parent/child model
- [x] Two-pass rendering in form renderer
- [x] CSS compatibility pass (targeted, documented adjustments only)
- [x] Restore `<nav>` and `div#character-name`

> **Also completed alongside 2.5:** Merged character data fields —
> `abilities`+`spells` → `traits` (with `source` discriminator),
> `sins`+`boons` → `talents` (with `source` discriminator). Component
> files renamed: `ability-list.mjs` → `trait-list.mjs`,
> `sin-list.mjs` → `talent-list.mjs`. Schema, validation, CSS, character
> data, and docs updated to match.

### Step 3 — Creation View Migration (Session 3) ✓ DONE

- [x] Extend form renderer for `mode: "create"` (mode threaded through entire pipeline)
- [x] Wire attribute budget calculator (80-point system)
- [x] Wire secondary attribute auto-calculation
- [x] ~~Update `FormValidator` for renderer-generated DOM~~ — bypassed;
      HTML5 validation + `collectFormData()` + server validation used instead.
      Full client validator redesign deferred to Phase 5.
- [x] Rewrite `creation-view.mjs` to reuse form renderer in creation mode
- [x] Remove `GET /api/v1/view/creation` endpoint
- [x] Remove `src/templates/creation.mts`
- [x] Remove `src/renderers/renderCreationView.mts`

### Step 3.5 — Form Field Hygiene & Secondary Attributes ✓ DONE

Fix broken secondary attribute live updates, eliminate redundant HTML
attributes on form fields, extract duplicated nav generation. See
[phase3-plan.md § Session 3.5](../.github/plans/phase3-plan.md) for full analysis.

- [x] Fix `SECONDARY_ATTRIBUTES_RULES` / `PRIMARY_TO_SECONDARY` key mismatch
- [x] Remove dead `data-field-path` wrapper attribute; keep `data-path`
      (serves discovery + path-carrying roles on form controls and component
      containers). `id`/`for` verbosity deferred to Phase 8 HTML audit.
- [x] Decide on input/output consistency for derived fields in create mode
- [x] Remove `injectDerivedAttributes()` — collect derived values from DOM
- [x] Extract nav generation into shared utility

### Step 4 — Dashboard, Landing & Final Cleanup (Session 4)

- [x] Rewrite `dashboard-view.mjs` — JSON character list, client-rendered
      cards (dedicated render function, not schema-driven)
- [x] Rewrite `initial-view.mjs` — client-rendered static content
- [x] Remove `GET /api/v1/view/dashboard` and `GET /api/v1/view/initial`
- [x] Delete `src/templates/` directory
- [x] Delete `src/renderers/` directory
- [x] Remove `#renderers` subpath import from `package.json`
- [x] Delete `public/template-engine.mjs`
- [x] Remove `fetchView()` from `public/api.mjs`
- [x] Remove template caching from `public/state.mjs`
- [x] Remove `public/validation/schema.mjs` (replaced by served schema)

**Deliverable:** Server is a pure JSON API. Client renders all views from
data. One rendering path for both initial load and real-time updates.

**Phase 3 complete.**

---

## Phase 4 — Testing ✓ DONE

**Goal:** Comprehensive test suite using `node:test` + `node:assert/strict`. Same conventions as malizia.

**Result:** 385 tests passing across 11 test files. Sessions 1–7 complete.
Session 8 (RPG Engine tests) is deferred — runs alongside Phase 6 as new
engine code is delivered.

**Detailed plan:** [phase4-plan.md](../.github/plans/phase4-plan.md) — 8-session
breakdown covering pure utilities, validation, auth, rules engine baseline,
storage, HTTP API, SSE, and RPG engine (ongoing with Phase 6).

- [x] Create `test/` directory at project root *(Session 1)*
- [x] `test/helpers/fixtures.mts` — character fixture factory *(Session 1)*
- [x] `test/traversal.test.mts` — traversal utilities (26 cases) *(Session 1)*
- [x] `test/utils.test.mts` — utility functions (14 cases) *(Session 1)*
- [x] `test/general.test.mts` — `scaleCropForContainer` (6 cases) *(Session 1)*
- [x] Deleted old `test/character-creation.test.mts` (incompatible) *(Session 1)*
- [x] `test/auth.test.mts` — auth token validation (13 cases) *(Session 3)*
- [x] `test/sanitization.test.mts` — role-based data stripping (5 cases) *(Session 3)*
- [x] `test/schema-serializer.test.mts` — schema serialization contract (14 cases) *(Session 3)*
- [x] `test/rules/attributes.test.mts` — secondary formulas + clampValues (36 cases) *(Session 4)*
- [x] `test/rules/applicator.test.mts` — effect application + equipment bonuses (16 cases) *(Session 4)*
- [x] `test/rules/derived.test.mts` — full pipeline, expiry, priority, combat (23 cases) *(Session 4)*
- [x] `test/validation.test.mts` — character creation/update validation (87 cases) *(Session 2)*
  - [x] Valid character passes
  - [x] Missing required fields rejected
  - [x] Attribute budget enforcement
  - [x] Field type validation
  - [x] Permission checks (owner vs DM vs public)
  - [x] Server-controlled field rejection
- [x] `test/storage.test.mts` — file-based storage operations (37 cases) *(Session 5)*
  - [x] Save and retrieve character
  - [x] Index consistency (byId, byBackupCode, byPlayer, all)
  - [x] Update with metadata change triggers index update
  - [x] Soft delete and hard delete
  - [x] Player lookup returns only non-deleted characters
- [x] `test/data-contracts.test.mts` — Discord bot integration foundation (25 cases) *(Session 5)*
  - [x] Character shape matches data-contracts §1
  - [x] Sanitized-for-public strips sensitive + deletion metadata
- [x] `test/api.test.mts` — HTTP integration tests *(Sessions 6–7)*
  - [x] GET /characters — list
  - [x] POST /characters — create
  - [x] GET /characters/:id — retrieve
  - [x] PATCH /characters/:id — update
  - [x] DELETE /characters/:id — soft/hard delete
  - [x] Permission enforcement (owner, DM, public)
  - [x] Malformed request handling
- [x] `test/sse.test.mts` — SSE broadcast *(Session 7)*
  - [x] Client connection and disconnection
  - [x] Broadcast reaches connected clients
- [ ] `test/schema-renderer.test.mts` — schema-driven form rendering
      _(deferred to Phase 8 — client-side code, needs DOM environment)_
  - [ ] Field generation from schema metadata
  - [ ] Section grouping and ordering
  - [ ] Role-based editability gating
  - [ ] Hidden field exclusion
  - [ ] Component overrides for custom sections

**Deliverable:** Server-side test suite complete. `npm test` runs green (385 tests).
Client-side rendering tests deferred to Phase 8 (DOM environment needed).
RPG engine test rewrite deferred to Phase 6 (typed pipeline not yet built).

---

## Phase 5 — Bug Fixes & Hardening ✓ DONE

**Goal:** Fix known issues identified in the code audit. Each fix should have a corresponding test (written in Phase 3 or added here).

**Result:** 444 tests passing (385 → 444 over the phase). Typecheck clean.
All High-, Medium-, and Low-priority items resolved or relocated to a phase
with the right prerequisites. See [phase5-plan.md](../.github/plans/phase5-plan.md)
for session-by-session detail (Sessions 0–5 + 4.5).

### High Priority

- [x] Fix `FIELDS_WITH_VALIDATION` inversion bug — `getFieldPathsByProperty("validate", undefined)`
      matches fields where `field["validate"] === undefined`, i.e. fields **without**
      a validate function. `validateCrossFieldRules()` iterates these but its own
      `if (schema?.validate)` guard means cross-field validation **never runs**.
      Currently harmless (all `rpgValidators` are stubs) but will silently swallow
      real validation once validators are implemented. Fix: collect fields that
      actually have a `validate` function, or remove the pre-filtered list and let
      `validateCrossFieldRules` iterate all paths.
      **Fixed in Phase 4 Session 2** — `getFieldPathsByProperty` now uses
      existence check when `propertyValue` is `undefined`. Regression test added.
- [x] ~~Re-enable `validateCharacterCreation()` in `createCharacter()` service~~
      **Resolved** — handler already validates; commented-out call was redundant.
      Dead code removed, service cleaned to thin wrapper (Phase 5 Session 1).
- [x] Add request body size limit (1 MB for JSON, ~21 MB for uploads)
      New `src/lib/body.mts` utility: `readBody`, `readBodyBuffer`,
      `BodyTooLargeError`. Applied to all 6 body-reading sites. 413 response
      on overflow (Phase 5 Session 3).
      **Bug #25-related — api-infra-bugs tracker.**
- [x] Re-enable file upload size check (commented out in `fileUploader.mjs`)
      **Resolved** — `fileUploader.mjs` no longer exists (removed in Phase 1
      restructure). Client-side check active in `portraitHandler.mjs` line 89.
      Server-side limit addressed via new body size limit utility (see above).
- [x] Add auth to portrait upload — wrapped with `withCharacterPermissions`
      middleware; handler rejects `"public"` role. Also fixed `finally { return true }`
      swallow-bug in close-handler (Phase 5 Session 2).
      **Bug #25 — api-infra-bugs tracker.**
- [x] Re-enable SSE stream auth + sanitize broadcast payload —
      Auth blocks uncommented; query-param auth (`?playerId`/`?dmId`) used.
      `broadcast.mts` now sanitizes per subscriber via `sanitizeCharacterForRole`
      (Phase 5 Session 2).
      **Bug #26 — api-infra-bugs tracker.**
- [x] Use `crypto.timingSafeEqual()` for DM token comparison —
      Replaced `===` with `crypto.timingSafeEqual()` in `auth.mts`
      (Phase 5 Session 2).
      **Bug documented in Phase 4 Session 3** — auth tests label this as a bug.
- [x] Fix `validateRPGRules` attribute budget check — split into over-budget
      and under-budget checks with distinct error messages (Phase 5 Session 1).
      **Bug #17 — api-infra-bugs tracker.**
- [x] Fix `generateDefaultCharacter()` — added `continue` after
      `SERVER_CONTROLLED_FIELDS` check. `schemaVersion` now stamped in
      `createCharacter()` service instead (Phase 5 Session 1).
- [x] Fix crash on undefined effect target — `effect.target` guarded in
      `derived.mts`, non-null assertion removed (Phase 5 Session 4). The
      remaining `setBase` `split(".")[1]!` assertion is safe today (only
      reached when `target.startsWith("rules.")`) and is TODO-marked for
      removal alongside ADR-011 typed targets in Phase 6. **Bug #18.**
- [x] Fix `validateCharacterUpdate` XP check for `push` on `traits` —
      removed premature XP code (both commented-out `increment` block and
      active but incomplete `push` XP check). Will be rebuilt properly in
      Phase 6 with typed effects and reference data (Phase 5 Session 1).

### Medium Priority

- [x] Fix middleware chain type mismatch — replaced `createMiddlewareChain`
      with `createRoute(middlewares: MiddlewareFn[], handler: RouteHandler):
      RouteChainHandler`. Distinct types for the middleware list and the
      terminal handler. `MiddlewareFn` return type narrowed back to
      `Promise<void> | void`. Old `createMiddlewareChain` and
      `MiddlewareChainHandler` deleted (Phase 5 Session 5).
- [x] Consolidate domain layer per [ADR-013](decisions/013-domain-layer-mutation-gate.md)
      (Phase 5 Session 4.5). One `updateCharacter` (delegates to storage),
      recalc + broadcast move into the domain layer, handlers and middleware
      stop importing from `#models/storage`, transport deps wired via
      `createCharacterService({ recalc, broadcast, broadcastDeleted })`
      factory. Resolves the duplicate `updateCharacter` and the latent
      `skipUndefined` bug in `handleUploadPortrait`.
- [x] Remove duplicate `deepMerge`/`isObject` in `index.mts` — removed;
      service layer now imports from `#models/traversal` (Phase 5 Session 1).
- [x] Extract shared `byId` index-entry builder in `storage.mts` —
      private `buildIndexEntry(character)` helper used by both
      `updateIndexMetadata()` and `saveCharacter()` (Phase 5 Session 4).
- [x] Implement CORS origin whitelisting (ADR-007) — new `src/lib/cors.mts`
      with env-driven `CORS_ORIGINS`. Replaces `*` wildcard. Always sets
      `Vary: Origin`. Production env file added (Phase 5 Session 3).
- [x] Fix `validateCharacterUpdate` `increment` on `traits` — removed
      commented-out dead code (Phase 5 Session 1). XP validation will be
      implemented properly in Phase 6.
- [x] Remove dead `xp.mts` — deleted (Phase 5 Session 1). XP calculation
      will be implemented in Phase 6.
- [x] Add write serialization for storage — per-character write lock to
      prevent concurrent writes from corrupting JSON files (see ADR-002
      consequences). Implemented as `withWriteLock` in `storage.mts`
      (Phase 5 Session 4.5).
- [x] Consistent sanitization across all response paths — applied
      `sanitizeCharacterForRole` to GET list, PATCH update, POST recover,
      and SSE broadcast. POST create still returns `backupCode` (owner needs
      it on first creation) (Phase 5 Session 2).
      **Bug #27 — api-infra-bugs tracker.**

### Low Priority

- [x] Document CSS & HTML conventions as ADR ([ADR-012](decisions/012-standards-first-html-css.md)):
      semantic HTML, type-based selectors with native nesting, `@scope` /
      `@layer`, field wrapper pattern (div.input with label + control).
      Schema-driven renderer DOM must stay compatible with existing CSS
      selectors.
- [x] DM login fails with 400 in development when env file is missing —
      `config/nagara.development.env` is gitignored and must be created
      locally with `NAGARA_DM_TOKEN=<value>`. Bare `node src/server.mts`
      doesn't load it (needs `--env-file` flag or `npm run start:dev`)
      **Not a bug** — documentation gap. Requires local env file, not a code
      fix. Documented in README.
- [x] Fix SSE typos: `idDM` → `isDM`, `characrer` → `character` —
      **Resolved** — both typos already fixed. Remaining `timeStamp` →
      `timestamp` casing fix tracked in
      [phase5-plan.md](../.github/plans/phase5-plan.md) Session 4.
- [x] Replace `buffer.slice` with `buffer.subarray` in multipart parser —
      **Resolved** — no `.slice()` on Buffer found anywhere in `src/`.
      Already resolved before Phase 5.
- [x] Fix DELETE route — extracted into `handleDeleteCharacter.mts`
      (Phase 5 Session 4)
- [x] Remove dead/commented code throughout the codebase — deleted
      unused `createAlias`/`resolveAlias` stubs and `ALIAS_FILE` from
      `storage.mts`; removed stale `console.log("ERRORS ON PATCH", …)`;
      cleaned dead XP code from `validation.mts`; deleted dead
      `src/rules/xp.mts`. Service-layer `createCharacter` reduced to a
      thin wrapper after removing dead duplicate validation/merge
      (Phase 5 Sessions 1–4).
- [x] Resolve `handleGetCharacters` `@TODO: disable dm handing` — removed
      stale TODO, fixed typo. DM path kept (auth-gated); sanitization from
      bug #27 fix addresses data exposure (Phase 5 Session 2).
      **Bug #28 — api-infra-bugs tracker.**
- [x] Harden recovery endpoint — keyspace expanded to 22 × 22 × 10 000 ≈
      **4.84M combinations** (was ~32K). `/recover` extracted to
      `src/routes/handleRecover.mts` and gated by an in-memory
      `createRateLimiter` (5/min) on **two** independent buckets —
      lowercased character name and `req.socket.remoteAddress` — with a
      429 + `Retry-After` response on overflow (Phase 5 Session 5).
      **Bug #29 — api-infra-bugs tracker.**

**Deliverable:** ✅ All server-side bugs fixed and hardened. All fixes covered
by tests (444 / 444 green; +59 from Phase 4 baseline of 385). Client-side
items deferred to Phase 8. RPG-engine-dependent items (`#19`, `#20`, `#21`,
`#22`, `#23`, plus the residual `setBase` non-null assertion) deferred to
Phase 6 Step 0 — they are subsumed by the typed pipeline rewrite. See
[phase5-plan.md](../.github/plans/phase5-plan.md) for session-by-session
breakdown.

---

## Phase 6 — RPG Engine

**Goal:** Replace the stub rules engine with a typed effect-resolution
pipeline, a 3-slot per-weapon combat model, derived special-attack /
reaction collections, and fully normalized reference data so that derived
stats reflect equipped weapons and learned traits.

**Detailed plan:** [phase6-plan.md](../.github/plans/phase6-plan.md) —
8 chunks (A–H), each independently reviewable. Replaces the original
Step 0 / Step 5 outline.

**Basis:** [ADR-010](decisions/010-effect-resolution-pipeline.md),
[ADR-014](decisions/014-per-slot-combat-special-attacks.md),
[ADR-015](decisions/015-typed-effect-targets-final.md)
(supersedes [ADR-011](decisions/011-typed-effect-targets.md)),
[deferred-tasks.md](deferred-tasks.md) §1–§3,
[data-contracts.md](data-contracts.md) §1.1.

> **Why here:** Phases 3–5 work fine with stub combat/effect values. But
> Phase 7 (sibling integration) needs the addon export to contain real
> computed data. This phase delivers the engine that produces it.

### Chunk Status

| Chunk | Focus                                                        | Status                |
| ----- | ------------------------------------------------------------ | --------------------- |
| A     | Decisions, vocabulary lock & armor refactor                  | ✅ Done (2026-04-22)  |
| B     | Reference catalog relocation (`data/` → `reference/`)        | Not started           |
| C     | Typed pipeline foundation (no combat fanout)                 | Not started           |
| D     | Schema migration: `Combat` + `specialAttacks` / `reactions`  | Not started           |
| E     | Combat phase per-slot fanout + weapon predicates             | Not started           |
| F     | Effect normalization (data, collaborative bulk edit)         | Not started           |
| G     | Wire ability/spell registry into recalc + reference-lint     | Not started           |
| H     | Validators, sibling docs, cleanup                            | Not started           |

### Chunk A Deliverables (done)

- ADR-014, ADR-015 written; ADR-011 marked superseded.
- `data/armor.{en,ru}.json` rewritten — dropped legacy `type` field, renamed
  `defense` → `armor`, prepended `"hampering"` quality on all body armor.
- `src/rules/attributes.mts` armor reader carries a transition fallback
  (`body?.armor ?? body?.defense`) marked `TODO(phase6-chunk-D)`; dropped
  with the character wipe in Chunk D.
- `docs/data-contracts.md` §1.1 rewritten with the locked vocabulary.
- `docs/deferred-tasks.md` §1, §2 (armor), §3 refreshed.
- `.github/bugs/engine-weak-points.md` items re-linked to chunks.
- 445 / 445 tests + typecheck green.

### Items Relocated from Phase 5 (now subsumed by phase6-plan.md)

These were originally tracked in Phase 5 but require the typed effect
pipeline, reference data, or RPG rules engine to implement properly. All
are folded into the chunked plan:

- Align effect modifier types (`add`/`mul`/`set` → `setBase`/`addFlat`/
  `multiply`/`cap` + `remove`) — **Chunk C** (engine rewrite) +
  **Chunk F** (data alignment).
- Implement real `rpgValidators` — **Chunk H**.
- Bump `schemaVersion` on schema changes — **Chunk D** (along with the
  `Combat` shape change).
- Combat derived fields scalar vs array — settled by **Chunk D** schema
  + **Chunk E** fanout (`bonusDamage` is per-slot scalar).

---

## Phase 7 — Sibling Project Integration

**Goal:** Implement the endpoints and features required by the addon and
Discord bot.

**Basis:** [addon-integration.md](addon-integration.md),
[bot-integration.md](bot-integration.md),
[data-contracts.md](data-contracts.md)

### Addon Integration

- [ ] `GET /api/v1/characters/:id/export/addon` — export endpoint
  - [ ] Strip excluded fields (per addon-integration.md §2.4)
  - [ ] Serialize as Base64(JSON) (simpler path, coordinate with addon)
  - [ ] Include `schemaVersion`
- [ ] `POST /api/v1/characters/:id/import/addon` — paste-import from addon
  - [ ] Base64 decode → validate → conflict check via `lastModified`
  - [ ] Merge into stored character
- [ ] `POST /api/v1/characters/:id/sync` — DM sync script endpoint
  - [ ] Bearer token auth (reuse DM token mechanism)
  - [ ] `lastModified` conflict resolution (409 if website is newer)

### Discord Bot Integration

- [ ] Add `discordId` field to character schema (string, optional, Discord
      snowflake — see bot-integration.md §3)
  - [ ] Include `discordId` in `index.json` `byId` entries
  - [ ] Decide on linking UX (bot `/link` command vs manual paste)
- [ ] Verify bot can read `data/index.json` and `data/characters/*.json`
      directly from the filesystem (same VPS — bot-integration.md §2)
- [ ] Confirm `PATCH /api/v1/characters/:id` works for bot write scenarios
      (bot-integration.md §4: `/update`, `/dm-xp`, `/dm-corruption`, `/dm-effect`)
- [ ] Ensure portrait files are served over HTTPS for Discord embed rendering
      (bot-integration.md §5)
- [ ] Document bot-specific API usage in data-contracts.md

### Shared

- [ ] Ensure all new endpoints have tests
- [ ] Update addon-integration.md with implementation status
- [ ] Coordinate wire format decision with addon repo (JSON vs Lua serialize)

**Deliverable:** Addon and bot can consume the API as specified.

---

## Phase 8 — Polish & Beyond MVP

**Goal:** Quality-of-life improvements. Not blockers, but make the project more maintainable and pleasant to use.

- [ ] Refactor router: replace if/else chain with declarative route table
      (port pattern from `mychar`)
- [ ] Client error handling: show user-facing errors for failed API calls
- [ ] Client offline resilience: detect disconnection, show status
- [ ] SSE reconnection improvements: `Last-Event-ID` support, event IDs
- [ ] Character export/import UI: "Export for Addon" button, "Update from
      Addon" text area
- [ ] Startup index verification: compare `index.json` against actual files
      in `data/characters/`
- [ ] Static data endpoints: `/api/v1/spells`, `/api/v1/rituals`, etc.
      (for addon build script)
- [ ] GitHub Actions CI: run `npm run typecheck` and `npm test` on push
- [ ] **Weapon-slots UI: replace `<select>` with clickable weapon cards
      (Chunk-D follow-up).** Each populated slot shows the weapon as a
      card (name, damage, qualities, art). Clicking a card opens a
      `<dialog>` with a filtered list of candidate weapons (slot 2
      filtered to `qualities.includes("own")`); selection swaps the card
      in-place. Empty slots show a "+ Add weapon" placeholder card. Aligns
      with the design mockups; supersedes the placeholder dropdown
      renderer in `public/components/weapon-slots.mjs`.
- [ ] **Weapon-slots renderer parity: creation vs character view
      (Chunk-D follow-up).** The current renderer assumes a saved
      character: it reads `equipment.weapons` from
      `nagara.getState().currentCharacter` and PATCHes
      `/characters/:id`. In creation view there is no `id` and no
      `currentCharacter` yet (the form sources from the stale
      `DEFAULT_CHARACTER` in `public/utils/rpg.mjs`, which still mirrors
      the pre-Chunk-D `combat` shape and has an empty `equipment.weapons`
      list). Before this widget can ship for real:
      - Update `DEFAULT_CHARACTER` to the Chunk-D shape (`combat: { carried }`,
        seed `equipment.weapons[0]` with `natural_weapon` from the
        catalog).
      - Make the renderer read the form's local data in creation mode and
        defer persistence to the form's submit handler instead of
        per-change PATCHes.
      - Same widget code, two modes: live PATCH in view, deferred-buffer
        in creation. Decide the seam (mode prop, or a small
        `WeaponSlotsHost` wrapper) when the cards UI lands.

### Client-Side Test Coverage

Deferred from Phase 4 — client rendering code (`public/renderers/`,
`public/components/`) needs a DOM environment for meaningful testing.

- [ ] `test/schema-renderer.test.mts` — schema-driven form rendering:
      field generation, section grouping, role-based editability,
      hidden field exclusion, component overrides.
      _(Requires jsdom, happy-dom, or headless browser.)_

### Client Code Hygiene

Discovered during Phase 3 Session 4. Moved from `deferred-tasks.md` §4.

- [ ] Extract inline error-state DOM blocks from render functions —
      `dashboard-view.mjs` and `initial-view.mjs` build error markup
      inline inside `try/catch` blocks. The named builder functions
      (`buildWelcomeBlock`, `buildCharacterGrid`, etc.) are fine — the
      issue is the error-path DOM construction cluttering the view body.
      Audit all views for similar patterns and extract into shared helpers.
- [ ] Extract displayable text constants for l10n — hardcoded English
      strings (headings, descriptions, button labels, contact data) in all
      client views and components. Define a text/locale system (at minimum
      EN + RU) and centralize all user-visible strings.
- [ ] Deduplicate `getNestedValue` — four independent copies exist in
      `state.mjs`, `section-renderer.mjs`, `validation/engine.mjs` (×2).
      Extract a single version into `public/utils/object.mjs` and import
      everywhere.

### HTML Attribute Audit

- [ ] Review `id` / `for` verbosity on form fields — currently
      `id="field-attributes.primary.strong"` (full dotted path). Evaluate
      shorter IDs (e.g. tail-only) once all components are implemented and
      collision risk is fully known. Check for duplicate IDs across the
      rendered DOM.
- [ ] Audit remaining `data-*` attributes for dead or redundant usage
- [ ] **Lean & spec-compliant client HTML audit (Chunk-D follow-up).**
      Walk every renderer and component in `public/` and prune attributes
      that don't earn their keep:
      - Form controls without `name` / `id` (current example:
        `weapon-slots.mjs` builds `<select>` elements with only
        `data-slot`; they're unsubmittable and unlabelled). Either give
        them proper `name`/`id`/`<label>` wiring or justify the omission.
      - Wrapper elements with classes that duplicate the tag's semantics
        (current example: `weapon-slots.mjs` adds `class="weapon-slot"`
        to each `<li>` inside `ol.weapon-slots` — `@scope` already gives
        us `ol.weapon-slots > li` for free per the styling guidelines).
      - Decorative `<div>` / `<span>` where a more specific element
        applies, per `.github/instructions/hypertext.instructions.md`.
      Goal: every attribute on every element either feeds a W3C-defined
      behaviour, an `@scope` selector, or an explicit JS hook — nothing
      else.

### Responsive Design & Styling

- [ ] Audit CSS for small-screen support (mobile, tablet breakpoints)
- [ ] Add responsive layout for character form sections
- [ ] Review dashboard card grid on narrow viewports
- [ ] Test touch interactions for editable fields and behaviors

### Asset & Delivery Optimization

- [ ] Strip unnecessary metadata from SVG icons (Illustrator export bloat)
- [ ] Optimize font files (subset to used glyphs if applicable)
- [ ] Add Brotli/gzip `Content-Encoding` for static assets and API responses
      (precompressed files or on-the-fly compression via `node:zlib`)
- [ ] Set `Cache-Control` headers for static assets (fonts, icons, CSS)
- [ ] Review image portrait delivery (format, compression, sizing)

### Domain Layer Hygiene

Deferred from Phase 5 Session 4.5 (ADR-013 implementation). Functional
correctness is already ensured; these are tightening passes.

- [ ] Tighten `handleUploadPortrait` payload — currently passes the full
      character object to `updateCharacter`. The `skipUndefined` merge in
      storage prevents data clobber, but the call should be narrowed to
      `{ portrait: { path, status }, lastModified }` for explicitness.
- [ ] Add `no-restricted-imports` lint rule for `#models/storage` — enforce
      ADR-013 carve-out at tooling level. Requires a lint config (ESLint or
      equivalent). Until then, rely on review + verification grep:
      `Get-ChildItem -Recurse src -Filter *.mts | Select-String '#models/storage'`

### Items Relocated from Phase 5

These items are client-only, require DOM testing infrastructure, or are UX
polish that doesn't affect server correctness.

- [ ] Client-Side Validation Redesign — the existing client validation
      system (`public/validation/`) was designed for a nested, client-side
      duplicate of the server schema. It cannot work with the flat-key schema
      served by `GET /api/v1/schema`: `engine.mjs` walks a nested schema
      tree, `ui.mjs` (FormValidator) builds nested objects via `deepMerge()`
      with `DEFAULT_CHARACTER`, and `rpgValidators` are functions (not
      JSON-serializable). ~60% of engine.mjs + ui.mjs is commented-out
      scaffolding. Current workaround: HTML5 constraint validation + manual
      JS budget check + server-side `validateCharacterCreation()`.
      Tasks: delete duplicate `public/validation/schema.mjs`, redesign
      `validation/engine.mjs` + `validation/ui.mjs` for flat-key served
      schema, design cross-field RPG validation (budget, defense, etc.),
      add proper inline error display.
- [ ] Creation View UX Bugs (7 items from Session 3 smoke test) — input
      value not auto-selected on click, tab navigation broken, primary
      attributes should not default to 5 (sum=40 fails validation but passes
      `required` incorrectly — use empty inputs with placeholders), derived
      attributes are editable when they should be read-only (permanent/
      temporary corruption depend on abilities), no client-side derived stat
      recalculation after creation (server recalculates on save but client
      shows stale values), portrait section markup broken (nested sections,
      duplicate headers), `equipment.money` editable during creation (should
      be derived/starting value).
- [ ] Array-Typed Derived Fields — `collectFormData()` cannot reconstruct
      arrays from `<output>` elements with empty/comma-separated values.
      Temporary fix (Session 3.5a): skip empty `<output>` values. Permanent
      fix: change `combat.bonusDamage` schema type from `"array"` to
      `"number"` once the Phase 6 effect resolution pipeline computes the
      scalar total from `effects.filter(e => e.target === 'combat.bonusDamage')`.
- [ ] Client Import Map Aliases — server uses subpath aliases (`#types`,
      `#models`, etc.) but client still uses relative paths everywhere.
      Define client aliases in `index.html` import map, update `.mjs` files.
- [ ] Fix client router empty-hash navigation — `hashchange` listener or
      `isNavigating` guard not resetting
- [ ] Verify role-based editability (owner, DM, public) in character view —
      DM login requires local env file for manual testing
- [ ] Rewrite `watcher.mts` — port mychar pattern: clean exit vs crash
      detection, `SIGINT`/`SIGTERM` handlers, proper TypeScript types

---

## Session Planning

Realistic session-by-session flow:

| Session | Phase | Focus                                              |
| ------- | ----- | -------------------------------------------------- |
| 1       | 0     | Documentation, ADRs, roadmap, copilot instructions |
| 2       | 1     | Full project restructure                           |
| 3       | 2     | TypeScript migration (leaf modules + interfaces)   |
| 4       | 3     | Schema UI metadata + form renderer foundation      |
| 5       | 3     | Character view + creation view migration           |
| 6       | 3     | Dashboard + landing migration, cleanup             |
| 7       | 4     | Testing (test the final architecture)              |
| 8       | 4 + 5 | Tests + bug fixes (test what you fix)              |
| 9       | 6     | RPG Engine architecture gate + reference data      |
| 10      | 6     | Effect normalization + applicator alignment        |
| 11      | 6     | Effect resolution pipeline + combat derivation     |
| 12+     | 7     | Sibling integration, guided by docs                |

Each session must leave the project in a **working state**. No half-done
restructures or broken imports across sessions.
