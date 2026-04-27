# RPG Engine — Weak Points Tracker

> Discovered during engine assessment (2026-04-04).
> Each item remains here until explicitly resolved. Resolved items get a ✅ and date.
> Items already tracked in roadmap/deferred-tasks are marked with 📋.
>
> **Non-engine bugs** (API, HTTP, security, validation infrastructure) live in
> [`api-infra-bugs.md`](api-infra-bugs.md) (same folder). Items #15–17, #24–30 live there.
>
> **Location note:** This file lived under `/memories/repo/` until 2026-04-21,
> when both trackers were moved into the repo proper at `.github/bugs/`. Repo
> memory only supports `create`, so mutable trackers belonged in the source tree.
>
> **Phase 6 chunks** (per `.github/plans/phase6-plan.md`, locked 2026-04-22):
> A = decisions/vocabulary/data cleanup (this chunk),
> B = reference relocation,
> C = engine rewrite (typed Character, phase pipeline, typed targets, applicator),
> D = combat per-slot fanout, special attacks, reactions,
> E = trait/ability/spell effect wiring,
> F = bulk effect normalization in reference data,
> G = reference-lint & integration tests,
> H = polish.
## CRITICAL — Must Fix Before Building On

### 31. `applyFlag`/quality mutators never reset derived set membership
- **Where:** `src/rules/applicator.mts` — `applyFlagSet`, `applyArmorQuality`, `applyWeaponQuality`.
- **Impact:** Each recalc clones the incoming `Character` via `structuredClone`, so the **previous** run's `character.flags` (and armor/weapon `qualities` set membership written by the engine) is carried forward. `applyFlag` only adds names from currently-live effects and only removes names when an effect with `modifier.type === "remove"` is present. If a trait/spell/effect that used to add a flag is unlearned or removed between saves, the flag is **never cleaned up** — it sticks on the character forever until something explicitly issues a `remove`.
- **Repro:** Save a character with trait A that adds `flag: darkvision` → `flags: ["darkvision"]`. Remove trait A. Save again. Expected: `flags: []`. Actual: `flags: ["darkvision"]`.
- **Fix (planned):** `derived.mts#recalculate` should reset all engine-owned set members at the start of the pipeline — `result.flags = []`, and (once Chunk E lands) the equivalent for armor/weapon qualities that are engine-contributed vs. authored on the equipment record. Needs care: equipment `qualities` that are intrinsic to the weapon/armor must *not* be wiped — only the engine-added overlay. Options: (a) track engine-added qualities in a separate derived set, (b) rebuild equipment `qualities` from `catalog qualities ∪ engine-added`, or (c) snapshot-diff.
- **Status:** ✅ **Mostly resolved** — Phase 6 Chunk E (2026-04-25). `recalculate()` now unconditionally resets `result.flags = []`, `result.specialAttacks = []`, `result.reactions = []` at the top of the pipeline (closes the top-level half). Per-slot `combat.carried[*].flags` and `qualities` are also rebuilt fresh from each weapon every recalc by `deriveCombatSlots`, so weapon-quality leakage is gone too. **Remaining caveat:** `applyArmorQuality` still mutates `equipment.armor.body / .plug` overlay qualities in-place across recalcs — split armor overlay state vs. authored qualities is deferred to **Chunks G/H** alongside catalog reconciliation. See TODO in `src/rules/derived.mts#recalculate`.

### 18. Crash on undefined effect target
- **Where:** `src/rules/derived.mts` line ~57 — `applyEffect(result, effect.target!, effect.modifier)`
- **Impact:** Guard `!effect.target?.startsWith("rules.")` evaluates `true` when `target` is `undefined`. The `!` non-null assertion then passes `undefined` to `applyEffect` → `getNestedValue(char, undefined)` → `undefined.split(".")` → runtime `TypeError` crash.
- **Fix:** `effect.target` guarded before `applyEffect`; non-null assertion removed. Residual `setBase` `split(".")[1]!` is safe today (only entered when `target.startsWith("rules.")`) and TODO-marked for removal alongside ADR-015 typed targets in Phase 6 Chunk C.
- **Status:** ✅ Resolved — Phase 5 Session 4 (2026-04-19). Regression tests in `test/rules/derived.test.mts`.

