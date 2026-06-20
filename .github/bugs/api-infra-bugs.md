# API & Infrastructure — Weak Points Tracker

> Extracted from `engine-weak-points.md` (2026-04-15) — these items are about
> API, HTTP, security, storage, or validation infrastructure, not RPG engine logic.
> Each item remains here until explicitly resolved. Resolved items get a ✅ and date.
> Items already tracked in roadmap are marked with 📋.
>
> Original numbering preserved for cross-reference with phase4-plan.md Session results.
>
> **Location note:** This file lived under `/memories/repo/` until 2026-04-21,
> when both trackers were moved into the repo proper at `.github/bugs/`. Repo
> memory only supports `create`, so mutable trackers belonged in the source tree.

## HIGH — Significant Risk

### 25. Portrait upload has zero auth checks
- **Status:** ✅ Resolved — Phase 5 Session 2. Added `src/routes/portraitRoutes.mts` wrapping `handleUploadPortrait` with `withCharacterPermissions`; handler rejects role `"public"`. Also fixed `finally { return true }` swallow-bug in close-handler — now explicit per-path returns.

### 25a. No request body size limits on any endpoint
- **Status:** ✅ Resolved — Phase 5 Session 3 (2026-04-18). New `src/lib/body.mts` with `readBody`/`readBodyBuffer` + `BodyTooLargeError`. Applied to all 6 body-reading sites (handleCreate, handleUpdate, multipart/parseImage, recover, backup-create, backup-restore). JSON limit: 1 MB, upload limit: ~21 MB. `BodyTooLargeError` → 413 response.

### 26. SSE stream auth commented out + unsanitized broadcast
- **Status:** ✅ Resolved — Phase 5 Session 2. (a) 401/403 blocks uncommented in `handleStreamCharacter.mts`; query-param auth (`?playerId` / `?dmId`) used since EventSource can't set headers. (b) `broadcast.mts` now sanitizes per subscriber via `sanitizeCharacterForRole`, and `sanitizeCharacterForRole` itself was fixed to clone-then-delete (previously mutated input).

## MEDIUM — Address During Hardening

### 30. Duplicate `updateCharacter` — service vs storage (ADR-013)
- **Where:** `src/models/index.mts` `updateCharacter` and `src/models/storage.mts` `updateCharacter`
- **Impact:** Two implementations with different semantics — storage uses `skipUndefined: true` and conditional index update; service version doesn't. `handleUploadPortrait` uses the service version, exposing a latent `undefined`-clobbers-fields bug. Also no place for cross-cutting invariants (recalc, broadcast, write lock). Handlers/middleware import ad-hoc from either `#models` or `#models/storage`.
- **Fix:** ADR-013 — domain layer is the mutation gate. Single `updateCharacter` (storage version), domain wraps it with recalc + broadcast via DI factory `createCharacterService({ recalc, broadcast })`. Per-character write lock at storage. Handlers/middleware migrate from `#models/storage` to `#models`. Carve-outs: `lib/backup.mts`, code inside `models/`.
- **Status:** ✅ Resolved — Phase 5 Session 4.5 (2026-04-20). `createCharacterService({ recalc, broadcast, broadcastDeleted })` wired in `app.mts`. All handlers/middleware import from `#models` only. Per-character write lock + recalc + broadcast invariants live in the domain layer. Test suite covers the carve-outs.

### 15. XP check in validateCharacterUpdate is unreachable and architecturally wrong
- **Where:** `src/models/validation.mts` lines ~178-194
- **Impact:** Three stacked bugs: (a) `validateFieldValue` rejects the push value first (type mismatch: object vs "array"), so code never reaches XP check; (b) reads `trait.cost[0]` always — no tier awareness (novice=10, adept=20, master=30); (c) trait objects have no `cost` property — costs come from reference data. Additionally, XP validation belongs in the RPG rules layer, not generic validation.
- **Fix:** Removed both XP blocks from validation.mts. Will be rebuilt in Phase 6 with typed effects.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16). Removal complete. Phase 6 will implement properly.

