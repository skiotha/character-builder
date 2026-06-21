# Bug Tracker — Resolved (archive)

> Closed bugs from both [`engine.md`](engine.md) and [`infra.md`](infra.md),
> kept so that `NB-<n>` citations in code still resolve after a fix ships.
> Ordered by id. See [`README.md`](README.md) for the scheme and the
> move-on-close procedure. Do **not** delete entries — they explain why the
> code looks the way it does.

### NB-7. `deriveCombat()` buried inside `enforceConsistency()`
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — enforceConsistency() does: clamp toughness, reset negative XP, filter expired effects, ensure equipment defaults, AND derive combat
- **Impact:** Conceptually distinct pipeline stages tangled in one function. Hard to test and debug individually.
- **Fix:** Separate into distinct pipeline stages per ADR-010.
- **Status:** ✅ Resolved — Phase 6 Chunks C + E. `recalculate()` now invokes `deriveCombatSlots(result, effects)` as its own pipeline stage (separate from `enforceConsistency`, which is reduced to XP + equipment defaults).

### NB-8. `deriveCombat()` only reads first weapon, no dual-wield
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — `const primaryIndex = weaponSlots[0]`
- **Impact:** Characters with dual-wield weapons won't get correct bonusDamage.
- **Fix:** Subsumed by per-slot fanout in ADR-014 — `combat.carried` is `[Slot|null, Slot|null, Slot]` and each populated slot independently produces an attack profile, replacing the `weapons[]` index list.
- **Status:** ✅ Resolved — Phase 6 Chunk D. `combat.carried` is now `[Slot|null, Slot|null, Slot]` and `deriveCombat` synthesises a per-slot profile for every populated slot (ADR-014).

### NB-9. `bonusDamage` always empty / `attackAttribute` hardcoded to "accurate"
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — `combat.bonusDamage = combat.bonusDamage || []`
- **Impact:** No ability-driven bonus damage or attack attribute override.
- **Fix:** Per-slot fanout (Chunk D) populates these from each slot's weapon and from `{ kind: "combat", field: "bonusDamage" / "attackAttribute" }` effects (Chunk E wires the ability data).
- **Status:** ✅ Resolved — Phase 6 Chunks D + E. Per-slot `attackAttribute`/`baseDamage`/`bonusDamage` are derived from the slot's weapon and from typed `combat`-targeted effects with `WeaponPredicate` routing. `attackAttribute` accepts `setBase` only; `baseDamage`/`bonusDamage` accept `addFlat`/`multiply`/`cap` (parser-enforced).

### NB-11. `xp.mts` was a comment only + premature XP logic in validation
- **Domain:** engine
- **Where:** `src/rules/xp.mts` (deleted), `src/models/validation.mts` (cleaned)
- **Impact:** `xp.mts` contained only a 5-line comment. `validateCharacterUpdate` had two XP-related blocks: a fully commented-out `increment` block (dead code) and an active `push` XP check that was reachable but premature — it assumed `trait.cost` was `number[]`, blindly indexed `[0]`, and had no corresponding XP deduction after validation passed.
- **Fix:** Both blocks removed in Phase 5 Session 1. `xp.mts` deleted. XP validation will be rebuilt properly in Phase 6 with typed effects.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16)

### NB-15. XP check in validateCharacterUpdate is unreachable and architecturally wrong
- **Domain:** infra
- **Where:** `src/models/validation.mts` lines ~178-194
- **Impact:** Three stacked bugs: (a) `validateFieldValue` rejects the push value first (type mismatch: object vs "array"), so code never reaches XP check; (b) reads `trait.cost[0]` always — no tier awareness (novice=10, adept=20, master=30); (c) trait objects have no `cost` property — costs come from reference data. Additionally, XP validation belongs in the RPG rules layer, not generic validation.
- **Fix:** Removed both XP blocks from validation.mts. Will be rebuilt in Phase 6 with typed effects.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16). Removal complete. Phase 6 will implement properly.

