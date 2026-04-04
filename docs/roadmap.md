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
        `rituals`, `boons`, `sins` (reference-based model)
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

**Goal:** Replace server-rendered HTML templates with schema-driven client rendering. Single rendering path for initial load and SSE updates.

**Basis:** [ADR-009](decisions/009-schema-driven-rendering.md)
(supersedes [ADR-004](decisions/004-hybrid-spa-server-views.md))

### Step 1 — Schema & Renderer Foundation

- [ ] Extend `CHARACTER_SCHEMA` with UI metadata (`section`, `label`, `order`,
      `editableBy`, `hidden`, `displayAs`, `hint`)
- [ ] Define section registry (visual grouping and sort order)
- [ ] Add `GET /api/v1/schema` endpoint (serves schema, ETag-cacheable)
- [ ] Build generic client form renderer: `(schema, data, role) → DOM`
  - [ ] Iterates schema fields grouped by section
  - [ ] Generates inputs with `data-path`, `data-behavior`, `data-role-allowed`
  - [ ] Respects `hidden`, `editableBy`, `displayAs` metadata
  - [ ] Supports component overrides for non-standard sections

### Step 2 — Character View Migration

- [ ] Refactor `character-view.mjs` to fetch JSON + schema, render client-side
- [ ] Build component overrides for portrait, abilities, and sin sections
- [ ] Verify SSE updates work through same rendering pipeline
- [ ] Verify role-based editability (owner vs DM vs public)
- [ ] Remove `GET /api/v1/view/character/:id` endpoint
- [ ] Remove `server/nagara/templates/character.mjs`
- [ ] Remove `server/nagara/renderers/renderCharacterView.mjs`

### Step 3 — Creation View Migration

- [ ] Refactor `creation-view.mjs` to reuse form renderer in creation mode
  - [ ] All owner-editable fields become required inputs
  - [ ] Attribute budget tracking wired to renderer output
- [ ] Remove `GET /api/v1/view/creation` endpoint
- [ ] Remove `server/nagara/templates/creation.mjs`
- [ ] Remove `server/nagara/renderers/renderCreationView.mjs`

### Step 4 — Dashboard & Landing Page Migration

- [ ] Refactor `dashboard-view.mjs` to fetch JSON character list, render
      client-side (dedicated render function, not schema-driven)
- [ ] Refactor `initial-view.mjs` to render client-side (static content)
- [ ] Remove `GET /api/v1/view/dashboard` and `GET /api/v1/view/initial`
      endpoints
- [ ] Remove `server/nagara/templates/dashboard.mjs` and `initial.mjs`
- [ ] Remove `server/nagara/renderers/renderDashboardView.mjs` and
      `renderInitialView.mjs`

### Step 5 — Cleanup

- [ ] Remove `server/nagara/templates/` directory
- [ ] Remove `server/nagara/renderers/` directory (or repurpose for
      non-view server rendering if any remains)
- [ ] Remove `client/template-engine.mjs` (server-HTML hydration)
- [ ] Remove view route handlers and view route wiring
- [ ] Verify all views render correctly, SSE works, behaviors attach

**Deliverable:** Server is a pure JSON API. Client renders all views from data. One rendering path for both initial load and real-time updates.

---

## Phase 4 — Testing

**Goal:** Comprehensive test suite using `node:test` + `node:assert/strict`. Same conventions as malizia.

- [ ] Create `test/` directory at project root
- [ ] `test/rules.test.mts` — derived stats, effect application, attribute formulas
  - [ ] Toughness = max(strong, 10)
  - [ ] Pain threshold = ceil(strong / 2)
  - [ ] Corruption threshold = ceil(resolute / 2)
  - [ ] Defense = quick
  - [ ] Effect pipeline: setBase, addFlat, multiply, cap
  - [ ] Equipment bonus application
  - [ ] Expired effect filtering
  - [ ] Consistency enforcement (toughness.current ≤ max, XP ≥ 0)
- [ ] `test/validation.test.mts` — character creation/update validation
  - [ ] Valid character passes
  - [ ] Missing required fields rejected
  - [ ] Attribute budget enforcement
  - [ ] Field type validation
  - [ ] Permission checks (owner vs DM vs public)
  - [ ] Server-controlled field rejection
- [ ] `test/storage.test.mts` — file-based storage operations
  - [ ] Save and retrieve character
  - [ ] Index consistency (byId, byBackupCode, byPlayer, all)
  - [ ] Update with metadata change triggers index update
  - [ ] Soft delete and hard delete
  - [ ] Player lookup returns only non-deleted characters
- [ ] `test/api.test.mts` — HTTP integration tests
  - [ ] GET /characters — list
  - [ ] POST /characters — create
  - [ ] GET /characters/:id — retrieve
  - [ ] PATCH /characters/:id — update
  - [ ] DELETE /characters/:id — soft/hard delete
  - [ ] Permission enforcement (owner, DM, public)
  - [ ] Malformed request handling