### 16. `generateDefaultCharacter` leaks serverControlled defaults
- **Where:** `src/models/schema-utils.mts` — empty if-block without `continue`
- **Impact:** `schemaVersion` (serverControlled + has default) appeared in generated character.
- **Fix:** Added `continue` after the SERVER_CONTROLLED_FIELDS check. `schemaVersion` now stamped in `createCharacter()` service.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16).

### 17. `validateRPGRules` accepts under-budget attribute totals
- **Where:** `src/models/schema-utils.mts` — `validateRPGRules()`
- **Impact:** Characters could be created with unused attribute points.
- **Fix:** Split into two checks: over-budget (> 80) and under-budget (< 80) with distinct error messages.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16).

### 27. Inconsistent sanitization — only GET single character sanitizes by role
- **Status:** ✅ Resolved — Phase 5 Session 2. Sanitization applied to:
  - `handleGetCharacters.mts`: DM list → `"dm"`, player list → `"owner"`, both additionally strip `backupCode` regardless of role (never needed in lists).
  - `handleUpdateCharacter.mts`: response sanitized for `userRole` before 200.
  - `app.mts` recover endpoint: sanitized for `"owner"` (client used backup code, retains `playerId` for session binding).
  - `broadcast.mts`: per-subscriber sanitization based on `client.isDM` / `client.playerId === characterData.playerId`.
  - POST create still returns `backupCode` (owner needs it on first creation).

### 24. CORS: `Access-Control-Allow-Origin: *` hardcoded
- **Where:** `src/app.mts` `handleApi()` line ~186
- **Impact:** ADR-007 requires strict origin whitelist. Current `*` allows any origin.
- **Status:** ✅ Resolved — Phase 5 Session 3 (2026-04-18). New `src/lib/cors.mts` with `applyCors(req,res)` and env-driven `CORS_ORIGINS`. Replaces `*` wildcard with origin reflection for whitelisted origins. Always sets `Vary: Origin`. No `Access-Control-Allow-Credentials`. Applied in `handleApi` and `handleStreamCharacter`. Production env file added (`config/nagara.production.env`).

## LOW — Track But Not Blocking

### 28. `handleGetCharacters` TODO: "disable dm handling" — incomplete refactor
- **Status:** ✅ Resolved — Phase 5 Session 2. Removed stale `@TODO` comment, fixed "handing"→"handling" typo. DM path kept (auth-gated); sanitization from #27 fix addresses the data exposure concern.

### 29. Recovery endpoint: weak backup code keyspace + no rate limiting
- **Where:** `src/lib/utils.mts` `generateBackupCode()` — 6 adjectives × 6 nouns × 900 numbers = **32,400 combinations**. `src/app.mts` line 325 — `POST /api/v1/recover` has no rate limiting or lockout.
- **Impact:** Low given ADR-003 trusted userbase, but the keyspace is brute-forceable (~32K combinations, no throttle). A simple script could recover any character by name + enumeration.
- **Fix:** (a) Keyspace expanded to 22 × 22 × 10 000 ≈ 4.84M combinations. (b) `/recover` extracted to `src/routes/handleRecover.mts` and gated by an in-memory `createRateLimiter` (5/min) on **two** independent buckets — lowercased character name and `req.socket.remoteAddress` — with a 429 + `Retry-After` response on overflow. New `src/lib/rateLimit.mts` factory; `__resetRecoveryRateLimiters` test export. Old codes still resolve (forward-only format).
- **Status:** ✅ Resolved — Phase 5 Session 5 (2026-04-21). Tests in `test/rate-limit.test.mts` and `test/api.test.mts`.

## DEFERRED — Track for later, not currently scoped

### 31. `x-forwarded-for` parsing for rate limiter (and any future client-IP logic)
- **Where:** `src/routes/handleRecover.mts` IP bucket key uses `req.socket.remoteAddress`.
- **Impact:** Once a reverse proxy (nginx, Caddy, Cloudflare, etc.) sits in front of the Node server, every request appears to come from the proxy's IP — the IP rate-limit bucket collapses into a single global counter and is effectively bypassed. There is no proxy in front of the Node server today, so this is latent.
- **Fix when introduced:** Trust-list the proxy IPs (env-driven), parse the right-most untrusted hop from `x-forwarded-for`, fall back to `req.socket.remoteAddress`. Apply anywhere client IP is used.
- **Status:** ⏸️ Deferred — revisit when/if a reverse proxy is added.