### NB-16. `generateDefaultCharacter` leaks serverControlled defaults
- **Domain:** infra
- **Where:** `src/models/schema-utils.mts` — empty if-block without `continue`
- **Impact:** `schemaVersion` (serverControlled + has default) appeared in generated character.
- **Fix:** Added `continue` after the SERVER_CONTROLLED_FIELDS check. `schemaVersion` now stamped in `createCharacter()` service.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16).

### NB-17. `validateRPGRules` accepts under-budget attribute totals
- **Domain:** infra
- **Where:** `src/models/schema-utils.mts` — `validateRPGRules()`
- **Impact:** Characters could be created with unused attribute points.
- **Fix:** Split into two checks: over-budget (> 80) and under-budget (< 80) with distinct error messages.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16).

### NB-18. Crash on undefined effect target
- **Domain:** engine
- **Where:** `src/rules/derived.mts` line ~57 — `applyEffect(result, effect.target!, effect.modifier)`
- **Impact:** Guard `!effect.target?.startsWith("rules.")` evaluates `true` when `target` is `undefined`. The `!` non-null assertion then passes `undefined` to `applyEffect` → `getNestedValue(char, undefined)` → `undefined.split(".")` → runtime `TypeError` crash.
- **Fix:** `effect.target` guarded before `applyEffect`; non-null assertion removed. Residual `setBase` `split(".")[1]!` is safe today (only entered when `target.startsWith("rules.")`) and TODO-marked for removal alongside ADR-015 typed targets in Phase 6 Chunk C.
- **Status:** ✅ Resolved — Phase 5 Session 4 (2026-04-19). Regression tests in `test/rules/derived.test.mts`.

### NB-23. `attackAttribute` `||` operator prevents effect overrides
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — `deriveCombat()` — `combat.attackAttribute = combat.attackAttribute || "accurate"`
- **Impact:** If an effect sets `combat.attackAttribute` to `""` or `0` (falsy but intentional), the `||` operator overwrites it with `"accurate"`. More importantly, this runs AFTER the effect pipeline, so any effect that DID set the attribute gets overwritten if the field already has a truthy value from character data.
- **Fix:** Subsumed by per-slot fanout in ADR-014 — each populated slot contributes its own attack profile, with `attackAttribute` defaulting from the weapon and overridable via `{ kind: "combat", field: "attackAttribute" }` effects.
- **Status:** ✅ Resolved — Phase 6 Chunk D. `combat.attackAttribute` no longer exists at the top level; per-slot inner field is recalc-derived from the slot's weapon. The `||` fallback is gone.

### NB-24. CORS: `Access-Control-Allow-Origin: *` hardcoded
- **Domain:** infra
- **Where:** `src/app.mts` `handleApi()` line ~186
- **Impact:** ADR-007 requires strict origin whitelist. Current `*` allows any origin.
- **Status:** ✅ Resolved — Phase 5 Session 3 (2026-04-18). New `src/lib/cors.mts` with `applyCors(req,res)` and env-driven `CORS_ORIGINS`. Replaces `*` wildcard with origin reflection for whitelisted origins. Always sets `Vary: Origin`. No `Access-Control-Allow-Credentials`. Applied in `handleApi` and `handleStreamCharacter`. Production env file added (`config/nagara.production.env`).

### NB-25. Portrait upload has zero auth checks
- **Domain:** infra
- **Status:** ✅ Resolved — Phase 5 Session 2. Added `src/routes/portraitRoutes.mts` wrapping `handleUploadPortrait` with `withCharacterPermissions`; handler rejects role `"public"`. Also fixed `finally { return true }` swallow-bug in close-handler — now explicit per-path returns.

### NB-26. SSE stream auth commented out + unsanitized broadcast
- **Domain:** infra
- **Status:** ✅ Resolved — Phase 5 Session 2. (a) 401/403 blocks uncommented in `handleStreamCharacter.mts`; query-param auth (`?playerId` / `?dmId`) used since EventSource can't set headers. (b) `broadcast.mts` now sanitizes per subscriber via `sanitizeCharacterForRole`, and `sanitizeCharacterForRole` itself was fixed to clone-then-delete (previously mutated input).

