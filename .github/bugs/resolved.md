# Bug Tracker — Resolved (archive)

> Closed bugs from both [`engine.md`](engine.md) and [`infra.md`](infra.md),
> kept so that `NB-<n>` citations in code still resolve after a fix ships.
> Ordered by id. See [`README.md`](README.md) for the scheme and the
> move-on-close procedure. Do **not** delete entries — they explain why the
> code looks the way it does.

### NB-1. Entire rules engine uses `Record<string, unknown>` instead of typed `Character`
- **Domain:** engine
- **Where:** `src/rules/derived.mts`, `src/rules/attributes.mts`, `src/rules/applicator.mts`
- **Impact:** All TypeScript interfaces from rpg-types.mts provided zero compile-time safety in the rules engine. Every property access was an unsafe cast chain. Schema changes broke silently at runtime.
- **Fix:** ADR-010 — pipeline operates on typed `Character` state. Functions receive typed sub-structures (`PrimaryAttributes`, `Combat`, etc.), not opaque records.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24). The engine rewrite landed the typed pipeline; every later chunk built on it.

### NB-2. No guaranteed effect ordering — numeric priority is insufficient
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — `allEffects.sort((a, b) => (a.priority || 10) - (b.priority || 10))`
- **Impact:** Modifier math has strict ordering requirements: setBase MUST run before addFlat, addFlat before multiply, multiply before cap. The old system relied on data authors setting the right priority number; wrong priority = silent math errors.
- **Fix:** ADR-010 + ADR-015 — explicit phase ordering; `priority` field dropped entirely.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24). Phase-ordered pipeline shipped; the last vestige (`RawEffect.priority`) was deleted in Chunk H.1 (2026-08-07).

### NB-3. Dotted-path string targeting is fragile
- **Domain:** engine
- **Where:** `src/rules/applicator.mts` — `applyEffect(character, targetPath, modifier)`, effect data used `"attributes.secondary.defense"` strings
- **Impact:** Couldn't be validated at compile time; broke silently on field renames; required untyped `getNestedValue`/`setNestedValue` traversal.
- **Fix:** ADR-015 — typed discriminated-union targets (`{ kind: 'secondary', stat: 'defense' }`): exhaustive switch/case, refactor safety, autocomplete. Schema paths remain strings for UI data binding (ADR-009) — different concern, as planned.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24). Typed `EffectTarget` union shipped; the dotted-path reject special-case was trimmed in Chunk H.1.

### NB-4. Magic `"rules."` prefix convention for setBase detection
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — `effect.target?.startsWith("rules.")` + `target.split(".")[1]`
- **Impact:** Undocumented convention baked into the implementation; only worked for secondary attribute overrides.
- **Fix:** ADR-010 + ADR-015 — setBase is an explicit phase on typed targets, not a prefix pattern.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24). No string prefix parsing remains in the engine.

### NB-5. Dual/triple effect sources with no unified collection
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — three separate code paths: `character.effects[]` filtered inline, ability/spell effects unimplemented, equipment effects handled separately in `applyEquipmentBonuses()`
- **Impact:** Effects from different sources were processed at different pipeline points with different logic; no single place where "all effects on this character" was visible.
- **Fix:** ADR-010 — explicit `collectAllEffects()` step merging all sources into a single typed array before pipeline processing.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24) shipped `collectAllEffects()`; Chunk G.1 (2026-07-04) wired the trait/talent catalog data through the registry loader, completing the unified collection.

### NB-6. Applicator uses wrong modifier verb names
- **Domain:** engine
- **Where:** `src/rules/applicator.mts` — `case "add"` / `case "mul"` / `case "set"`
- **Impact:** Misaligned with the canonical spec (`setBase`/`addFlat`/`multiply`/`cap`); data using canonical names fell through to the `default` case (no-op).
- **Fix:** Renamed in the Chunk C applicator rework; reference data aligned in bulk in Chunk F.
- **Status:** ✅ Resolved — Phase 6 Chunks C (engine verbs, 2026-04-24) + F (data alignment). The legacy `add`/`mul`/`set` reject special-cases were trimmed in Chunk H.1 (2026-08-07); no legacy verb handling remains under `src/rules/`.

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

### NB-10. `effects.mts` and `registry.mts` are empty files
- **Domain:** engine
- **Where:** `src/rules/effects.mts`, `src/rules/registry.mts`
- **Impact:** Placeholder files with no implementation. Effect resolution and ability lookup didn't exist yet.
- **Fix:** Populated during the Phase 6 engine work.
- **Status:** ✅ Resolved — Phase 6 Chunks C + G.1. `effects.mts` carries the collection/normalization/deserialization layer (Chunk C, 2026-04-24); `registry.mts` carries the production `loadRegistry()` catalog loader (Chunk G.1, 2026-07-04). Both fully implemented.

