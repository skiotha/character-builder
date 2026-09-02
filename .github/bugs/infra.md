# Bug Tracker — API & Infrastructure (open)

> Open API / HTTP / security / storage / validation-infrastructure bugs.
> Resolved infra bugs are archived in [`resolved.md`](resolved.md); RPG-engine
> bugs live in [`engine.md`](engine.md).
>
> See [`README.md`](README.md) for the `NB-N` id scheme, the severity rubric,
> and the filing / closing procedure. Cite a bug from code as `NB-<n>`.

## MEDIUM — Address During API / Validation Work

### NB-50. Per-field PATCH validators see the stored character, not the merged batch
- **Where:** `src/models/validation.mts` `validateCharacterUpdate` — the per-field loop calls `validateFieldValue(field, value, character)` with the **stored** character as `allData`; the merged clone is only built afterwards for the cross-field / catalog pass.
- **Impact:** Any schema `validate:` hook that reads sibling fields evaluates against pre-PATCH state. Concrete case: `validateCombatCarried` checks `weaponIndex` range and the own-slot `own` quality against the stored `equipment.weapons[]`. A single atomic PATCH that removes a weapon and re-maps `combat.carried` in the same batch (the Chunk I picker contract) is validated as *new indices against the old array*. With the own slot at `natural_weapon` (index 0) this is coincidentally safe; once NB-49 lets the own slot point at a later own-quality weapon, removing any lower-index weapon yields a spurious 422 ("must reference a weapon with the `own` quality") for a batch that is valid once merged. Other hooks are currently unaffected: `attributePointsValid` is re-run on the merged clone anyway; `currentHealthValid` reads a server-controlled field that cannot be in the batch.
- **Fix:** build the merged clone **before** per-field validation — apply every writable update to `structuredClone(character)` (FORBIDDEN ones excluded) and pass that clone as `allData` to `validateFieldValue`; reuse the same clone for the existing merged-state pass. Structurally invalid values applied to the clone are harmless because any error rejects the whole batch. Add a `test/validation.test.mts` case: weapons shrink + carried re-map in one PATCH with a non-zero own index passes; the same carried tuple alone against the stored array fails.
- **Status:** ⚠️ Open — fix together with NB-49 (same commit); filed 2026-09-02 during the Chunk I step-1 readiness review.

### NB-51. Fresh characters omit every schema field without a `default` — contract says `[]`
- **Where:** `src/models/schema-utils.mts` `generateDefaultCharacter` — the traversal only seeds `field.default` and recurses into `type: "object"`; array / string / nullable-object fields with no `default` are skipped. Affected on a freshly created character (verified via `GET /characters/:id` as owner, 2026-09-02): `traits`, `talents`, `rituals`, `traditions`, `effects`, `affiliations`, `location`, `portrait`, `background.notes`, `background.journal.*`, `background.kinkList`.
- **Impact:** `docs/data-contracts.md` §1 documents these as always-present (`"talents": []`, `"rituals": []`, …) and the sibling contracts inherit that shape; a Lua `ipairs(character.talents)` or a bot-side `.length` on a fresh character hits `nil` / `undefined`. Client-side, absent keys also mean the field never appears in the state diff until a first PATCH creates it. The engine tolerates absence (`?? []` reads), so this is a contract / sibling risk, not a recalc failure.
- **Fix when scoped:** either add explicit `default: []` (and `default: ""` / `default: null` where appropriate) to the schema fields, or have `generateDefaultCharacter` seed `type: "array"` fields with `[]` when no default is authored. Existing on-disk characters keep the gap — decide between a read-path backfill in the domain layer and a one-off migration. Watch `test/data-contracts.test.mts` and the creation-shape fixtures in `test/helpers/fixtures.mts` (which already assume the arrays exist).
- **Status:** ⚠️ Open — filed 2026-09-02 as a side finding of the Chunk I step-1 readiness review; not scheduled. Promote before Phase 7 sibling integration.

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

### NB-48. Wholesale parent-object PATCH bypasses leaf-level write permissions
- **Where:** `src/models/validation.mts` `validateCharacterUpdate` / `src/models/schema-utils.mts` `isFieldWritable`.
- **Impact:** Writability is checked only for the PATCHed field path itself. A parent object field whose own permissions allow writing (e.g. `attributes`, `perm_default` owner-RW) accepts a wholesale object `set`, even though the leaves inside it are stricter (`attributes.primary.*` is `perm_attr` owner-RO; `primaryEffective` is server-controlled). An owner can thus rewrite base primaries by PATCHing `attributes` wholesale. The blast radius today is small: the exact-80 budget hook applies to the merged result regardless of which path was PATCHed, server-controlled / derived values are recomputed by recalc on save, and the userbase is trusted (ADR-003) — but it remains a permission-model hole: leaf-level read-only is advisory whenever a writable ancestor exists.
- **Fix when scoped:** enforce write permissions recursively for object-valued updates — either flatten object `set`s into leaf updates before validation, or walk the value's paths and check `isFieldWritable` per leaf (rejecting or stripping the read-only ones). Decide strip-vs-reject against how the client PATCHes composite objects (e.g. `portrait.crop`).
- **Status:** ⏸️ Deferred — surfaced 2026-08-08 while designing the merged-update validation pass (Phase 6 Chunk H.2). Not currently exploitable into invalid persisted state (budget hook + recalc cover the aggregates); sibling apps should not rely on leaf-level read-only until fixed.