### NB-27. Inconsistent sanitization — only GET single character sanitizes by role
- **Domain:** infra
- **Status:** ✅ Resolved — Phase 5 Session 2. Sanitization applied to:
  - `handleGetCharacters.mts`: DM list → `"dm"`, player list → `"owner"`, both additionally strip `backupCode` regardless of role (never needed in lists).
  - `handleUpdateCharacter.mts`: response sanitized for `userRole` before 200.
  - `app.mts` recover endpoint: sanitized for `"owner"` (client used backup code, retains `playerId` for session binding).
  - `broadcast.mts`: per-subscriber sanitization based on `client.isDM` / `client.playerId === characterData.playerId`.
  - POST create still returns `backupCode` (owner needs it on first creation).

### NB-28. `handleGetCharacters` TODO: "disable dm handling" — incomplete refactor
- **Domain:** infra
- **Status:** ✅ Resolved — Phase 5 Session 2. Removed stale `@TODO` comment, fixed "handing"→"handling" typo. DM path kept (auth-gated); sanitization from NB-27 fix addresses the data exposure concern.

### NB-29. Recovery endpoint: weak backup code keyspace + no rate limiting
- **Domain:** infra
- **Where:** `src/lib/utils.mts` `generateBackupCode()` — 6 adjectives × 6 nouns × 900 numbers = **32,400 combinations**. `src/app.mts` line 325 — `POST /api/v1/recover` has no rate limiting or lockout.
- **Impact:** Low given ADR-003 trusted userbase, but the keyspace is brute-forceable (~32K combinations, no throttle). A simple script could recover any character by name + enumeration.
- **Fix:** (a) Keyspace expanded to 22 × 22 × 10 000 ≈ 4.84M combinations. (b) `/recover` extracted to `src/routes/handleRecover.mts` and gated by an in-memory `createRateLimiter` (5/min) on **two** independent buckets — lowercased character name and `req.socket.remoteAddress` — with a 429 + `Retry-After` response on overflow. New `src/lib/rateLimit.mts` factory; `__resetRecoveryRateLimiters` test export. Old codes still resolve (forward-only format).
- **Status:** ✅ Resolved — Phase 5 Session 5 (2026-04-21). Tests in `test/rate-limit.test.mts` and `test/api.test.mts`.

### NB-30. Duplicate `updateCharacter` — service vs storage (ADR-013)
- **Domain:** infra
- **Where:** `src/models/index.mts` `updateCharacter` and `src/models/storage.mts` `updateCharacter`
- **Impact:** Two implementations with different semantics — storage uses `skipUndefined: true` and conditional index update; service version doesn't. `handleUploadPortrait` uses the service version, exposing a latent `undefined`-clobbers-fields bug. Also no place for cross-cutting invariants (recalc, broadcast, write lock). Handlers/middleware import ad-hoc from either `#models` or `#models/storage`.
- **Fix:** ADR-013 — domain layer is the mutation gate. Single `updateCharacter` (storage version), domain wraps it with recalc + broadcast via DI factory `createCharacterService({ recalc, broadcast })`. Per-character write lock at storage. Handlers/middleware migrate from `#models/storage` to `#models`. Carve-outs: `lib/backup.mts`, code inside `models/`.
- **Status:** ✅ Resolved — Phase 5 Session 4.5 (2026-04-20). `createCharacterService({ recalc, broadcast, broadcastDeleted })` wired in `app.mts`. All handlers/middleware import from `#models` only. Per-character write lock + recalc + broadcast invariants live in the domain layer. Test suite covers the carve-outs.