### 1. Entire rules engine uses `Record<string, unknown>` instead of typed `Character`
- **Where:** `src/rules/derived.mts`, `src/rules/attributes.mts`, `src/rules/applicator.mts`
- **Impact:** All TypeScript interfaces from rpg-types.mts provide zero compile-time safety in the rules engine. Every property access is an unsafe cast chain. Schema changes break silently at runtime.
- **Fix:** ADR-010 — pipeline operates on typed `Character` state (or a derived computation type). Functions receive typed sub-structures (`PrimaryAttributes`, `Combat`, etc.) not opaque records.
- **Status:** ❌ Open — Phase 6 Chunk C (engine rewrite gate)

### 2. No guaranteed effect ordering — numeric priority is insufficient
- **Where:** `src/rules/derived.mts` — `allEffects.sort((a, b) => (a.priority || 10) - (b.priority || 10))`
- **Impact:** Modifier math has strict ordering requirements: setBase MUST run before addFlat, addFlat before multiply, multiply before cap. Current system relies on data authors setting the right priority number. Wrong priority = silent math errors.
- **Fix:** ADR-010 + ADR-015 — explicit phase enum, `priority` field dropped entirely.
- **Status:** ❌ Open — Phase 6 Chunk C (engine rewrite gate)

## HIGH — Significant Risk

### 19. rpg-types `EffectModifier.value: number` is wrong for setBase
- **Where:** `src/rpg-types.mts` `EffectModifier` interface — `value: number`
- **Impact:** `setBase` effects carry attribute name strings (e.g., `"discreet"`), not numbers. The type lies. Any code trusting the type for setBase values gets wrong results silently.
- **Fix:** Change to `value: number | string` or better: ADR-010 defines proper modifier types per phase.
- **Status:** ❌ Open — Phase 6 Chunk C

### 20. Rules modules bypass rpg-types interfaces entirely
- **Where:** `src/rules/applicator.mts` defines local `Modifier` with `value: unknown`. `src/rules/derived.mts` defines local `RuleEffect` with `modifier: { type: string; value: unknown }`. Neither imports from `rpg-types.mts`.
- **Impact:** The shared types in rpg-types.mts provide zero compile-time safety in the rules engine. Two parallel type hierarchies that can diverge.
- **Fix:** Subsumed by Phase 6 Chunk C — rewrite to use typed Character and canonical effect types.
- **Status:** ❌ Open — Phase 6 Chunk C. Discovered in Phase 4 Session 4 testing.

### 3. Dotted-path string targeting is fragile
- **Where:** `src/rules/applicator.mts` — `applyEffect(character, targetPath, modifier)`, effect data uses `"attributes.secondary.defense"` strings
- **Impact:** Can't be validated at compile time. Breaks silently on field renames. Planned array syntax (`"equipment.weapons[].qualities"`) makes traversal even more complex. Requires custom `getNestedValue`/`setNestedValue` which are themselves untyped.
- **Fix:** ADR-015 — Typed discriminated-union targets (`{ kind: 'secondary', attribute: 'defense' }`). Gives exhaustive switch/case, refactor safety, autocomplete.
- **Coexistence:** Must work alongside schema-driven renderer (ADR-009). Schema renderer uses dotted paths for data binding — effect targets can use typed unions internally while schema paths remain strings for UI. These are different concerns.
- **Status:** ❌ Open — Phase 6 Chunk C

### 4. Magic `"rules."` prefix convention for setBase detection
- **Where:** `src/rules/derived.mts` — `effect.target?.startsWith("rules.")` + `target.split(".")[1]`
- **Impact:** Undocumented convention baked into implementation. Only works for secondary attribute overrides. Won't generalize to combat attribute overrides, quality manipulation, or Tier B flags.
- **Fix:** Subsumed by ADR-010 + ADR-015 — explicit phase enum makes setBase a phase, not a prefix pattern. Typed targets eliminate the need for string prefix parsing.
- **Status:** ❌ Open — Resolved by Phase 6 Chunk C

### 5. Dual/triple effect sources with no unified collection
- **Where:** `src/rules/derived.mts` — three separate code paths:
  1. `character.effects[]` (temporary) — filtered at top of recalculateDerivedFields
  2. Ability/spell effects — NOT yet implemented (planned for Phase 6 Chunk E)
  3. Equipment effects — handled separately in `applyEquipmentBonuses()`