### NB-11. `xp.mts` was a comment only + premature XP logic in validation
- **Domain:** engine
- **Where:** `src/rules/xp.mts` (deleted), `src/models/validation.mts` (cleaned)
- **Impact:** `xp.mts` contained only a 5-line comment. `validateCharacterUpdate` had two XP-related blocks: a fully commented-out `increment` block (dead code) and an active `push` XP check that was reachable but premature — it assumed `trait.cost` was `number[]`, blindly indexed `[0]`, and had no corresponding XP deduction after validation passed.
- **Fix:** Both blocks removed in Phase 5 Session 1. `xp.mts` deleted. XP validation will be rebuilt properly in Phase 6 with typed effects.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16)

### NB-12. No evaluation engine for conditional effects (Tier B)
- **Domain:** engine
- **Where:** Planned in deferred-tasks §1.3 (Tier B vocabulary definition)
- **Impact:** Many abilities have conditions ("when wielding heavy weapons", "when wearing no armor"). These remain text-only without a condition evaluator.
- **Status:** ✅ Resolved by decision (2026-09-01, Chunk H.4 sweep) — character-state condition evaluation is deliberately **out of engine**: the engine derives permanent character state; temporary/situational state is owned by sibling apps (`ES §out-of-engine`). Equipment-state conditions DID ship typed (`ArmorCondition` gating, `WeaponPredicate` routing — ADR-015). The one surviving conditional thread — weapon-conditional `secondary` bonuses — is tracked by NB-34.

### NB-13. Effect data in reference files is free-text, not normalized
- **Domain:** engine
- **Where:** `reference/abilities.en.json`, `reference/spells.en.json` — ~654 tier effects
- **Impact:** The engine couldn't process any ability effect until normalization was done.
- **Fix:** Chunk F bulk normalization — catalogs author canonical typed `effects[]` (tier A/B/C, typed `target`/`modifier`, `appliesTo`, promoted actions) consumed directly by the pipeline.
- **Status:** ✅ Resolved — Phase 6 Chunk F (bulk normalization; post-pass amendment items completed 2026-05-19). Shape enforced since by `test/rules/reference-lint.test.mts` (Chunk G.1).

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

### NB-19. rpg-types `EffectModifier.value: number` is wrong for setBase
- **Domain:** engine
- **Where:** `src/rpg-types.mts` `EffectModifier` interface — `value: number`
- **Impact:** `setBase` effects carry attribute-name strings (e.g., `"discreet"`), not numbers. The type lied; code trusting it for setBase values got wrong results silently.
- **Fix:** ADR-010 / ADR-015 — per-phase modifier shapes; `setBase` carries a primary-attribute name by type.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24). Typed per-phase `EffectModifier` shipped with the pipeline rewrite.

### NB-20. Rules modules bypass rpg-types interfaces entirely
- **Domain:** engine
- **Where:** `src/rules/applicator.mts` defined a local `Modifier` with `value: unknown`; `src/rules/derived.mts` defined a local `RuleEffect`. Neither imported from `rpg-types.mts`.
- **Impact:** Two parallel type hierarchies that could diverge; the shared types provided zero compile-time safety in the engine.
- **Fix:** Chunk C rewrite — the engine consumes the canonical `rpg-types.mts` shapes.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24). The parallel local hierarchies are gone. Discovered in Phase 4 Session 4 testing.

### NB-21. Double toughness clamping (redundant logic)
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — `clampValues()` clamped `toughness.current` to `[0, max]`, then `enforceConsistency()` did the exact same clamping again.
- **Impact:** Wasted cycles; confused readers about which stage "owns" clamping.
- **Fix:** ADR-010 pipeline separates the stages; clamping has a single home in `clampValues()`.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24) removed the duplicate; `enforceConsistency()` itself was deleted in Chunk H.1 (2026-08-07, NB-36). Discovered in Phase 4 Session 4 testing.

### NB-22. Nested effects on RuleEffect never unwound
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — the old `RuleEffect` type had an `effects?` sub-array that `recalculateDerivedFields` never recursed into.
- **Impact:** Any effect carrying child effects was silently ignored.
- **Fix:** The Chunk C type redesign removed the possibility instead of adding recursion: `ResolvedEffect` has no nested `effects[]` sub-array, so `collectAllEffects()` is flat by construction.
- **Status:** ✅ Resolved — Phase 6 Chunk C (2026-04-24). Discovered in Phase 4 Session 4 testing.

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

