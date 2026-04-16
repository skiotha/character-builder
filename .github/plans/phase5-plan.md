# Phase 5 — Bug Fixes & Hardening: Multi-Session Plan

> Detailed implementation plan for [Phase 5](../../docs/roadmap.md#phase-5--bug-fixes--hardening).
> Each session leaves the project in a working state with all tests passing.
> Pure logic fixes first, then security, then HTTP-layer hardening, then cleanup.
>
> **Basis:** Phase 4 test suite (385 tests), Phase 4 bug trackers
> (`/memories/repo/api-infra-bugs.md`, `/memories/repo/engine-weak-points.md`),
> roadmap Phase 5 audit.

---

## Current State (pre-Phase 5)

- **Test suite:** 385 tests across 11 files, all passing (`npm test`)
- **Typecheck:** `npm run typecheck` clean
- **Known bugs:** 2 tracker files document all issues with bug numbers
- **Already fixed in Phase 4:** `FIELDS_WITH_VALIDATION` inversion (bug),
  ADR-012 documentation (low-priority done item)
- **Already fixed since original audit:** `idDM` typo → `isDM`,
  `characrer` typo → `character`, `fileUploader.mjs` no longer exists
  (removed during Phase 1 restructure), `buffer.slice` in multipart
  parser no longer exists

### Items verified as still open (code-confirmed April 2026)

| Bug | File | Line | Status |
|-----|------|------|--------|
| `validateCharacterCreation()` commented out | `src/models/index.mts` | 13 | Open — call commented out |
| `generateDefaultCharacter` leaks serverControlled | `src/models/schema-utils.mts` | 96 | Open — empty if-block, no `continue` |
| `validateRPGRules` under-budget | `src/models/schema-utils.mts` | 240 | Open — `> 80` only |
| XP check unreachable + wrong | `src/models/validation.mts` | 175-190 | Open — dead code |
| `increment` on traits dead code | `src/models/validation.mts` | 163-173 | Open — commented-out block |
| Duplicate `deepMerge`/`isObject` | `src/models/index.mts` | 124-150 | Open — copy-paste from traversal |
| Dead `xp.mts` | `src/rules/xp.mts` | 1-5 | Open — comment only |
| `crypto.timingSafeEqual` missing | `src/lib/auth.mts` | 7, 18 | Open — uses `===` |
| No sanitization on list/update/recover/SSE | Multiple files | — | Open — only GET single sanitizes |
| Portrait upload no auth | `src/routes/handleUploadPortrait.mts` | — | Open — zero auth checks |
| SSE auth commented out | `src/routes/handleStreamCharacter.mts` | 21-37 | Open — two auth blocks commented |
| SSE broadcast unsanitized | `src/sse/broadcast.mts` | 62 | Open — raw `characterData` |
| No body size limits | 6 sites across app.mts + handlers | — | Open — unlimited accumulation |
| CORS `*` hardcoded | `src/app.mts` | 186 | Open — `Access-Control-Allow-Origin: *` |
| Crash on undefined effect target | `src/rules/derived.mts` | 62 | Open — `effect.target!` on undefined |
| `timeStamp` camelCase in broadcast | `src/sse/broadcast.mts` | 63 | Open — should be `timestamp` |
| DELETE handler inline in app.mts | `src/app.mts` | 274-315 | Open — not extracted |
| Middleware chain type mismatch | `src/middleware/index.mts` | 9 | Open — `finalHandler` unused |
| Duplicate `updateCharacter` | `src/models/index.mts` vs `storage.mts` | — | Open |
| Duplicate `byId` builder | `src/models/storage.mts` | 71, 90 | Open — TODO comment present |
| `handleGetCharacters` TODO + unsanitized | `src/routes/handleGetCharacters.mts` | 14 | Open |
| Recovery endpoint weak keyspace | `src/lib/utils.mts` | — | Open — 32K combinations |

---

## Scope Decisions

### Items relocated to Phase 6 (RPG Engine dependency)

These items require the typed effect pipeline, reference data, or RPG rules
engine to implement properly. They cannot be fixed in isolation.

| Item | Why Phase 6 |
|------|-------------|
| Align effect modifier types (`add`/`mul`/`set` → canonical) | Applicator rewrite in Step 0 |
| Fix `rpgValidators` — all return `true` | Needs real RPG rule definitions |
| Add `schemaVersion` bumping on schema changes | Schema migration tied to engine changes |
| `combat.bonusDamage` array→number type change | Needs effect resolution pipeline (Step 0) |

### Items relocated to Phase 8 (Client-side / DOM dependency)

These items are client-only, require DOM testing infrastructure, or are UX
polish that doesn't affect server correctness.

| Item | Why Phase 8 |
|------|-------------|
| Client-Side Validation Redesign (entire subsection) | Needs DOM environment + served schema redesign |
| Creation View UX Bugs (entire subsection — 7 items) | Client-only, needs manual testing |
| Client Import Map Aliases | Client cosmetic cleanup |
| Fix client router empty-hash navigation | Client-only bug |
| Verify role-based editability (owner, DM, public) | DM login requires local env — manual test |
| Watcher rewrite (`scripts/watcher.mts`) | Standalone script, no urgency |

### Items already resolved (remove from Phase 5)

| Item | Resolution |
|------|------------|
| `fileUploader.mjs` size check | File no longer exists (Phase 1 restructure). Client check is active in `portraitHandler.mjs` line 89. Server-side limit handled via new body size limit utility. |
| `buffer.slice` → `buffer.subarray` | No `.slice()` on Buffer found in multipart or anywhere in `src/`. Already resolved. |
| `idDM` → `isDM` typo | Already fixed. Only appears in roadmap description. |
| `characrer` → `character` typo | Already fixed. Only appears in roadmap description. |
| DM login fails with 400 in development | Dev-only issue. Not a code bug — missing local env file. Document in README. |

---

## Session 0 — Roadmap Audit & Item Relocation

**Goal:** Update `docs/roadmap.md` to reflect the scope decisions above.
Relocate deferred items to Phase 6 and Phase 8 without losing any information.
Update tracker files. Produce the final Phase 5 plan file.

### Tasks

1. ~~**Update Phase 5 in `docs/roadmap.md`:**~~ ✅ Done
   - Marked resolved: fileUploader, buffer.slice, SSE typos, DM login
   - Removed relocated items with cross-references to Phase 6/8
   - `timeStamp` typo fix kept (open, stays in Phase 5)

2. ~~**Update Phase 6 in `docs/roadmap.md`:**~~ ✅ Done
   - Added "Items Relocated from Phase 5" subsection (4 items)

3. ~~**Update Phase 8 in `docs/roadmap.md`:**~~ ✅ Done
   - Added "Items Relocated from Phase 5" subsection (6 items)

4. ~~**Update tracker files:**~~ ✅ Done
   - `/memories/repo/api-infra-bugs.md` — session numbers assigned
   - `/memories/repo/engine-weak-points.md` — session numbers assigned

5. ~~**Create `.github/plans/phase5-plan.md`**~~ ✅ Done — this file

### Verification

- [x] All items from Phase 5 are either: staying (with session assignment),
  relocated (with Phase 6/8 cross-reference), or marked resolved
- [x] No item is lost — full diff reviewed, all content accounted for
- [x] `npm run typecheck` still passes (no code changes)
- [x] `npm test` still passes (385/385, no code changes)

### Files modified

- `docs/roadmap.md` — Phase 5, 6, 8 sections
- `.github/plans/phase5-plan.md` — new file (this plan)

---

## Session 1 — Service Layer & Validation Fixes ✓ DONE

**Goal:** Fix pure logic bugs in the model/service layer. All fixes testable
with existing unit test infrastructure — no HTTP server needed.

**Result:** All 6 tasks complete. 386 tests passing (was 385). Typecheck clean.
`schemaVersion` stamping moved to `createCharacter()` service (Option A).
Dead XP code removed — will be rebuilt properly in Phase 6.

### Tasks

1. **Fix `generateDefaultCharacter()` serverControlled leak**
   - **File:** `src/models/schema-utils.mts` line 96
   - **Change:** Add `continue` after the `SERVER_CONTROLLED_FIELDS.includes()`
     check so traversal skips to the next field
   - **Reference:** The if-block at line 96 is empty — fields like
     `schemaVersion` (both `serverControlled: true` and has `default`) leak
     into generated character

2. **Fix `validateRPGRules` under-budget check**
   - **File:** `src/models/schema-utils.mts` line 240
   - **Change:** Replace `if (primaryTotal > 80)` with `if (primaryTotal !== 80)`.
     Use a distinct error message for under-budget vs over-budget:
     - Over: "Total primary attributes (N) exceed budget of 80"
     - Under: "Total primary attributes (N) do not use full budget of 80"
   - **Bug #17** — api-infra-bugs tracker

3. **Remove dead XP code from `validateCharacterUpdate`**
   - **File:** `src/models/validation.mts` lines 163-190
   - **Change:** Delete the commented-out `increment` block (lines 163-173)
     AND the unreachable `push` XP check block (lines 175-190). Both are
     dead code — XP validation belongs in Phase 6 rules layer.
   - **Bug #15** — engine-weak-points tracker

4. **Remove duplicate `deepMerge`/`isObject` in index.mts**
   - **File:** `src/models/index.mts` lines 124-150
   - **Change:** Delete both functions, add `import { deepMerge } from "./traversal.mts"`
   - **Verify:** The service-layer `updateCharacter()` in index.mts uses this
     `deepMerge` — ensure it still works after switching to the traversal
     version (which has `skipUndefined` support)

5. **Fix `createCharacter()` service — remove dead code, clarify ownership**
   - **File:** `src/models/index.mts` lines 8-29
   - **Change:** The handler (`handleCreateCharacter.mts`) already calls
     `validateCharacterCreation()` and passes `validation.validatedData!` to
     `createCharacter()`. The service-layer call on line 13 is both commented
     out AND redundant. The commented-out `generateDefaultCharacter` block
     (lines 15-19) is also redundant — the handler produces validated+merged data.
     **Decision:** Remove the commented-out code. The service function becomes
     a thin wrapper: receive validated data → stamp `id` + `backupCode` → save.
     The handler owns validation. This is the correct layering.
   - **Note:** The roadmap item says "re-enable" but the handler already does
     validation. Re-enabling it in the service would double-validate. Clean
     removal of dead code is the right fix.

6. **Delete dead `xp.mts`**
   - **File:** `src/rules/xp.mts`
   - **Change:** Delete file. Contains only a 5-line comment describing
     intended client flow. XP calculation will be implemented in Phase 6.
   - Check for imports of this file and remove them.

### New/Updated Tests

- **`test/validation.test.mts`:**
  - Update "All attributes at default 5 (total 40) → pass" test to expect
    **failure** with `BUSINESS_RULE` code (under-budget). This was documented
    as a known bug in Phase 4 — now it becomes the correct behavior.
  - Verify the `INSUFFICIENT_XP` path is no longer reachable (remove or update
    any test that expected it). Check existing test for this.

- **`test/utils.test.mts`** (or new dedicated test):
  - Add test: `generateDefaultCharacter()` does NOT include `schemaVersion`
    in output (or any other serverControlled field with a default).
  - Add test: `generateDefaultCharacter()` DOES include non-serverControlled
    fields with defaults.

- **`test/storage.test.mts`** (existing):
  - Verify `createCharacter` → `saveCharacter` flow still works after
    removing duplicate `deepMerge`.

### Verification

- `npm run typecheck` clean
- `npm test` — all tests pass with updated expectations
- No references to deleted `xp.mts` remain

### Files modified

- `src/models/schema-utils.mts` — `generateDefaultCharacter`, `validateRPGRules`
- `src/models/validation.mts` — remove dead XP blocks
- `src/models/index.mts` — remove duplicate functions, clean `createCharacter`
- `src/rules/xp.mts` — DELETE
- `test/validation.test.mts` — update budget expectations, remove XP test
- `test/utils.test.mts` or `test/schema-utils.test.mts` — new `generateDefaultCharacter` tests

---

## Session 2 — Security Hardening

**Goal:** Fix all authentication, authorization, and data exposure bugs.
These are the highest-impact security issues in the codebase.

### Tasks

1. **Use `crypto.timingSafeEqual()` for DM token comparison**
   - **File:** `src/lib/auth.mts`
   - **Change:** Replace `token === DM_TOKEN` with timing-safe comparison
     in both `requireDmToken` (line 7) and `validateDmToken` (line 18).
     Must handle: (a) `DM_TOKEN` being undefined (dev without env file),
     (b) different-length strings (pad or early-return false — `timingSafeEqual`
     requires same-length buffers).
   - **Pattern:** `Buffer.from(a).length === Buffer.from(b).length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`

2. **Add auth to portrait upload**
   - **File:** `src/routes/handleUploadPortrait.mts`
   - **Change:** Add ownership/DM check before processing upload. Options:
     (a) Wrap with `withCharacterPermissions` middleware in the route wiring,
     or (b) add inline check: read `x-player-id` header, compare to
     `character.playerId`, check `x-dm-id` with `validateDmToken`. Reject
     if role is `public` (no player ID and not DM).
   - **Bug #25** — api-infra-bugs tracker
   - **Reference:** `handleGetCharacter.mts` uses `withCharacterPermissions`
     via `characterRoutes.mts` — follow same pattern

3. **Consistent sanitization across all response paths**
   - **Files:** `src/routes/handleGetCharacters.mts`,
     `src/routes/handleUpdateCharacter.mts`,
     `src/sse/broadcast.mts`, `src/app.mts` (recover endpoint)
   - **Changes:**
     - `handleGetCharacters.mts` line 18 (DM list): sanitize each character
       for `"dm"` role
     - `handleGetCharacters.mts` line 30 (player list): sanitize each
       character for `"owner"` role
     - `handleUpdateCharacter.mts` line 96: sanitize response for
       `userRole` (already computed on line 52)
     - `app.mts` recover endpoint line 338: sanitize for `"owner"` role
       (player proved ownership via backup code)
     - `broadcast.mts` line 62: sanitize per subscriber using `client.isDM`
       and `client.playerId` vs `characterData.playerId` to determine role.
       Each subscriber may get a different payload.
   - **Exception:** POST create 201 response in `handleCreateCharacter.mts`
     should include `backupCode` — owner needs it on first creation. No
     change needed there.
   - **Bug #27** — api-infra-bugs tracker

4. **Resolve `handleGetCharacters` TODO**
   - **File:** `src/routes/handleGetCharacters.mts` line 14
   - **Change:** Fix typo in comment ("handing" → "handling"). The DM path is
     functional and auth-gated — keep it. Sanitization from task 3 addresses
     the data exposure concern.
   - **Bug #28** — api-infra-bugs tracker

### New/Updated Tests

- **`test/auth.test.mts`:**
  - Update existing test that documents `===` as a bug — change to assert
    timing-safe comparison is used (or test behavior: same-result for valid
    token regardless of prefix match)
  - Add test: `validateDmToken` returns `false` when `DM_TOKEN` is undefined
  - Add test: `requireDmToken` throws when `DM_TOKEN` is undefined

- **`test/sanitization.test.mts`:**
  - Existing 5 tests cover `sanitizeCharacterForRole` behavior — no changes
    needed to the function itself

- **`test/api.test.mts`:**
  - Add test: `GET /characters?playerId=X` response does NOT contain
    `backupCode` for any character
  - Add test: `PATCH /characters/:id` response does NOT contain `backupCode`
    (for non-create responses)
  - Add test: `POST /recover` response does NOT contain `backupCode` (the
    recovery response gives you the character but you already proved you have
    the backup code — still sanitize the response payload for safety)
  - Add test: `POST /characters/:id/portrait` without `x-player-id` → 401 or 403
  - Add test: `POST /characters/:id/portrait` with wrong player → 403

- **`test/sse.test.mts`:**
  - Add test: broadcast to subscriber sanitizes payload (no `backupCode`
    visible to non-owner subscriber)

### Verification

- `npm run typecheck` clean
- `npm test` — all tests pass
- Manual: create a character, GET list — confirm no `backupCode` in response
- Manual: subscribe to SSE stream — confirm no `backupCode` in events

### Files modified

- `src/lib/auth.mts` — timing-safe comparison
- `src/routes/handleUploadPortrait.mts` — add auth check
- `src/routes/handleGetCharacters.mts` — sanitize + fix TODO comment
- `src/routes/handleUpdateCharacter.mts` — sanitize response
- `src/sse/broadcast.mts` — per-subscriber sanitization
- `src/app.mts` — sanitize recover response
- `test/auth.test.mts` — update timing-safe tests
- `test/api.test.mts` — add sanitization integration tests
- `test/sse.test.mts` — add sanitization broadcast test

---

## Session 3 — Request Safety (Body Limits, SSE Auth, CORS)

**Goal:** HTTP-layer hardening. Body size limits, SSE auth re-enablement,
and CORS origin whitelisting.

### Tasks

1. **Create `readBody()` utility with size limit**
   - **File:** New `src/lib/body.mts` (or add to `src/lib/utils.mts`)
   - **Function:** `readBody(req: IncomingMessage, maxBytes: number): Promise<string>`
     - Accumulates chunks, tracks total size
     - Rejects with 413 (Payload Too Large) if limit exceeded
     - Destroys the request stream on rejection to stop reading
   - **Constants:** `MAX_JSON_BODY = 1_048_576` (1 MB),
     `MAX_UPLOAD_BODY = 20_971_520` (20 MB)

2. **Apply body size limits to all 6 body-reading sites**
   - Replace `let body = ""; req.on("data", ...)` pattern with `readBody()`:
     - `src/routes/handleCreateCharacter.mts` — 1 MB limit
     - `src/routes/handleUpdateCharacter.mts` — 1 MB limit
     - `src/app.mts` recover endpoint (~line 327) — 1 MB limit
     - `src/app.mts` backup-create endpoint (~line 385) — 1 MB limit
     - `src/app.mts` backup-restore endpoint (~line 439) — 1 MB limit
     - `src/lib/multipart.mts` `parseImage()` — 20 MB limit (upload)
   - **Bug #25** — api-infra-bugs tracker

3. **Re-enable SSE stream auth**
   - **File:** `src/routes/handleStreamCharacter.mts` lines 21-37
   - **Change:** Uncomment both auth blocks (401 unauthorized + 403 forbidden).
   - **EventSource limitation:** `EventSource` API cannot send custom headers.
     Current code already supports query-param auth: `url.searchParams.get("playerId")`
     and `url.searchParams.get("dmId")` on lines 14-17. This is sufficient
     for the trusted userbase (ADR-003). The commented-out code is already
     wired to use these params.
   - **Bug #26** — api-infra-bugs tracker
   - **Note:** SSE broadcast sanitization was handled in Session 2.

4. **Implement CORS origin whitelisting (ADR-007)**
   - **File:** `src/app.mts` line 186 + `src/lib/config.mts`
   - **Change:**
     - Add `CORS_ORIGINS: string[]` to config (read from env, default to
       `["http://localhost:3000"]` in dev, `["https://nagara.team"]` in prod)
     - Replace `res.setHeader("Access-Control-Allow-Origin", "*")` with
       origin check: if `req.headers.origin` is in the whitelist, reflect it
       back; otherwise omit the header (browser will reject the request)
     - Also set `Vary: Origin` header when reflecting

### New/Updated Tests

- **`test/api.test.mts`:**
  - Add test: POST body exceeding 1 MB → 413 response
  - Add test: POST body at exactly 1 MB → accepted
  - Add test: CORS preflight with allowed origin → correct headers
  - Add test: CORS preflight with disallowed origin → no `Access-Control-Allow-Origin`

- **`test/sse.test.mts`:**
  - Add test: SSE connect without playerId or dmId → 401
  - Add test: SSE connect with wrong playerId for character → 403
  - Add test: SSE connect with valid playerId → 200 + event stream
  - Update existing connection test to pass auth params

- **New `test/body.test.mts`** (or section in api.test.mts):
  - Unit test `readBody()` with mock request stream
  - Test: stream under limit → resolves with body string
  - Test: stream over limit → rejects with appropriate error
  - Test: empty stream → resolves with empty string

### Verification

- `npm run typecheck` clean
- `npm test` — all tests pass
- Manual: `curl` with oversized body → 413
- Manual: SSE connect without auth → 401
- Manual: cross-origin request from non-whitelisted origin → blocked

### Files modified

- `src/lib/body.mts` — new file (readBody utility)
- `src/lib/config.mts` — add CORS_ORIGINS
- `src/routes/handleCreateCharacter.mts` — use readBody
- `src/routes/handleUpdateCharacter.mts` — use readBody
- `src/routes/handleStreamCharacter.mts` — uncomment auth
- `src/lib/multipart.mts` — use readBody / add size limit
- `src/app.mts` — use readBody for inline handlers, CORS whitelisting
- `test/api.test.mts` — body limit + CORS tests
- `test/sse.test.mts` — auth tests
- `test/body.test.mts` — new file (unit tests for readBody)

---

## Session 4 — Engine Crash Fix & Code Cleanup

**Goal:** Fix the one critical engine crash bug and clean up dead code,
typos, and structural debt.

### Tasks

1. **Fix crash on undefined effect target**
   - **File:** `src/rules/derived.mts` line 62
   - **Change:** Add `effect.target &&` guard before calling `applyEffect`:
     ```
     if (effect.target && !effect.target.startsWith("rules.")) {
       applyEffect(result, effect.target, effect.modifier);
     }
     ```
     Remove the `!` non-null assertion. The guard now correctly skips effects
     with no target (instead of crashing) AND skips `"rules."` prefix effects
     (already handled in the setBase loop above).
   - **Bug #18** — engine-weak-points tracker

2. **Fix `timeStamp` → `timestamp` in broadcast**
   - **File:** `src/sse/broadcast.mts` line 63
   - **Change:** Rename `timeStamp` to `timestamp` in the event payload.
   - **Check client:** Search `public/` for any code reading `timeStamp` from
     SSE events and update to `timestamp`.

3. **Extract DELETE handler to dedicated file**
   - **Files:** `src/app.mts` lines 274-315, new `src/routes/handleDeleteCharacter.mts`
   - **Change:** Move the inline DELETE handler into a proper handler file
     following the same signature as other handlers. Wire it in `app.mts`
     via import.

4. **Remove dead/commented code sweep**
   - **Files:** Multiple
   - **Changes:**
     - Remove `console.log("ERRORS ON PATCH", errors)` debug line in
       `handleUpdateCharacter.mts` line 72
     - Remove any remaining `// prettier-ignore` if not needed
     - Remove unused imports after Session 1-3 changes
     - Audit for other commented-out blocks beyond what was already cleaned

5. **Fix duplicate `updateCharacter()` — service vs storage**
   - **File:** `src/models/index.mts` lines 58-67
   - **Change:** The service-layer `updateCharacter()` does
     `deepMerge` + stamp `lastModified` + `saveCharacter()`. The storage-layer
     `updateCharacter()` does `deepMerge` + stamp `lastModified` +
     `writeCharacterFile()` + conditional `updateIndexMetadata()`.
     The handler (`handleUpdateCharacter.mts`) calls `storage.updateCharacter`
     directly (line 1: `import { updateCharacter } from "#models/storage"`).
     **Decision:** The handler should call the service. The service should call
     storage. Remove the service-layer duplicate or make the handler use it.
     Currently the storage version is more complete (handles index metadata).
     Simplest fix: remove the service-layer `updateCharacter` from index.mts
     and keep the storage version. The handler already imports from storage.

6. **Extract shared `byId` index-entry builder in storage.mts**
   - **File:** `src/models/storage.mts` lines 71-77 and 90-96
   - **Change:** Extract the duplicated object literal into a helper function
     `buildIndexEntry(character)` that both `updateIndexMetadata()` and
     `saveCharacter()` call.

### New/Updated Tests

- **`test/rules/derived.test.mts`:**
  - Add test: effect with `target: undefined` does NOT crash — is silently
    skipped. Update any existing test that expected a crash.
  - Add test: effect with `target: undefined` + other valid effects — valid
    effects still applied correctly.

- **`test/storage.test.mts`:**
  - Verify index metadata consistency after `updateCharacter` and
    `saveCharacter` (existing tests likely cover this — verify).

- **`test/api.test.mts`:**
  - Add test: `DELETE /characters/:id` with owner auth → success
  - Add test: `DELETE /characters/:id` without auth → failure

### Verification

- `npm run typecheck` clean
- `npm test` — all tests pass
- Grep for `effect.target!` in derived.mts → zero results
- Grep for `timeStamp` in broadcast.mts → zero results
- No inline handlers remain in app.mts (DELETE extracted)

### Files modified

- `src/rules/derived.mts` — guard undefined target
- `src/sse/broadcast.mts` — fix timeStamp
- `src/app.mts` — extract DELETE, cleanup
- `src/routes/handleDeleteCharacter.mts` — new file
- `src/routes/handleUpdateCharacter.mts` — remove debug log
- `src/models/index.mts` — remove duplicate updateCharacter
- `src/models/storage.mts` — extract byId builder
- `test/rules/derived.test.mts` — undefined target test
- `test/api.test.mts` — DELETE endpoint tests

---

## Session 5 — Middleware Architecture & Storage Safety (Stretch)

**Goal:** Fix the middleware chain type lie and add write serialization for
storage. These are medium-priority architectural improvements that don't
affect user-visible behavior but improve type safety and data integrity.

**Note:** This session is optional. If the prior sessions have addressed all
high and medium items, this can be deferred or folded into Phase 6 prep.

### Tasks

1. **Fix middleware chain type mismatch**
   - **Files:** `src/middleware/index.mts`, `src/types.mts`,
     `src/routes/characterRoutes.mts`
   - **Change:** Option (a) — use `finalHandler` parameter as intended:
     - `createMiddlewareChain(...middlewares)` returns a handler that accepts
       `(req, res, pathParts)`
     - Route wiring passes the terminal handler as `finalHandler`:
       `createMiddlewareChain(withCharacterPermissions)(req, res, pathParts, handleGetCharacter)`
     - This way, `handleGetCharacter` is NOT in the `middlewares` array and
       doesn't need the `next` parameter
     - Revert `boolean | void` return type widening from Phase 2
   - **Alternative (b):** Create a `createRoute(middleware[], handler)` helper
     that has distinct types for middleware vs terminal handler. Evaluate
     which approach is cleaner during implementation.

2. **Add write serialization for storage**
   - **File:** `src/models/storage.mts`
   - **Change:** Add per-character write lock using a simple `Map<string, Promise>`.
     Before writing, await the previous write promise for the same character ID.
     Chain writes sequentially per character, allow parallel writes to
     different characters.
   - **Pattern:**
     ```
     const writeLocks = new Map<string, Promise<void>>();
     async function withWriteLock(id, fn) {
       const prev = writeLocks.get(id) ?? Promise.resolve();
       const next = prev.then(fn, fn); // run even if prev failed
       writeLocks.set(id, next);
       return next;
     }
     ```

3. **Harden recovery endpoint (stretch)**
   - **File:** `src/lib/utils.mts`
   - **Change:** Expand backup code keyspace — add more adjectives and nouns
     (20+ each), use 4-digit numbers (0000-9999). This increases keyspace
     from ~32K to ~4M+ combinations.
   - Rate limiting: add a simple in-memory rate limiter for
     `POST /api/v1/recover` — max 5 attempts per character name per minute.
   - **Bug #29** — api-infra-bugs tracker

### New/Updated Tests

- **`test/api.test.mts`:**
  - Existing middleware/route tests should still pass after refactor
  - Add test: concurrent PATCH requests to same character don't corrupt data

- **`test/storage.test.mts`:**
  - Add test: two concurrent `saveCharacter` calls to same ID → both succeed,
    last write wins (no file corruption)
  - Add test: concurrent writes to different characters → both succeed
    independently

- **`test/utils.test.mts`:**
  - Add test: `generateBackupCode()` format matches expected pattern with
    expanded keyspace
  - Add test: recovery rate limiting blocks after N attempts

### Verification

- `npm run typecheck` clean — this is the key test for middleware types
- `npm test` — all tests pass
- No `boolean | void` return types remain in middleware chain types

### Files modified

- `src/middleware/index.mts` — redesign chain
- `src/types.mts` — update middleware types
- `src/routes/characterRoutes.mts` — use new chain API
- `src/models/storage.mts` — add write locks
- `src/lib/utils.mts` — expand keyspace
- `src/app.mts` — add rate limiting to recover endpoint
- `test/api.test.mts` — concurrency tests
- `test/storage.test.mts` — write lock tests
- `test/utils.test.mts` — backup code format tests

---

## Summary: Session Dependency Map

```
Session 0 (docs)
    │
    ├──→ Session 1 (validation/service) ──→ Session 2 (security)
    │                                            │
    │                                            ▼
    └──────────────────────────────────→ Session 3 (HTTP safety)
                                                 │
                                                 ▼
                                          Session 4 (crash fix + cleanup)
                                                 │
                                                 ▼
                                          Session 5 (stretch — architecture)
```

- **Session 0** is a prerequisite for all — establishes the final scope
- **Session 1** has no runtime dependencies — pure logic fixes
- **Session 2** has a soft dependency on Session 1 (understanding which layer
  owns validation matters for sanitization decisions)
- **Session 3** is independent of Session 2 but benefits from it (SSE
  sanitization in S2 + SSE auth in S3 are complementary)
- **Session 4** is cleanup — benefits from all prior fixes being in place
- **Session 5** is a stretch goal — can be deferred to Phase 6 prep

## Test Count Estimates

| Session | New Tests | Updated Tests | Files |
|---------|-----------|---------------|-------|
| 0 | 0 | 0 | 0 |
| 1 | ~5 | ~3 | 2-3 test files |
| 2 | ~8 | ~2 | 3 test files |
| 3 | ~10 | ~2 | 3 test files |
| 4 | ~4 | ~2 | 2-3 test files |
| 5 | ~5 | ~1 | 2-3 test files |
| **Total** | **~32** | **~10** | — |

Expected final count: ~385 (existing) + ~32 (new) - ~5 (removed/merged) ≈ **~412 tests**.