- **Impact:** Effects from different sources are processed at different points in the pipeline with different logic. No single place where "all effects on this character" is visible. Makes debugging and testing harder.
- **Fix:** ADR-010 — explicit `collectAllEffects()` step that merges all sources into a single typed array before pipeline processing.
- **Status:** ❌ Open — Phase 6 Chunk C (gate); data wired in Chunk E

### 6. Applicator uses wrong modifier verb names
- **Where:** `src/rules/applicator.mts` — `case "add"` / `case "mul"` / `case "set"`
- **Impact:** Misaligned with canonical spec (`setBase`/`addFlat`/`multiply`/`cap`). Code and spec disagree. Any data using canonical names will fall through to the `default` case (no-op).
- **Fix:** Rename when applicator is reworked in Phase 6 Chunk C; reference data updated in bulk in Chunk F.
- **Status:** 📋 Already tracked — Phase 6 Chunks C + F, deferred-tasks §1.6

## MEDIUM — Address During Engine Work

### 21. Double toughness clamping (redundant logic)
- **Where:** `src/rules/derived.mts` — `clampValues()` clamps `toughness.current` to `[0, max]`, then `enforceConsistency()` does the exact same clamping again a few lines later.
- **Impact:** Wastes cycles, confuses readers about which stage "owns" clamping. If logic diverges later, creates subtle bugs.
- **Fix:** Remove the duplicate from `enforceConsistency()` (ADR-010 pipeline separates these stages cleanly).
- **Status:** ❌ Open — Phase 6 Chunk C. Discovered in Phase 4 Session 4 testing.

### 22. Nested effects on RuleEffect never unwound
- **Where:** `src/rules/derived.mts` — `allEffects` is `character.effects[]` only. RuleEffect type DOES have an `effects?` sub-array, but recalculateDerivedFields never recurses into it.
- **Impact:** If any effect has child effects (conditional or triggered), they're silently ignored.
- **Fix:** ADR-010 `collectAllEffects()` should recursively unwrap nested effect arrays.
- **Status:** ❌ Open — Phase 6 Chunk C. Discovered in Phase 4 Session 4 testing.

### 23. `attackAttribute` `||` operator prevents effect overrides
- **Where:** `src/rules/derived.mts` — `deriveCombat()` — `combat.attackAttribute = combat.attackAttribute || "accurate"`
- **Impact:** If an effect sets `combat.attackAttribute` to `""` or `0` (falsy but intentional), the `||` operator overwrites it with `"accurate"`. More importantly, this runs AFTER the effect pipeline, so any effect that DID set the attribute gets overwritten if the field already has a truthy value from character data.
- **Fix:** Subsumed by per-slot fanout in ADR-014 — each populated slot contributes its own attack profile, with `attackAttribute` defaulting from the weapon and overridable via `{ kind: "combat", field: "attackAttribute" }` effects.
- **Status:** ✅ Resolved — Phase 6 Chunk D. `combat.attackAttribute` no longer exists at the top level; per-slot inner field is recalc-derived from the slot's weapon. The `||` fallback is gone.

### 7. `deriveCombat()` buried inside `enforceConsistency()`
- **Where:** `src/rules/derived.mts` — enforceConsistency() does: clamp toughness, reset negative XP, filter expired effects, ensure equipment defaults, AND derive combat
- **Impact:** Conceptually distinct pipeline stages tangled in one function. Hard to test and debug individually.
- **Fix:** Separate into distinct pipeline stages per ADR-010.
- **Status:** ✅ Resolved — Phase 6 Chunks C + E. `recalculate()` now invokes `deriveCombatSlots(result, effects)` as its own pipeline stage (separate from `enforceConsistency`, which is reduced to XP + equipment defaults).

### 8. `deriveCombat()` only reads first weapon, no dual-wield
- **Where:** `src/rules/derived.mts` — `const primaryIndex = weaponSlots[0]`
- **Impact:** Characters with dual-wield weapons won't get correct bonusDamage.
- **Fix:** Subsumed by per-slot fanout in ADR-014 — `combat.carried` is `[Slot|null, Slot|null, Slot]` and each populated slot independently produces an attack profile, replacing the `weapons[]` index list.
- **Status:** ✅ Resolved — Phase 6 Chunk D. `combat.carried` is now `[Slot|null, Slot|null, Slot]` and `deriveCombat` synthesises a per-slot profile for every populated slot (ADR-014).