### NB-36. `enforceConsistency()` may be fully redundant with schema/storage defaulting
- **Domain:** engine
- **Where:** `src/rules/derived.mts` — `enforceConsistency()` (now deleted). In-code anchor was `TODO(enforce-consistency-redundancy)`.
- **Impact:** Post-engine-rewrite the function was reduced to an XP non-negativity guard and equipment defaulting, both duplicating schema/storage-boundary responsibilities. Dead weight in the recalc pipeline, and it kept `recalculate` from being a pure derivation over its input (it silently "fixed" out-of-range XP instead of surfacing the bad write).
- **Fix:** Audited both responsibilities, closed the one real gap, deleted the function and its call site. (a) *Equipment defaulting:* `equipment.weapons` was already schema-defaulted at creation and `storage.updateCharacter`'s `deepMerge` preserves existing objects on partial updates; the audit's one real finding was that `equipment.armor.body` / `.plug` carried **no** schema default — the on-disk `armor: { body: null, plug: null }` creation shape was actually produced by `enforceConsistency`. Both fields gained `default: null` in `src/models/character.mts`, so the schema boundary now owns that shape. (b) *XP:* unreachable from the typed pipeline (no `EffectTarget` kind addresses `experience`; applicator write surface verified) and rejected at the API boundary (`min: 0` on `experience.unspent`; `increment` deltas are validated against the same bound; creation additionally runs the `validateRPGRules` negative-XP business rule). Residual caveat: an explicit `null` PATCH on object-typed parents (`equipment`, `attributes`, …) still passes the `typeof` type check — a systemic boundary gap that `enforceConsistency` neither prevented nor meaningfully repaired (it left a dangling own-slot `weaponIndex` behind); boundary null-rejection is scheduled into the Phase 6 Chunk H.2 validator work. Regression pin: `test/rules/derived.test.mts` now asserts recalc passes out-of-range XP through untouched.
- **Status:** ✅ Resolved — Phase 6 Chunk H.1 (2026-08-07). Surfaced 2026-05-23 during the docs-cleanup orphan-TODO sweep.

### NB-37. `src/rules/registry.mts` re-export shim may have outlived its purpose
- **Domain:** engine
- **Where:** `src/rules/registry.mts`, `src/rules/index.mts` (barrel), `src/app.mts`.
- **Impact:** The file was a 13-line re-export shim (types only). The `#rules` barrel already surfaced the registry types directly from `registry-types.mts`, so the shim was dead indirection with no functional role.
- **Fix:** Chunk G.1 landed the real trait/talent/quality loader (`loadRegistry`) inside `registry.mts`, so the file now earns its keep. The barrel exports `loadRegistry`; the vestigial type re-export was dropped from the shim.
- **Status:** ✅ Resolved — Phase 6 Chunk G.1 (2026-07-04). `registry.mts` holds `loadRegistry()` (fail-fast pre-deserialization at `DEFAULT_LOCALE`), wired into `src/app.mts` in place of the inline `emptyRegistry` stub.

