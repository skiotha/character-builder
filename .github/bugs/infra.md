# Bug Tracker — API & Infrastructure (open)

> Open API / HTTP / security / storage / validation-infrastructure bugs.
> Resolved infra bugs are archived in [`resolved.md`](resolved.md); RPG-engine
> bugs live in [`engine.md`](engine.md).
>
> See [`README.md`](README.md) for the `NB-N` id scheme, the severity rubric,
> and the filing / closing procedure. Cite a bug from code as `NB-<n>`.

## DEFERRED — Track for later, not currently scoped

### NB-40. `x-forwarded-for` parsing for rate limiter (and any future client-IP logic)
- **Where:** `src/routes/handleRecover.mts` IP bucket key uses `req.socket.remoteAddress`.
- **Impact:** Once a reverse proxy (nginx, Caddy, Cloudflare, etc.) sits in front of the Node server, every request appears to come from the proxy's IP — the IP rate-limit bucket collapses into a single global counter and is effectively bypassed. There is no proxy in front of the Node server today, so this is latent.
- **Fix when introduced:** Trust-list the proxy IPs (env-driven), parse the right-most untrusted hop from `x-forwarded-for`, fall back to `req.socket.remoteAddress`. Apply anywhere client IP is used.
- **Status:** ⏸️ Deferred — revisit when/if a reverse proxy is added.

### NB-41. Persistent rate-limit state across restarts
- **Where:** `src/lib/rateLimit.mts` — in-memory `Map`.
- **Impact:** A process restart wipes all rate-limit counters. Acceptable today (single-process file-based deployment per ADR-002/ADR-003), but a brute-forcer could exploit it by pacing attempts around restarts. Higher concern if multi-process or load-balanced.
- **Fix when needed:** Either (a) persist counters to a small JSON file with periodic flush + load-on-boot, or (b) move to a real store (SQLite, Redis) if the deployment topology grows. Acceptable to skip this entirely if the trusted-userbase assumption from ADR-003 still holds.
- **Status:** ⏸️ Deferred — revisit if multi-process or if abuse is observed.

### NB-42. Generalize the in-memory rate limiter to other endpoints
- **Where:** `src/lib/rateLimit.mts` is generic, but only `handleRecover` uses it.
- **Impact:** No additional credential-guessing or write-amplification surfaces today, but future endpoints (DM token validation, future login flows, write-heavy admin endpoints) would benefit from drop-in throttling.
- **Fix when needed:** Apply `createRateLimiter({ limit, windowMs })` to the relevant handler with a sensible bucket key. The factory pattern is already in place — no infra changes needed.
- **Status:** ⏸️ Deferred — add per endpoint as the need arises.

### NB-43. No runtime structural validation of reference catalog entries against typed shapes
- **Where:** `src/models/reference.mts` — catalog loaders for `weapons`, `armor`, `abilities`, `spells`, `rituals`, `boons`, `sins`, `statuses`, `qualities`.
- **Impact:** The loader validates the **quality registry** at load time (single-namespace dup check, ADR-016) and the reference-lint (`test/rules/reference-lint.test.mts`) covers locale-drift, action-id uniqueness, and quality-id membership. Nothing structurally validates entries against the `Weapon` / `ArmorPiece` / `Action` / `ResolvedEffect` TypeScript shapes at load time. A typo in an authored catalog file (`damge: 3` instead of `damage: 3`, missing required field, wrong-shape `effects[]` entry) loads silently and surfaces downstream — usually as a recalc failure, `undefined` in derived stats, or a sibling-app render bug — far from the actual cause. Catalogs are author-controlled (not user input), so this is not a security concern, but it is a correctness / authoring-DX concern.
- **Fix when introduced:** Hand-rolled structural validators per top-level shape (no schema-validation dependency per ADR-001). Run at load time in `loadReferenceCatalog`/equivalent and at lint time in `test/rules/reference-lint.test.mts`. Throw with `(file, entry id, path-to-field, expected-shape)` on first violation. Engine catalog load already happens once at startup, so the perf cost is paid once. See [ADR-016 §7a](../../docs/decisions/016-quality-registry.md) for the design stance.
- **Status:** ⏸️ Deferred — currently relies on author discipline + downstream symptoms. Promote to MEDIUM if authoring bugs start reaching production.

### NB-45. `natural_weapon` schema default duplicates the catalog record (drift risk)
- **Where:** the seed default for `equipment.weapons[2]` (the `own` slot) in the character schema / `generateDefaultCharacter`, vs the canonical `natural_weapon` entry in the weapons reference catalog. Guard: `test/validation.test.mts` ("schema default for equipment.weapons[0] is the natural_weapon seed").
- **Impact:** The schema default is a **hardcoded snapshot** of the `natural_weapon` record. If the catalog entry drifts (stats, qualities, name), the default and the canonical record diverge silently. The test guard catches the drift at CI time, but the underlying single-source-of-truth violation remains — every catalog edit to `natural_weapon` must be mirrored by hand into the schema default.
- **Fix when introduced:** source the `own`-slot default from the loaded catalog at generation time instead of a hardcoded snapshot, so there is one source of truth. Then the guard test becomes redundant and can be removed.
- **Status:** ⏸️ Deferred — guarded, not fixed. Surfaced 2026-06-20 during docs-cleanup D4b (the test comment formerly cited `phase6-plan.md` Chunk F audit; re-homed here so it survives that plan's archival).