### 32. Persistent rate-limit state across restarts
- **Where:** `src/lib/rateLimit.mts` — in-memory `Map`.
- **Impact:** A process restart wipes all rate-limit counters. Acceptable today (single-process file-based deployment per ADR-002/ADR-003), but a brute-forcer could exploit it by pacing attempts around restarts. Higher concern if multi-process or load-balanced.
- **Fix when needed:** Either (a) persist counters to a small JSON file with periodic flush + load-on-boot, or (b) move to a real store (SQLite, Redis) if the deployment topology grows. Acceptable to skip this entirely if the trusted-userbase assumption from ADR-003 still holds.
- **Status:** ⏸️ Deferred — revisit if multi-process or if abuse is observed.

### 33. Generalize the in-memory rate limiter to other endpoints
- **Where:** `src/lib/rateLimit.mts` is generic, but only `handleRecover` uses it.
- **Impact:** No additional credential-guessing or write-amplification surfaces today, but future endpoints (DM token validation, future login flows, write-heavy admin endpoints) would benefit from drop-in throttling.
- **Fix when needed:** Apply `createRateLimiter({ limit, windowMs })` to the relevant handler with a sensible bucket key. The factory pattern is already in place — no infra changes needed.
- **Status:** ⏸️ Deferred — add per endpoint as the need arises.

### 34. No runtime structural validation of reference catalog entries against typed shapes
- **Where:** `src/models/reference.mts` — catalog loaders for `weapons`, `armor`, `abilities`, `spells`, `rituals`, `boons`, `sins`, `statuses`, `qualities`.
- **Impact:** The loader validates the **quality registry** at load time (single-namespace dup check, ADR-016) and the audit lint (`scripts/audit-reference.mts`) covers locale-drift, action-id uniqueness, and quality-id membership. Nothing structurally validates entries against the `Weapon` / `ArmorPiece` / `Action` / `ResolvedEffect` TypeScript shapes at load time. A typo in an authored catalog file (`damge: 3` instead of `damage: 3`, missing required field, wrong-shape `effects[]` entry) loads silently and surfaces downstream — usually as a recalc failure, `undefined` in derived stats, or a sibling-app render bug — far from the actual cause. Catalogs are author-controlled (not user input), so this is not a security concern, but it is a correctness / authoring-DX concern.
- **Fix when introduced:** Hand-rolled structural validators per top-level shape (no schema-validation dependency per ADR-001). Run at load time in `loadReferenceCatalog`/equivalent and at audit time in `scripts/audit-reference.mts`. Throw with `(file, entry id, path-to-field, expected-shape)` on first violation. Engine catalog load already happens once at startup, so the perf cost is paid once. See [ADR-016 §7a](../../docs/decisions/016-quality-registry.md) for the design stance.
- **Status:** ⏸️ Deferred — currently relies on author discipline + downstream symptoms. Promote to MEDIUM if authoring bugs start reaching production.

### 35. `natural_weapon` schema default duplicates the catalog record (drift risk)
- **Where:** the seed default for `equipment.weapons[2]` (the `own` slot) in the character schema / `generateDefaultCharacter`, vs the canonical `natural_weapon` entry in the weapons reference catalog. Guard: `test/validation.test.mts` ("schema default for equipment.weapons[0] is the natural_weapon seed").
- **Impact:** The schema default is a **hardcoded snapshot** of the `natural_weapon` record. If the catalog entry drifts (stats, qualities, name), the default and the canonical record diverge silently. The test guard catches the drift at CI time, but the underlying single-source-of-truth violation remains — every catalog edit to `natural_weapon` must be mirrored by hand into the schema default.
- **Fix when introduced:** source the `own`-slot default from the loaded catalog at generation time instead of a hardcoded snapshot, so there is one source of truth. Then the guard test becomes redundant and can be removed.
- **Status:** ⏸️ Deferred — guarded, not fixed. Surfaced 2026-06-20 during docs-cleanup D4b (the test comment formerly cited `phase6-plan.md` Chunk F audit; re-homed here so it survives that plan's archival).