### NB-31. `applyFlag`/quality mutators never reset derived set membership
- **Domain:** engine
- **Where:** `src/rules/applicator.mts` — `applyFlagSet`, `applyArmorQuality`, `applyWeaponQuality`.
- **Impact:** Each recalc clones the incoming `Character` via `structuredClone`, so the **previous** run's `character.flags` (and armor/weapon `qualities` set membership written by the engine) is carried forward. `applyFlag` only adds names from currently-live effects and only removes names when an effect with `modifier.type === "remove"` is present. If a trait/spell/effect that used to add a flag is unlearned or removed between saves, the flag is **never cleaned up** — it sticks on the character forever until something explicitly issues a `remove`.
- **Repro:** Save a character with trait A that adds `flag: darkvision` → `flags: ["darkvision"]`. Remove trait A. Save again. Expected: `flags: []`. Actual: `flags: ["darkvision"]`.
- **Fix (planned):** `derived.mts#recalculate` should reset all engine-owned set members at the start of the pipeline — `result.flags = []`, and (once Chunk E lands) the equivalent for armor/weapon qualities that are engine-contributed vs. authored on the equipment record. Needs care: equipment `qualities` that are intrinsic to the weapon/armor must *not* be wiped — only the engine-added overlay. Options: (a) track engine-added qualities in a separate derived set, (b) rebuild equipment `qualities` from `catalog qualities ∪ engine-added`, or (c) snapshot-diff.
- **Status:** ✅ **Resolved** — Phase 6 Chunk E (2026-04-25) closed the top-level half (`flags`, `specialAttacks`, `reactions` reset at the top of `recalculate()`) and per-slot `combat.carried[*]` rebuild. The remaining armor-overlay caveat closed in the Chunk F post-pass (Item 3, 2026-05-04): `applyArmorQuality` now writes the engine overlay to `ArmorPiece.qualitiesEffective` (a separate optional field) instead of mutating authored `qualities`, and `recalculate()` resets `qualitiesEffective` from `qualities` at the top of every pass. Authored `qualities` is never touched. See `test/rules/armor-overlay-leak.test.mts` for regression coverage.

### NB-32. Armor-side `appliesTo` / character-level effect gating ignored
- **Domain:** engine
- **Where:** `src/rules/applicator.mts` — `applyArmorQuality`, `apply{AddFlat,Multiply,Cap}` for `secondary` targets; reference data using `appliesTo: type=plug` etc.
- **Impact:** `appliesTo` (`WeaponPredicate[]`) only narrows per-slot **weapon** effects (ADR-015 §2). Armor-side `armorQuality` add/remove and character-level `secondary` effects had **no** gating mechanism: an `armorQuality` effect would fire on both `body` and `plug` regardless of intent, and an authored `appliesTo: type=plug` predicate (e.g. on Demiurge Hands) was a silent no-op (`plug` isn't a `WeaponPredicate.kind: "type"` value). Combat Oils Novice (`secondary.armor +4` only when an oiled piece is equipped) was likewise unauthorable.
- **Fix:** ADR-015 §3f — new `condition?: ArmorCondition[]` field on `ResolvedEffect`. AND-composed entries of kind `armorQuality | armorId | armorSlot | noArmor`. Accepted on `secondary` (character-level read) and `armorQuality` (per-piece read); parser strips with a warn elsewhere. Registry-synthesized `armorQuality` effects (per-piece quality registry expansion) are auto-stamped with `condition: [{ kind: "armorSlot", values: [<piece>] }]` so a body piece's quality can never bleed onto the plug. Audit lint requires `condition` on every non-registry `armorQuality` effect.
- **Status:** ✅ **Resolved** — Phase 6 Chunk F post-pass Item 3 (2026-05-04). 19 new tests in `test/rules/armor-condition.test.mts` + `test/rules/armor-overlay-leak.test.mts`. Authoring sweep applied to Soldier Adept, Demiurge Hands Novice/Master across `abilities.{en,ru}.json`.

### NB-46. No request body size limits on any endpoint
- **Domain:** infra
- **Status:** ✅ Resolved — Phase 5 Session 3 (2026-04-18). New `src/lib/body.mts` with `readBody`/`readBodyBuffer` + `BodyTooLargeError`. Applied to all 6 body-reading sites (handleCreate, handleUpdate, multipart/parseImage, recover, backup-create, backup-restore). JSON limit: 1 MB, upload limit: ~21 MB. `BodyTooLargeError` → 413 response.