- [ ] `test/sse.test.mts` — SSE broadcast
  - [ ] Client connection and disconnection
  - [ ] Broadcast reaches connected clients
  - [ ] Keep-alive pings
- [ ] `test/schema-renderer.test.mts` — schema-driven form rendering
  - [ ] Field generation from schema metadata
  - [ ] Section grouping and ordering
  - [ ] Role-based editability gating
  - [ ] Hidden field exclusion
  - [ ] Component overrides for custom sections
- [ ] Update `npm test` script: `node --experimental-strip-types --test test/**/*.test.mts`
- [ ] Remove old `server/tests/character-creation.test.mjs`

**Deliverable:** Full test suite. `npm test` runs green.

---

## Phase 5 — Bug Fixes & Hardening

**Goal:** Fix known issues identified in the code audit. Each fix should have a corresponding test (written in Phase 3 or added here).

### High Priority

- [ ] Re-enable `validateCharacterCreation()` in `createCharacter()` service
      (currently commented out in `index.mjs`)
- [ ] Add request body size limit (1 MB for JSON, 20 MB for uploads)
- [ ] Re-enable file upload size check (commented out in `fileUploader.mjs`)
- [ ] Use `crypto.timingSafeEqual()` for DM token comparison

### Medium Priority

- [ ] Fix middleware chain type mismatch — `createMiddlewareChain()` accepts
      `...MiddlewareFn[]` but route handlers (signature `(req, res) → boolean`)
      are passed in as middleware. This works at runtime because JS ignores
      extra arguments, but the types are a lie. The `finalHandler?` parameter
      on `MiddlewareChainHandler` exists for this purpose but is never used.
      Fix: either (a) make final handlers use `finalHandler` param as intended,
      or (b) redesign the chain to distinguish middleware from terminal handlers
      at the type level. During Phase 2, return types were widened to
      `boolean | void` to paper over this — revert once the design is fixed.
- [ ] Fix duplicate `updateCharacter()` — service layer (`index.mjs`) vs
      storage (`storage.mjs`). Handler should call service, service calls storage
- [ ] Align effect modifier types: current `add`/`mul`/`set` → canonical
      `setBase`/`addFlat`/`multiply`/`cap` — moved to Phase 6 (RPG Engine)
- [ ] Add `schemaVersion` bumping on schema changes
- [ ] Implement CORS origin whitelisting (ADR-007)
- [ ] Fix `rpgValidators` — all currently return `true`. Implement real
      attribute budget validation, health range checks, etc.
- [ ] Add write serialization for storage — per-character write lock to
      prevent concurrent writes from corrupting JSON files (see ADR-002
      consequences)

### Low Priority

- [ ] Fix SSE typos: `idDM` → `isDM`, `characrer` → `character`, remove
      unused `timeStamp` import
- [ ] Replace `buffer.slice` with `buffer.subarray` in multipart parser
- [ ] Fix DELETE route — extract inline handler into a proper handler file
- [ ] Rewrite `watcher.mts` — port mychar pattern: distinguish clean exit
      from crash (only restart on non-zero exit), add `SIGINT`/`SIGTERM`
      handlers for graceful shutdown, TypeScript with proper types
- [ ] Remove dead/commented code throughout the codebase

**Deliverable:** All known bugs fixed. All fixes covered by tests.

---

## Phase 6 — RPG Engine

**Goal:** Build the rules engine into a proper effect resolution pipeline.
Normalize reference data, create missing reference files, align the applicator,
and wire abilities/spells/equipment into derived combat stats.

**Basis:** [deferred-tasks.md](deferred-tasks.md) (detailed task specs),
[data-contracts.md](data-contracts.md) §1.1 (canonical effect shape)

> **Why here:** Phases 3-5 work fine with stub combat/effect values. But
> Phase 7 (sibling integration) needs the addon export to contain real
> computed data. This phase delivers the engine that produces it.

### Gate: Architecture Assessment ✓ DONE

Architectural decisions recorded as ADRs:

- [x] Effect resolution pipeline architecture — explicit phases, typed state,
      unified effect collection. See [ADR-010](decisions/010-effect-resolution-pipeline.md).
- [x] Typed effect targets — discriminated union replacing dotted-path strings.
      See [ADR-011](decisions/011-typed-effect-targets.md).
- [x] Effect target vocabulary defined: `secondary`, `combat`, `weaponQuality`,
      `armorQuality`, `flag`, `check` (ADR-011)
- [x] Tier B flag vocabulary defined: `advantage`, `disadvantage`, `immunity`,
      `freeAttack`, `extraAction`, `reaction`, `specialAttack`, `statusEffect`,
      `statusRemoval` (ADR-011)
- [x] Effect resolution architecture decided: `collectAllEffects` → group by
      phase → apply in fixed order (ADR-010)
- [ ] Update `docs/deferred-tasks.md` with architectural decisions
- [ ] Update `docs/data-contracts.md` §1.1 with final vocabulary

### Step 0 — Engine Foundation Rework

