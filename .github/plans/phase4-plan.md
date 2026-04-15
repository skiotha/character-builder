# Phase 4 — Testing: Multi-Session Plan

> Detailed implementation plan for [Phase 4](../../docs/roadmap.md#phase-4--testing).
> Each session leaves the test suite in a runnable state. Pure utilities first,
> then domain logic, then storage, then integration. RPG engine tests deferred
> to Phase 6 for real coverage.
>
> **Basis:** [roadmap.md § Phase 4](../../docs/roadmap.md), project conventions from
> `../../.github/copilot-instructions.md`, malizia test patterns.

---

## Current State (pre-Phase 4)

- **Test runner:** `npm test` → `node --test test/**/*.test.mts` (already in package.json)
- **Existing test file:** `test/character-creation.test.mts` — hand-rolled runner,
  does NOT use `node:test`. Must be rewritten or deleted.
- **tsconfig:** `test/**/*` already included in `include` array.
- **Node 24:** `node:test` + `node:assert/strict` available natively, no flags needed.
- **Conventions:** `describe`/`it` blocks, `node:assert/strict`, mock via `node:test`
  (same as malizia project).

### Import complication: top-level side effects

Several modules run filesystem operations at import time:
- `src/models/storage.mts` — `await fs.mkdir()`, reads/creates `index.json`
- `src/lib/uploads.mts` — `await fsp.mkdir()` for portraits directory

Any test file that imports `#models` or `#models/storage` triggers these side
effects. Sessions 1–4 avoid these imports entirely. Sessions 5+ must mock
`#config` to redirect `DATA_DIR` to a temp directory.

### Focus: edge cases over happy paths

Tests prioritize boundary conditions, error paths, and documented bugs over
simple success scenarios. Happy paths are tested only to establish baselines
for the edge cases.

---

## Shared Infrastructure

### `test/helpers/` directory

Created incrementally as sessions need it:

- **Session 1:** `test/helpers/fixtures.mts` — character fixture factory
  (`makeCharacter(overrides)` returning a minimal valid `Record<string, unknown>`
  matching the schema shape). Used by every subsequent session.
- **Session 5:** `test/helpers/temp-dir.mts` — temp directory setup/teardown
  helper using `node:fs/promises`. Creates unique temp dir per test, returns
  cleanup function.
- **Session 6:** `test/helpers/http.mts` — test HTTP server lifecycle helpers:
  `startTestServer(app)` → `{ baseUrl, close() }`. Makes requests via
  `node:http` or `fetch()`.
- **Session 7:** `test/helpers/mock-response.mts` — mock `ServerResponse` with
  writable stream, `write()` capture, `on()` registration.

### Convention: `describe` block structure

```
describe('moduleName', () => {
  describe('functionName', () => {
    it('edge case description', () => { ... });
  });
});
```

### Cleanup: old test file

Delete `test/character-creation.test.mts` in Session 1 (or rewrite it into
`test/validation.test.mts` in Session 2). The hand-rolled runner is
incompatible with `node:test`.

---

## Session 1 — Pure Utilities ✓ DONE

**Goal:** Test all pure utility functions with zero external dependencies.
Establish test conventions, fixtures, and verify `npm test` works.

**Result:** 50 tests across 3 test files + 1 helper. All passing, typecheck clean.

**Created:**
- `test/helpers/fixtures.mts` — `makeCharacter()`, `makePrimaryAttributes()`, `simpleMerge()`
- `test/traversal.test.mts` — 26 tests (getNestedValue, setNestedValue, deepMerge, getAllFieldPaths, getFieldPathsByProperty, getWritableFieldPaths)
- `test/utils.test.mts` — 14 tests (generateId, generateBackupCode, validateCharacter, filterServerControlledFields)
- `test/general.test.mts` — 6 tests (scaleCropForContainer) + 4 skipped

**Deleted:**
- `test/character-creation.test.mts` (incompatible with `node:test`)

**Bug discovered:** `FIELDS_WITH_VALIDATION` inversion — `getFieldPathsByProperty("validate", undefined)` collects fields WITHOUT a validate function. Cross-field validation never runs. Tracked in roadmap Phase 5.

### `test/helpers/fixtures.mts`

- `makeCharacter(overrides?)` — returns a minimal valid character object
  (all required fields populated with defaults) that can be used by every
  test file. Overrides are deep-merged.
- `makePrimaryAttributes(overrides?)` — shorthand for attribute objects.
- No imports from `src/` beyond types — fixture shapes are hand-coded to
  avoid coupling to schema changes (deliberate: tests should break when
  schema changes, not silently adapt).

### `test/traversal.test.mts` — `src/models/traversal.mts`

**`getNestedValue`:**
- Deep existing path → returns value
- Missing intermediate key → `undefined`
- Non-object intermediate (number, string) → `undefined`
- Array intermediate → `undefined` (arrays are not traversed)
- Single-segment path → direct property access
- Empty object → `undefined`

**`setNestedValue`:**
- Creates intermediate `{}` for deep paths
- Overwrites existing leaf value
- Primitive intermediate silently replaced with `{}`
- Single-segment path on empty object

**`deepMerge`:**
- `null` source → target unchanged
- `undefined` source → target unchanged
- Array in source replaces (not concatenates) array in target
- Nested objects merge recursively
- `skipUndefined: true` → `undefined` source values preserved in target
- Default behavior → `undefined` source values overwrite target
- Source scalar overwrites target object at same key

**`getAllFieldPaths`:**
- Flat object → simple paths
- Nested object → dotted paths
- Array values are leaf nodes
- Empty object → `[]`

**`getFieldPathsByProperty`:**
- Finds `required: true` fields
- Finds `serverControlled: true` fields
- Skips `_config` prefixed keys
- Recurses into nested `type: "object"` nodes
- Works with `propertyValue: undefined` (used for `validate` function discovery)

**`getWritableFieldPaths`:**
- Returns `Set<string>`
- Different result sets for `owner` vs `dm` vs `public` roles
- Excludes `serverControlled`, `generated`, `immutable`, `derived` fields

### `test/utils.test.mts` — `src/lib/utils.mts`

**`generateId`:**
- Returns string matching UUID v4 format

**`generateBackupCode`:**
- Matches `Word-Word-NNN` pattern (3-digit number 100–999)
- Adjective from known list, noun from known list

**`filterServerControlledFields`:**
- Strips `id`, `backupCode`, `created`, `lastModified`, `schemaVersion`
- Preserves user fields (`characterName`, `attributes`, etc.)
- Input without those fields → no crash
- Nested server-controlled paths handled correctly
- Does not mutate original (shallow copy of top level)

**`validateCharacter`:**
- Name < 2 chars → throws
- Missing name → throws
- Valid name → returns `true`

### `test/general.test.mts` — `src/lib/general.mts`

**`scaleCropForContainer`:**
- Proportional scaling (2× container → coordinates 2×, scale adjusted)
- Non-proportional scaling (different width/height ratios)
- `scale` uses `Math.min(widthRatio, heightRatio)`
- `rotation` passes through unchanged
- Identity case (same dimensions → same crop)
- Zero source dimensions → `Infinity`/`NaN` (edge case — document behavior)

### Session 1 verification

```bash
npm test                    # All new tests pass
npm run typecheck           # No type errors in test files
```

**Estimated scope:** ~60–80 test cases across 3 test files + 1 helper.

---

## Session 2 — Validation & Schema ✓ DONE

**Goal:** Test the full validation layer — field validation, character creation
validation, character update validation, and schema utility functions.

**Result:** 87 tests in `test/validation.test.mts`. All 138 total tests passing, typecheck clean.

**Bug fixed:** `FIELDS_WITH_VALIDATION` inversion — `getFieldPathsByProperty`
comparison logic fixed (existence check when `propertyValue===undefined`,
removed `= true` default param). Regression test added to `test/traversal.test.mts`.

**Bugs documented (not fixed):**
- `generateDefaultCharacter` leaks `serverControlled` defaults (`schemaVersion`) — empty if-block without `continue`
- `validateCharacterUpdate` push/traits XP check — unreachable dead code (type mismatch blocks it)
- `validateCharacterUpdate` push/traits XP check — reads wrong cost (`cost[0]` always, no tier awareness)
- `validateCharacterUpdate` increment/traits — commented-out code referencing non-existent `calculateXPForNextRank()`
- All tracked in [roadmap Phase 5](../../docs/roadmap.md#phase-5--bug-fixes--hardening)

**Plan deviations:**
- `push` on `traits` XP tests rewritten to document actual buggy behavior instead of testing
  the intended happy/sad paths (which can't run due to type mismatch upstream)
- `validateFieldValue` with custom `validate` returning error string — **not testable** without
  mocking because all 5 `rpgValidators` are stubs returning `true`. Track for Session 4+ or
  Phase 6 when real validators exist.

**Created:**
- `test/validation.test.mts` — 87 tests across 11 describe blocks

**Create:**
- `test/validation.test.mts`

All imports are from `src/models/validation.mts`, `src/models/schema-utils.mts`,
and `src/models/character.mts` — all pure, no filesystem side effects.

### `validateFieldValue` (from `schema-utils.mts`)

- Type mismatch: string to number field → error
- Type mismatch: number to string field → error
- Number below `min` → error with `min` in message
- Number above `max` → error with `max` in message
- Number at exact `min` boundary → valid
- Number at exact `max` boundary → valid
- Float where `integer: true` → error
- String below `minLength` → error
- String above `maxLength` → error
- String at exact `minLength` → valid
- String at exact `maxLength` → valid
- Pattern violation: `characterName` with digits → error
- Pattern pass: `characterName` with hyphens, apostrophes, spaces → valid
- Unknown field path → `{ valid: false, error: "Unknown field" }`
- Custom `validate` function returning `true` → valid
- Custom `validate` function returning error string → invalid
  **⚠ NOT TESTABLE** — all 5 `rpgValidators` are stubs returning `true`.
  Deferred until real validators exist (Phase 6).

### `validateCharacterCreation` (from `validation.mts`)

- Server-controlled fields in input → `warnings` array populated, fields not in `validatedData`
- Unknown field in input → `UNKNOWN_FIELD` error
- Permission-denied field → `PERMISSION_DENIED` error
- All required fields missing → multiple `REQUIRED` errors
- `characterName` at exactly 3 chars → pass
- `characterName` at 2 chars → fail
- `characterName` at exactly 16 chars → pass
- `characterName` at 17 chars → fail
- `characterName` with digits → pattern fail
- Attribute budget exactly 80 → pass
- Attribute budget 81 → `BUSINESS_RULE` error
- All attributes at default 5 (total 40) → pass (under budget is OK)
  **⚠ BUG DOCUMENTED** — under-budget creation should be rejected. No RPG
  reason to allow unused attribute points. `validateRPGRules` only checks
  `> 80`, not `!== 80`. See [roadmap Phase 5](../../docs/roadmap.md#phase-5--bug-fixes--hardening).
- Single attribute at max 15, others compensate to total 80 → pass
- Negative `experience.unspent` in merged data → `BUSINESS_RULE` error
- Output: `validatedData` has `playerId`, `player`, `created`, `lastModified`
- Output: `validatedData` is `null` when errors exist
- Output: `success` is `false` when errors exist

### `validateCharacterUpdate` (from `validation.mts`)

- Single valid update → in `validUpdates`
- Single invalid update → in `errors`
- Mixed valid + invalid → both arrays populated
- `public` role writing any field → `FORBIDDEN`
- `owner` writing DM-only field (e.g., hypothetical) → `FORBIDDEN`
- `dm` role writing writable field → allowed
- Server-controlled field → `FORBIDDEN`
- Derived field → `FORBIDDEN`
- Immutable field → `FORBIDDEN`
- `push` on `traits` with insufficient XP → `INSUFFICIENT_XP`
  **⚠ UNREACHABLE** — `validateFieldValue` rejects the push value before the
  XP check runs (type mismatch: object vs `"array"`). Test documents the
  actual bug behavior instead. See [roadmap Phase 5](../../docs/roadmap.md#phase-5--bug-fixes--hardening).
- `push` on `traits` with sufficient XP → allowed
  **⚠ UNREACHABLE** — same type mismatch prevents reaching XP check.

### `skipOnCreation` (from `validation.mts`)

- Server-controlled field → `false`
- Owner + recognized creation-override field (e.g., `experience.total`) → `true`
- Unknown field → `false`

### `checkRequiredFields` (from `schema-utils.mts`)

- Missing required field → `REQUIRED` error
- Server-controlled required field absent → no error (skipped)
- Empty string → `REQUIRED`
- Empty array → `REQUIRED`
- `null` value → `REQUIRED`
- `undefined` value → `REQUIRED`

### `isFieldWritable` (from `schema-utils.mts`)

- `serverControlled` field → `false` for all roles
- `generated` field → `false`
- `immutable` field → `false`
- `derived` field → `false`
- Regular writable field + `owner` → `true`
- Regular writable field + `public` → per permissions (mostly `false`)

### `canAccessField` (from `schema-utils.mts`)

- Read access, all 3 roles × public vs private fields
- Write access, all 3 roles × writable vs readonly fields
- Unknown field → `false`

### `applyFieldUpdate` (from `schema-utils.mts`)

- `set` operation → replaces value
- `increment` → adds to numeric value
- `increment` on missing field → 0 + value
- `push` → appends to array
- `push` on missing field → creates `[]`, pushes
- Creates intermediate objects when needed

### `generateDefaultCharacter` (from `schema-utils.mts`)

- Contains all fields with `default` values from schema
- `playerId` and `player` set from arguments
- `created` and `lastModified` are ISO strings
- Server-controlled defaults not leaked to user-settable portion
  **⚠ BUG DOCUMENTED** — `generateDefaultCharacter` has an empty if-block
  for `serverControlled`, so `schemaVersion` (which has both `serverControlled: true`
  and a `default`) leaks through. Test documents actual behavior.

### Session 2 verification

```bash
npm test
npm run typecheck
```

**Estimated scope:** ~80–100 test cases. Large file, organized by
`describe` blocks per function.

---

## Session 3 — Auth, Sanitization, Schema Serializer ✓ DONE

**Goal:** Test authentication, role-based data stripping, and schema
serialization contract.

**Result:** 32 tests across 3 files (13 auth + 5 sanitization + 14 schema-serializer).
All 170 total tests passing, typecheck clean.

**Infrastructure changes:**
- `package.json` engine bumped to `>=25.0.0` (user runs Node 25.x.x)
- `npm test` script now includes `--experimental-test-module-mocks` flag
- First `mock.module()` usage in the test suite — mocks `#config` subpath import
  to control `DM_TOKEN` for auth tests. Uses `.restore()` + re-mock for the
  "no DM_TOKEN configured" describe block.

**Bug documented (not fixed):**
- `auth.mts` uses `===` instead of `crypto.timingSafeEqual()` for DM token
  comparison — timing side-channel vulnerability. Roadmap Phase 5 High Priority
  item annotated with cross-reference.

**Created:**
- `test/auth.test.mts` — 13 tests (validateDmToken, requireDmToken, no-DM_TOKEN edge case)
- `test/sanitization.test.mts` — 5 tests (sanitizeCharacterForRole)
- `test/schema-serializer.test.mts` — 14 tests (serializeSchema, getSerializedSchema)

### `test/auth.test.mts` — `src/lib/auth.mts`

**Setup:** `DM_TOKEN` is imported from `#config` at module level.
Test approach: review at session start whether to use `mock.module()` on
`#config` or set `process.env.NAGARA_DM_TOKEN` before dynamic import.

**`validateDmToken`:**
- Correct token → `true`
- Wrong token → `false`
- `undefined` → `false`
- Array value (e.g., `["token"]`) → `false`
- Empty string → `false`
- No `DM_TOKEN` configured → always `false`

**`requireDmToken`:**
- Valid token in `x-dm-id` header → no throw
- Missing header → throws with `statusCode: 401`
- Wrong token → throws with `statusCode: 401`
- Note: documents current `===` comparison (Phase 5 will fix to `crypto.timingSafeEqual`)

### `test/sanitization.test.mts` — `src/models/sanitization.mts`

**`sanitizeCharacterForRole`:**
- `dm` role → `backupCode` and `playerId` preserved
- `owner` role → preserved
- `public` role → `backupCode` and `playerId` deleted
- Input missing `backupCode`/`playerId` → no crash
- Documents: function mutates input object (no clone)

### `test/schema-serializer.test.mts` — `src/models/schema-serializer.mts`

**`serializeSchema`:**
- Returns `{ fields, sections, version }` structure
- `fields` contains entries for all visible schema leaf fields
- Each field entry has `path` property matching its key
- `RegExp` patterns serialized as `.source` string (not RegExp object)
- `validate` functions NOT present in output
- Object nodes with `ui` metadata get entries
- `_config` key excluded
- `version` matches `CHARACTER_SCHEMA.schemaVersion.default`
- `sections` includes all entries from `SCHEMA_SECTIONS`

**`getSerializedSchema`:**
- Returns `{ json, etag, schema }`
- `json` is valid JSON string (parses without error)
- `etag` matches `"schema-v{N}"` format
- Calling twice returns identical `json` and `etag` (caching)
- `JSON.parse(json)` structurally matches `schema`

### Session 3 verification

```bash
npm test
npm run typecheck
```

**Estimated scope:** ~30–40 test cases across 3 files.

---

## Session 4 — Rules Engine (Current-State Baseline) ✓ DONE

**Goal:** Document current rules engine behavior as a regression baseline
before Phase 6 rewrites it. Tests use current (pre-ADR-010/011) API.

**Create:**
- `test/rules/attributes.test.mts`
- `test/rules/applicator.test.mts`
- `test/rules/derived.test.mts`

All rules modules are pure — no filesystem access.

### `test/rules/attributes.test.mts` — `src/rules/attributes.mts`

**`SECONDARY_FORMULAS` — each formula tested independently:**

`toughness`:
- `formula(5)` → 10 (floor at 10)
- `formula(10)` → 10 (boundary)
- `formula(15)` → 15
- `formula(0)` → 10
- `.base()` with `statOverride` → reads overridden attribute
- `.base()` with missing `attributes.primary` → 0
- `.base()` with `undefined` character structure → no crash

`painThreshold`:
- `formula(7)` → 4 (ceil)
- `formula(1)` → 1
- `formula(0)` → 0
- `formula(10)` → 5

`corruptionThreshold`:
- Same ceil(x/2) pattern, tested at same boundaries

`defense`:
- `formula(x)` → `x` (identity)

`armor`:
- `.base()` reads `equipment.armor.body.defense`
- Missing armor → 0
- `formula` is identity

`corruptionMax`:
- `formula(x)` → `x` (identity)
- `.base()` reads `resolute` (or override)

**`clampValues`:**
- `toughness.current > max` → clamped to `max`
- `toughness.current < 0` → clamped to 0
- `toughness.current` within range → unchanged
- No `toughness` object → no crash
- No `attributes.secondary` → no crash

### `test/rules/applicator.test.mts` — `src/rules/applicator.mts`

NOTE: Uses pre-canonical modifier verbs (`add`/`mul`/`set`). Tests document
this as phase-6-will-change behavior.

**`applyEffect`:**
- `add`: existing value + modifier value
- `add`: missing target → 0 + value
- `mul`: existing value × modifier value
- `mul`: missing target → 0 × value = 0
- `set`: replaces current regardless
- `advantage`: sets `path.advantage = true`
- Unknown modifier type → current value preserved
- Deeply nested target path
- Target path creates intermediates

**`applyEquipmentBonuses`:**
- Weapon with effects → effects applied to character
- Weapon without effects → no crash
- Empty weapons array → no-op
- No `equipment` key → no crash
- Multiple weapons with multiple effects → applied in order

### `test/rules/derived.test.mts` — `src/rules/derived.mts`

**`recalculateDerivedFields`:**
- No effects → secondaries from primaries only
- Expired effect (past `duration`) → filtered out
- Valid effect (null duration) → applied
- Valid effect (future duration) → applied
- `"rules."` prefix with `setBase` → overrides base attribute
- Priority ordering → lower number processed first
- Missing `attributes.secondary` → returns early, no crash
- Full pipeline round-trip: primaries → formulas → effects → equipment → clamp → consistency

**`enforceConsistency` (tested via `recalculateDerivedFields` output):**
- `toughness.current` clamped to `[0, max]` after effects
- Negative XP → reset to 0
- Expired effects pruned from `character.effects` array
- Missing `equipment` → defaults: `weapons: []`, `armor: { body: null, plug: null }`

**`deriveCombat` (tested via output):**
- `combat.weapons[0]` indexes into `equipment.weapons` → `baseDamage`
- No primary weapon → `baseDamage = 0`
- `attackAttribute` defaults to `"accurate"`
- `bonusDamage` defaults to `[]`

### Session 4 verification

```bash
npm test
npm run typecheck
```

**Estimated scope:** ~50–70 test cases across 3 files.
Tests in `test/rules/` subdirectory — verify glob pattern discovers them.

### Session 4 Results ✅

**Completed 2025-07-15.**

- `test/rules/attributes.test.mts` — 36 test cases ✅
- `test/rules/applicator.test.mts` — 16 test cases ✅
- `test/rules/derived.test.mts` — 23 test cases ✅
- **Total:** 75 new test cases (245 total, up from 170)
- `npm test` — 245/245 pass, 0 fail
- `npm run typecheck` — clean

**Bugs discovered and documented (engine-weak-points #18–#23):**

| # | Severity | Summary | Queued |
|---|----------|---------|--------|
| 18 | CRITICAL | Crash on undefined effect target (`target!` on undefined) | Phase 5 High |
| 19 | HIGH | `EffectModifier.value: number` wrong for setBase (carries strings) | Phase 6 Step 0 |
| 20 | HIGH | Rules modules bypass rpg-types (local untyped interfaces) | Phase 6 Step 0 |
| 21 | MEDIUM | Double toughness clamping (clampValues + enforceConsistency) | Phase 6 Step 0 |
| 22 | MEDIUM | Nested effects on RuleEffect never unwound | Phase 6 Step 0 |
| 23 | MEDIUM | `attackAttribute` `\|\|` prevents effect overrides | Phase 6 Step 0 |

---

## Session 5 — Storage Layer & Discord Bot Integration

**Goal:** Test file-based character storage (CRUD, index consistency) and
lay groundwork for Discord bot integration tests.

### Pre-session prep (completed 2025-07-15)

Fixes applied to put codebase on solid ground before writing storage tests:

| Fix | Files | Detail |
|-----|-------|--------|
| `deleteAt` → `deletedAt` | rpg-types.mts, types.mts, storage.mts, index.mts | Align with `created`/`lastModified` naming |
| `status` → `statusCode` | types.mts, index.mts | `DeleteResult` type + usage in `deleteCharacterAsDM` |
| Sanitization gap | sanitization.mts | Strip `deleted`/`deletedAt`/`deletedBy` for non-dm/non-owner |
| Bot integration docs | bot-integration.md | Added reference data files, fixed `characterName` → `name` |
| Duplicate `deepMerge` | index.mts | `@TODO` comment added; tracked in roadmap Phase 5 Medium |
| Stale test data | data/ | Cleared `characters/`, `uploads/portraits/`, reset `index.json` |

**Decision: mock strategy:** (`mock.module("#config")` to redirect
`DATA_DIR`). Proven pattern from `test/auth.test.mts` (Session 3). Most
resilient — isolates top-level side effects in both `storage.mts` and
`uploads.mts`.

**Create:**
- `test/helpers/temp-dir.mts`
- `test/storage.test.mts`
- `test/data-contracts.test.mts` (bot integration foundation)

### `test/storage.test.mts` — `src/models/storage.mts`

**`saveCharacter`:**
- Writes file to `characters/{id}.json`
- Updates all 4 index maps (`byId`, `byBackupCode`, `byPlayer`, `all`)
- Same ID saved twice → no duplicate in `all` or `byPlayer`
- Second player's character → separate `byPlayer` entry

**`getCharacter`:**
- Existing ID → parsed JSON
- Non-existent ID → `null`

**`updateCharacter`:**
- Merges updates into existing character
- Sets `lastModified` to current ISO string
- Metadata change (`characterName`) → index metadata updated
- Non-metadata change → index file NOT rewritten
- Non-existent ID → throws `"Character not found"`

**`getCharactersByPlayer`:**
- Returns only non-deleted characters for player
- Unknown player → `[]`
- Deleted characters excluded

**`findCharacterByNameAndCode`:**
- Correct name + code → returns character
- Case-insensitive name matching
- Wrong code → `null`
- Right code, wrong name → `null`

**`getAllCharacters`:**
- Returns all characters

**`hardDeleteCharacter`:**
- Removes character file
- Removes from all 4 index maps
- Last character for player → player key removed from `byPlayer`
- Portrait directory also deleted

**Service layer (`src/models/index.mts`):**
- `createCharacter` → generates `id`, `backupCode`, delegates to storage
- `deleteCharacterAsPlayer` → ownership check: wrong player → `{ success: false, statusCode: 403 }`
- `deleteCharacterAsPlayer` → non-existent → `{ success: false, statusCode: 404 }`
- `deleteCharacterAsDM` → invalid token → `{ success: false, statusCode: 401 }`
- `deleteCharacterAsDM` → non-existent character → `{ success: false, statusCode: 404 }`
- `recoverCharacter` → delegates to `findCharacterByNameAndCode`
- Note: documents duplicate `updateCharacter` (service vs storage) — Phase 5 bug

### `test/data-contracts.test.mts` — Discord bot integration foundation

**Review at session start:** Check current state of `docs/data-contracts.md`
and `docs/bot-integration.md` for expected shapes. Decide scope:
- Shape validation: saved character JSON contains all fields bot expects
- Sanitization for external consumers: `public` role stripping is correct
- Field presence/absence contract: required vs optional fields

Likely tests:
- Character fixture → all top-level keys from data-contracts §1 present
- `schemaVersion` field present and numeric
- `attributes.primary` has all 8 canonical attribute names
- `attributes.secondary` has all 6 derived stats
- `combat` section has `attackAttribute`, `baseDamage`, `bonusDamage`
- `equipment` has expected structure (weapons, armor, etc.)
- Sanitized-for-public version: `backupCode`, `playerId`, `deleted`, `deletedAt`, `deletedBy` stripped

### Session 5 verification

```bash
npm test                    # All tests pass including storage
npm run typecheck
```

After tests: clean up temp directories (automated in teardown).

**Estimated scope:** ~50–60 test cases across 2 test files + 1 helper.

### Session 5 Results ✅

**Completed 2026-04-15.**

- `test/helpers/temp-dir.mts` — reusable temp directory helper ✅
- `test/storage.test.mts` — 37 test cases ✅
- `test/data-contracts.test.mts` — 25 test cases ✅
- **Total:** 62 new test cases (307 total, up from 245)
- `npm test` — 307/307 pass, 0 fail
- `npm run typecheck` — clean

**Bugs fixed during session:**

| Fix | Files | Detail |
|-----|-------|--------|
| saveCharacter index entry | storage.mts | Added `deleted`/`deletedAt` to inline index entry (was missing vs `updateIndexMetadata`) |
| Double-write on soft delete | index.mts | Removed redundant `markCharacterAsDeleted` call from `deleteCharacterAsPlayer` |
| Incomplete fixture | fixtures.mts | Extended `background` to full 7-field shape |

**Dead code removed:**

| Item | Files | Detail |
|------|-------|--------|
| `markCharacterAsDeleted` | storage.mts | Index-only update with no production callers after double-write fix. Soft delete fully handled by `saveCharacter` in `deleteCharacterAsPlayer`. Function, export, and 2 tests removed. |

**New Phase 5 tracking items:**

| Item | Location | Detail |
|------|----------|--------|
| `byId` index-entry builder duplication | storage.mts, roadmap.md | `updateIndexMetadata()` and `saveCharacter()` build identical object literal |

---

## Session 6 — HTTP API Integration

**Goal:** Test all API endpoints via real HTTP requests against a test server.
Evaluate WoW addon integration test scope.

**Create:**
- `test/helpers/http.mts`
- `test/api.test.mts`

### Setup strategy

**Review at session start:** Evaluate test server approaches:
- **Option A:** Import `app` from `src/app.mts`, create `http.createServer(app)`,
  listen on port 0. Make requests via `fetch()` or `node:http`. Requires
  `#config` mock (same as Session 5) to avoid production filesystem paths.
- **Option B:** Spin up the actual server via child process. More realistic
  but slower, harder to mock.
- **Option C:** Test route handlers directly (pass mock req/res). Faster but
  doesn't test routing logic.

### `test/api.test.mts`

**Character CRUD:**
- `GET /api/v1/characters?playerId=X` → player's characters
- `GET /api/v1/characters` + DM token → all characters
- `GET /api/v1/characters` no auth → 400
- `POST /api/v1/characters` valid → 201 + generated id/backupCode
- `POST /api/v1/characters` invalid JSON → 400
- `POST /api/v1/characters` validation failure → 400 + details
- `POST /api/v1/characters` server-controlled fields → stripped
- `GET /api/v1/characters/:id` as owner → 200 + full data
- `GET /api/v1/characters/:id` as public → 200 + sanitized (no backupCode)
- `GET /api/v1/characters/:id` as DM → 200 + full data
- `GET /api/v1/characters/:id` non-existent → 404
- `GET /api/v1/characters/:id` deleted + non-DM → 404
- `PATCH /api/v1/characters/:id` valid → 200 + recalculated character
- `PATCH /api/v1/characters/:id` no auth → 403
- `PATCH /api/v1/characters/:id` public role → 403
- `PATCH /api/v1/characters/:id` server-controlled field → 422
- `PATCH /api/v1/characters/:id` empty updates → 400
- `PATCH /api/v1/characters/:id` non-existent → 404
- `DELETE /api/v1/characters/:id` as owner → 200 soft delete
- `DELETE /api/v1/characters/:id` wrong player → 403
- `DELETE /api/v1/characters/:id` as DM → 200 hard delete
- `DELETE /api/v1/characters/:id` invalid DM token → 401
- `DELETE /api/v1/characters/:id` no auth → 400

**Recovery & DM endpoints:**
- `POST /api/v1/recover` correct credentials → 200
- `POST /api/v1/recover` wrong code → 404
- `POST /api/v1/recover` malformed body → 400
- `GET /api/v1/dm/validate` valid token → 200
- `GET /api/v1/dm/validate` invalid token → 400

**Schema & config:**
- `GET /api/v1/schema` → 200 + JSON + ETag
- `GET /api/v1/schema` with matching `If-None-Match` → 304
- `GET /api/v1/config` → 200 + config shape

**CORS:**
- `OPTIONS` any path → 200 with CORS headers

**Static file serving:**
- `/` → `index.html`
- SPA fallback for unknown paths → `index.html`
- `/assets/...` → correct MIME type
- Path traversal attempt → blocked

**WoW addon integration considerations:**

**Review at session start:** Check current state of `docs/addon-integration.md`
for expected API surface. Evaluate:
- Does the addon need a dedicated export endpoint?
- Can existing `GET /api/v1/characters/:id` serve addon needs (with proper
  Accept header or query param)?
- What serialization format does the addon expect (JSON → Lua table conversion)?

Any addon-specific endpoints that exist by this session get tested here.
If no addon endpoints exist yet, document what the addon will need and
add placeholder test structure.

### Session 6 verification

```bash
npm test                    # Including API tests
npm run typecheck
```

**Estimated scope:** ~60–80 test cases. High setup effort.

---

## Session 7 — SSE Broadcast

**Goal:** Test real-time event broadcasting, client management, and
keep-alive behavior.

**Create:**
- `test/helpers/mock-response.mts`
- `test/sse.test.mts`

### `test/sse.test.mts` — `src/sse/broadcast.mts`

**Setup:** SSE module uses an in-memory `Map`. No filesystem. Mock
`ServerResponse` objects need `write()`, `on()`, and optionally `writeHead()`.

**`addClient` / `removeClient`:**
- Add client → subsequent broadcast reaches it
- Remove client → no longer receives broadcasts
- Remove last client for character → cleanup (no leftover map entry)
- Remove non-existent client → no crash
- `res.on('close')` handler registered during `addClient`

**`broadcastToCharacter`:**
- Single client → receives `event: character-updated\ndata: {...}\n\n`
- Multiple clients → all receive same event
- No clients for character → no-op
- Client whose `write()` throws → that client removed, others still receive
- Event data contains `type: "character-updated"`, `character` object, `timeStamp`

**`sendKeepAlive`:**
- Connected clients receive `: keepalive\n\n`
- Failed write → client removed
- No clients → no-op

**SSE handler integration (optional — may fold into Session 6 API tests):**
- `handleCharacterStream` sets correct headers
- Initial `connected` event sent on connection
- `close` event triggers cleanup

### Session 7 verification

```bash
npm test
npm run typecheck
```

**Estimated scope:** ~20–30 test cases.

---

## Session 8 — RPG Engine (Post-Phase 6, Ongoing)

**Goal:** Build real RPG engine test coverage as Phase 6 delivers new code.
This is an ongoing session that runs in parallel with Phase 6 steps.

**Rewrite/create:**
- `test/rules/attributes.test.mts` — typed `PrimaryAttributes` inputs
- `test/rules/applicator.test.mts` — canonical verbs, exhaustive `switch`
- `test/rules/derived.test.mts` — typed pipeline phases
- `test/rules/effects.test.mts` — `collectAllEffects()` merging
- `test/rules/registry.test.mts` — reference data loading, target
  deserialization, startup validation
- `test/rules/combat.test.mts` — multi-weapon, attack attribute, bonus damage

**WoW addon integration (continued):**
- Test export/sync endpoints that Phase 7 adds
- Test Lua-compatible serialization if implemented
- Test data contracts the addon expects

**Dependency on Phase 6 milestones:**

| Phase 6 Step | Unlocks |
|---|---|
| Step 0 — Foundation rework | Typed pipeline, phase ordering, new verbs |
| Step 2 — Effect normalization | Ability/spell effect resolution |
| Step 4 — Pipeline wiring | `collectAllEffects` with real data |
| Step 5 — Combat derivation | Multi-weapon, bonus damage |

**RPG engine test categories (designed to span multiple files):**

1. **Formula correctness** — secondary attribute formulas with all primary
   attribute combinations (extends Session 4 `attributes.test.mts`)
2. **Effect phase ordering** — `setBase` before `addFlat` before `multiply`
   before `cap`. Verify that swapping order produces different results.
3. **Target deserialization** — JSON → `EffectTarget` union validation.
   Invalid `kind`, missing required fields, unknown discriminant.
4. **Modifier application** — each modifier type × each target kind.
   Exhaustive matrix.
5. **Effect collection** — traits, equipment, temporary effects merged
   correctly. Source metadata preserved.
6. **Combat derivation** — multi-weapon slot indexing, damage aggregation,
   attack attribute override from abilities.
7. **Flag resolution** — Tier B flags (advantage, immunity, etc.) set and
   queryable on character state.
8. **Constraint enforcement** — post-pipeline clamping, negative value
   prevention, mutual exclusivity of conflicting effects.

### Session 8 verification

```bash
npm test
npm run typecheck
```

**Estimated scope:** Ongoing — grows with Phase 6 deliverables.

---

## Phase 4 Exit Criteria

Phase 4 is complete when:

- [ ] All sessions 1–7 are done
- [ ] `npm test` runs green
- [ ] `npm run typecheck` passes
- [ ] Old `test/character-creation.test.mts` deleted
- [ ] Test count is documented (update roadmap)
- [ ] Coverage gaps for RPG engine are tracked for Session 8
- [ ] Sibling integration test foundations exist:
  - [ ] `test/data-contracts.test.mts` (character shape for bot)
  - [ ] Addon test needs documented and placeholder structure in place