### 9. `bonusDamage` always empty / `attackAttribute` hardcoded to "accurate"
- **Where:** `src/rules/derived.mts` — `combat.bonusDamage = combat.bonusDamage || []`
- **Impact:** No ability-driven bonus damage or attack attribute override.
- **Fix:** Per-slot fanout (Chunk D) populates these from each slot's weapon and from `{ kind: "combat", field: "bonusDamage" / "attackAttribute" }` effects (Chunk E wires the ability data).
- **Status:** ✅ Resolved — Phase 6 Chunks D + E. Per-slot `attackAttribute`/`baseDamage`/`bonusDamage` are derived from the slot's weapon and from typed `combat`-targeted effects with `WeaponPredicate` routing. `attackAttribute` accepts `setBase` only; `baseDamage`/`bonusDamage` accept `addFlat`/`multiply`/`cap` (parser-enforced).

### 10. `effects.mts` and `registry.mts` are empty files
- **Where:** `src/rules/effects.mts`, `src/rules/registry.mts`
- **Impact:** Placeholder files with no implementation. Effect resolution and ability lookup don't exist yet.
- **Fix:** Will be populated in Phase 6 Chunks C (effects pipeline) and E (ability registry lookup).
- **Status:** 📋 Phase 6 Chunks C + E

### 11. `xp.mts` was a comment only + premature XP logic in validation
- **Where:** `src/rules/xp.mts` (deleted), `src/models/validation.mts` (cleaned)
- **Impact:** `xp.mts` contained only a 5-line comment. `validateCharacterUpdate` had two XP-related blocks: a fully commented-out `increment` block (dead code) and an active `push` XP check that was reachable but premature — it assumed `trait.cost` was `number[]`, blindly indexed `[0]`, and had no corresponding XP deduction after validation passed.
- **Fix:** Both blocks removed in Phase 5 Session 1. `xp.mts` deleted. XP validation will be rebuilt properly in Phase 6 with typed effects.
- **Status:** ✅ Resolved — Phase 5 Session 1 (2026-04-16)

_Items #15, #16, #17 moved to [`api-infra-bugs.md`](api-infra-bugs.md)._

## LOW — Track But Not Blocking

### 12. 📋 No evaluation engine for conditional effects (Tier B)
- **Where:** Planned in deferred-tasks §1.3 (Tier B vocabulary definition)
- **Impact:** Many abilities have conditions ("when wielding heavy weapons", "when wearing no armor"). These remain text-only until a condition evaluator exists.
- **Status:** 📋 Phase 6 Chunks C/E

### 13. 📋 Effect data in reference files is free-text, not normalized
- **Where:** `reference/abilities.en.json`, `reference/spells.en.json` — ~654 tier effects
- **Impact:** Engine can't process any ability effect until normalization is done.
- **Status:** 📋 Phase 6 Chunk F (bulk normalization)

### 14. 📋 Reference data files missing (weapons, armor, runes)
- **Where:** Planned in deferred-tasks §2
- **Status:** 📋 Weapons + armor exist (armor refreshed in Chunk A); relocation to `reference/` in Chunk B; runes still pending.

### 19. 📋 Slot-2 `own` quality has no registry-side check
- **Where:** `src/models/character.mts` `validateCombatCarried` and the [quality registry](../decisions/016-quality-registry.md).
- **Impact:** Schema validation asserts that `combat.carried[2]`'s weapon has `"own"` in its `qualities[]`, but nothing currently asserts the symmetric registry-side property: that `"own"` is a registered quality id in `reference/qualities.<locale>.json`. If `"own"` is dropped from the catalog by mistake, the engine throws on every recalc *after* a save lands — the failure surfaces late and looks like a recalc bug instead of a catalog bug.
- **Fix:** Add to the Chunk G load-time `reference-lint.test.mts` validator (now drafted in [phase6-plan.md § Chunk G step 6](../plans/phase6-plan.md#chunk-g--wire-abilityspell-registry-into-recalc)). Optionally also assert this at engine startup in `loadQualityIndex()`.
- **Status:** 📋 Phase 6 Chunk G


_Items #24, #25, #26, #27, #28, #29 moved to [`api-infra-bugs.md`](api-infra-bugs.md)._