Rewrite the rules engine foundation per ADR-010 and ADR-011 before building
features on top. This replaces the existing `Record<string, unknown>` +
dotted-path + numeric-priority approach.

**Basis:** [ADR-010](decisions/010-effect-resolution-pipeline.md),
[ADR-011](decisions/011-typed-effect-targets.md)

- [ ] Define `EffectTarget` union type, `EffectPhase` enum, `ResolvedEffect`
      interface in `src/rpg-types.mts`
- [ ] Define `ReferenceData` interface and implement startup loader
      (`src/rules/registry.mts`)
- [ ] Rewrite `src/rules/attributes.mts` — `SECONDARY_FORMULAS` functions
      receive typed `PrimaryAttributes` instead of `Record<string, unknown>`
- [ ] Rewrite `src/rules/applicator.mts` — typed `Character` state, exhaustive
      `switch (target.kind)`, correct modifier verbs (`setBase`/`addFlat`/
      `multiply`/`cap`)
- [ ] Rewrite `src/rules/derived.mts` — typed pipeline:
      `collectAllEffects` → `groupByPhase` → phase stages → `deriveCombatStats`
      → `enforceConstraints`. No more `Record<string, unknown>`.
- [ ] Implement `collectAllEffects` in `src/rules/effects.mts` — merges all
      sources (abilities, spells, equipment, temporary) into one array
- [ ] Implement target deserialization (JSON → `EffectTarget`) with startup
      validation
- [ ] Eliminate the `"rules."` prefix convention for setBase detection
- [ ] Separate `enforceConsistency()` into distinct stages:
      `deriveCombatStats`, `clampValues`, `enforceConstraints`
- [ ] Pipeline tests: typed inputs → assert typed outputs per phase

> **Note:** This step can use synthetic/mock effects before reference data
> normalization (Step 2) is done. The pipeline and the data are independent.

### Step 1 — Reference Data Files

Create missing reference data for equipment pick-lists and validation.

- [ ] `data/weapons.en.json` — weapon catalog with type, damage, qualities
- [ ] `data/weapons.ru.json` — Russian localization
- [ ] `data/armor.en.json` — armor catalog with slot, defense, qualities
- [ ] `data/armor.ru.json` — Russian localization
- [ ] `data/runes.en.json` — rune catalog with description, qualities
- [ ] `data/runes.ru.json` — Russian localization
- [ ] Decide on `data/traditions.en.json` — separate file vs. filtered
      ability IDs

### Step 2 — Effect Normalization

Categorize and rewrite reference data effects to canonical form.

- [ ] Categorize all ~507 ability tier effects into Tier A/B/C
- [ ] Categorize all ~147 spell tier effects into Tier A/B/C
- [ ] Convert Tier A effects to canonical `{ target, modifier }` shape
- [ ] Add structured effects to boons/sins/rituals where applicable
- [ ] Retire `data/abilities.normalized-effects.json` (replaced by canonical
      effects in `abilities.en.json`)

### Step 3 — Applicator Alignment

> Most of this step is handled by Step 0 (foundation rework). What remains
> is wiring the new applicator to handle equipment-specific edge cases.

- [x] Change modifier types: `add`/`mul`/`set` → `setBase`/`addFlat`/
      `multiply`/`cap` — done in Step 0
- [x] Add handler for Tier B flag types (advantage, etc.) — done in Step 0
- [ ] Add handler for `remove` modifier (weapon quality removal)
- [ ] Update `applyEquipmentBonuses` for new equipment structure
      (flattened `assassin`/`tools`, singular armor body/plug)

### Step 4 — Effect Resolution Pipeline

Wire ability/spell lookups into the rules engine. The pipeline structure
(from Step 0) is already in place; this step populates it with real data.

- [ ] Build a lookup function: `(id, tier) → ResolvedEffect[]`
      reads from `abilities.en.json` / `spells.en.json` at runtime
- [ ] In `recalculate()`, resolve `character.abilities[]` and
      `character.spells[]` via `collectAllEffects` (Step 0 skeleton)
- [ ] Remove any remaining `traits`-based effect resolution code

### Step 5 — Combat Derivation

Complete the `deriveCombat()` function.

- [ ] Multi-weapon damage: primary → `baseDamage`, secondary → `bonusDamage`
- [ ] Attack attribute resolution from ability effects (`setBase`)
- [ ] Bonus damage dice from ability effects (`addFlat` on `combat.bonusDamage`)
- [ ] Weapon effect application (weapon-mounted effects fed to applicator)

### Step 6 — Validation & Docs

- [ ] Verify all derived stats compute correctly with real ability data
- [ ] Update `docs/data-contracts.md` with final effect vocabulary
- [ ] Update `docs/deferred-tasks.md` to mark completed items
- [ ] Run full test suite — add engine-specific tests if Phase 4 tests
      don't cover new behavior

**Deliverable:** Rules engine processes canonical effects. Derived stats
(combat, secondary attributes) reflect equipped weapons and learned abilities.
Reference data is complete and normalized.

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