### NB-38. Spell-tier `attackAttribute`: authoring spec and audit lint disagree
- **Domain:** engine
- **Where:** `docs/reference-authoring.md` §"Spell-tier extra fields (when the spell deals damage)" vs `scripts/audit-reference.mts` tier-root `attackAttribute` check. Root concept: the `character.magicAttribute` feature (per-character spell attack attribute, default `"resolute"`).
- **Impact:** Two canonical sources contradicted on whether a spell **tier** may carry its own `attackAttribute`. The authoring spec documented it as valid; the audit lint flagged it; the engine only ever read `character.magicAttribute`. Latent (zero tier-root `attackAttribute` in live `reference/spells.*`), so the risk was future drift, not a live bug.
- **Fix:** Chunk G.2 took path (a) — `character.magicAttribute` is authoritative. ADR-014 §5 retired the tier-level spell→action *promotion* entirely (spells declare explicit id'd `specialAttacks[]` / `reactions[]` arrays with numeric `damage`, per `docs/reference-authoring.md` §2 / §11), and the authoring spec's "Spell-tier extra fields" section was rewritten to drop tier-root `attackAttribute` and point at the explicit-array shape. The contradicting `scripts/audit-reference.mts` was retired in the same chunk (its checks now live in `test/rules/reference-lint.test.mts`), so the two sources can no longer disagree.
- **Status:** ✅ Resolved — Phase 6 Chunk G.2 (2026-07-10).

### NB-39. Slot-2 `own` quality has no registry-side check
- **Domain:** engine
- **Where:** `src/rules/registry.mts` `loadRegistry`, `test/rules/reference-lint.test.mts`.
- **Impact:** Schema validation asserted `combat.carried[2]`'s weapon carries `"own"`, but nothing asserted `"own"` is a registered quality id in `reference/qualities.<locale>.json`. Dropping it from the catalog would surface as a late per-recalc throw that looks like a recalc bug instead of a catalog bug.
- **Fix:** `loadRegistry` throws at startup if the quality registry lacks an `own` entry (NB-39 message); `reference-lint.test.mts` asserts the same at build time.
- **Status:** ✅ Resolved — Phase 6 Chunk G.1 (2026-07-04).

### NB-44. `secondary` + `setBase` has no primary-substitution mechanism
- **Domain:** engine
- **Where:** `src/rules/effects.mts` (`parseModifier`), `src/rules/applicator.mts` (`applySetBase`), `src/rules/derived.mts` (formula phase), `src/rules/setbase.mts` (`resolveSetBase`).
- **Impact:** The tracker claimed `parseModifier` rejects `setBase` on `secondary`, leaving "compute Defense from Discreet instead of Quick" unexpressible. This was **stale**: the mechanism already shipped with post-Chunk-F Item 5 (`resolveSetBase`, 2026-05-08). `parseModifier` accepts `secondary` + `setBase` (rejecting only `primary` and non-`attackAttribute` `combat`); `applySetBase` buckets secondary `setBase` candidates per stat; the formula phase resolves each via `resolveSetBase` (default-inclusive max-by-primary). The 4 cited entries (`smoke-and-mirrors.adept[0]`, `tactics.adept[0]`, `sixth-sense.adept[0]`, `dancing-weapon.master[1]`) resolve end-to-end once the trait registry feeds them (Chunk G.1).
- **Fix:** Corrected the record and removed the stale `scripts/audit-reference.mts` "setBase on secondary (rejected by parser)" finding; `test/rules/reference-lint.test.mts` accepts the pattern. Regression coverage: `test/rules/derived.test.mts` ("setBase override (typed)") and `test/rules/registry.test.mts` (real `smoke-and-mirrors.adept` Discreet-for-Defense).
- **Status:** ✅ Resolved — Phase 6 Chunk G.1 (2026-07-04). Was stale/misfiled; the feature shipped with Item 5.

### NB-45. `natural_weapon` schema default duplicates the catalog record (drift risk)
- **Domain:** infra
- **Where:** the hardcoded seed default for the own-slot anchor weapon (index 0 of `equipment.weapons`; the original filing's "weapons[2]" was an index slip) in `src/models/character.mts` / `generateDefaultCharacter`, plus a second copy in the `NATURAL_WEAPON` constant in `src/rules/derived.mts`, vs the canonical `natural_weapon` entry in `reference/weapons.<locale>.json`.
- **Impact:** Both copies were **hardcoded snapshots** of the `natural_weapon` catalog record — and had in fact already drifted (snapshots: damage 0, `["own"]`, name `natural_weapon`; catalog: damage 4, `["own", "short"]`, name `Natural Weapon`). Every catalog edit had to be mirrored by hand; a snapshot guard test caught drift at CI time but the single-source-of-truth violation remained.
- **Fix:** unified all copies onto the catalog. `loadRegistry` indexes `reference/weapons` into engine `Weapon` projections behind `Registry.lookupWeapon(id)` and fail-fasts at startup if `natural_weapon` is absent (mirroring the NB-39 `own`-quality check); the own-slot synthesis in `deriveCombatSlots` clones the registry record (the `NATURAL_WEAPON` constant is deleted); the inline schema default is removed and `generateDefaultCharacter` seeds `equipment.weapons` through a startup-injected lookup (`initDefaultSeeds({ lookupWeapon })`, wired in `src/app.mts` — models must not import `#rules` per ADR-013). The old snapshot guard test was replaced by a drift guard deep-equaling the creation seed against the projection of the real catalog record, plus a reference-lint anchor check (`weapons.<locale>` must define `natural_weapon`) and an API E2E assertion (created character's own slot derives `baseDamage: 4` with `short`).
- **Status:** ✅ Resolved — Phase 6 Chunk H.3 (2026-09-01). Surfaced 2026-06-20 during docs-cleanup D4b.

### NB-46. No request body size limits on any endpoint
- **Domain:** infra
- **Status:** ✅ Resolved — Phase 5 Session 3 (2026-04-18). New `src/lib/body.mts` with `readBody`/`readBodyBuffer` + `BodyTooLargeError`. Applied to all 6 body-reading sites (handleCreate, handleUpdate, multipart/parseImage, recover, backup-create, backup-restore). JSON limit: 1 MB, upload limit: ~21 MB. `BodyTooLargeError` → 413 response.
