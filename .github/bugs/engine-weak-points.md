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
- **Status:** ✅ **Resolved** — Phase 6 Chunk E (2026-04-25) closed the top-level half (`flags`, `specialAttacks`, `reactions` reset at the top of `recalculate()`) and per-slot `combat.carried[*]` rebuild. The remaining armor-overlay caveat closed in the Chunk F post-pass (Item 3, 2026-05-04): `applyArmorQuality` now writes the engine overlay to `ArmorPiece.qualitiesEffective` (a separate optional field) instead of mutating authored `qualities`, and `recalculate()` resets `qualitiesEffective` from `qualities` at the top of every pass. Authored `qualities` is never touched. See `test/rules/armor-overlay-leak.test.mts` for regression coverage.

### 32. Armor-side `appliesTo` / character-level effect gating ignored
- **Where:** `src/rules/applicator.mts` — `applyArmorQuality`, `apply{AddFlat,Multiply,Cap}` for `secondary` targets; reference data using `appliesTo: type=plug` etc.
- **Impact:** `appliesTo` (`WeaponPredicate[]`) only narrows per-slot **weapon** effects (ADR-015 §2). Armor-side `armorQuality` add/remove and character-level `secondary` effects had **no** gating mechanism: an `armorQuality` effect would fire on both `body` and `plug` regardless of intent, and an authored `appliesTo: type=plug` predicate (e.g. on Demiurge Hands) was a silent no-op (`plug` isn't a `WeaponPredicate.kind: "type"` value). Combat Oils Novice (`secondary.armor +4` only when an oiled piece is equipped) was likewise unauthorable.
- **Fix:** ADR-015 §3f — new `condition?: ArmorCondition[]` field on `ResolvedEffect`. AND-composed entries of kind `armorQuality | armorId | armorSlot | noArmor`. Accepted on `secondary` (character-level read) and `armorQuality` (per-piece read); parser strips with a warn elsewhere. Registry-synthesized `armorQuality` effects (per-piece quality registry expansion) are auto-stamped with `condition: [{ kind: "armorSlot", values: [<piece>] }]` so a body piece's quality can never bleed onto the plug. Audit lint requires `condition` on every non-registry `armorQuality` effect.
- **Status:** ✅ **Resolved** — Phase 6 Chunk F post-pass Item 3 (2026-05-04). 19 new tests in `test/rules/armor-condition.test.mts` + `test/rules/armor-overlay-leak.test.mts`. Authoring sweep applied to Soldier Adept, Demiurge Hands Novice/Master across `abilities.{en,ru}.json`.

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

### 34. `secondary` + `appliesTo` has no engine semantics
- **Where:** `src/rules/effects.mts` (parser), `src/rules/applicator.mts` (`secondary` apply paths). Authoring discovered: 9 abilities/spells carry `target.kind: "secondary"` effects with a `WeaponPredicate` `appliesTo` (e.g. Oils Novice, Cloak Dance Novice, Staff Mastery Novice ×2, Double Strike Novice, Shields Novice, Berserk Adept, Soldier Novice, Spirit Path Adept).
- **Impact:** The engine has **no slot-aware path for character-level `secondary` aggregates** (`defense`, `toughness`, `armor`, `painThreshold`, `corruptionThreshold`, `corruptionMax`). `appliesTo` was designed exclusively for per-slot weapon narrowing in `deriveCombatSlots`; on a character-level target it has nowhere to evaluate. Today (post-Chunk-F): parser accepts the predicate (Item 12 placement widened), engine ignores it at runtime. Authoring needs the gate (e.g. "+1 defense only while wielding a staff") but the engine can't honor it.
- **Open question — semantics:** What does "this secondary bonus applies while a matching weapon is carried" mean operationally? Options: (a) bonus fires if **any** carried slot satisfies the predicate (OR fold), (b) bonus is per-slot like combat-target effects but secondaries aren't per-slot today, (c) introduce a new gating mechanism distinct from `appliesTo`. Needs design.
- **Current decision (Chunk J, 2026-05-19):** Item 12 placement table **widens** to accept `appliesTo` on `secondary` so the strict parser doesn't reject authored data. Engine still ignores the predicate. The catalog stays as-is; sibling apps treat the predicate as documentary.
- **Status:** ⚠️ Open — engine wiring deferred to a future chunk. Authoring is permitted; runtime gate is a no-op until then.

### 35. `secondary` + `setBase` has no primary-substitution mechanism
- **Where:** `src/rules/effects.mts` (`parseModifier` rejects `setBase` on `secondary`), `src/rules/derived.mts` (secondary-formula stage). Authoring discovered: 4 entries want to swap the primary that feeds a secondary formula — `smoke-and-mirrors.adept[0]` ("use Discreet for Defense"), `tactics.adept[0]`, `sixth-sense.adept[0]`, `dancing-weapon.master[1]` ("use Resolute for Defense").
- **Impact:** Per ADR-015 §3, `secondary` targets accept `addFlat`/`multiply`/`cap` only — `setBase` is parser-rejected because the secondary value is a **number** computed from a hardcoded primary (e.g. defense = quick + armor mods), not an attribute slot. The parser would otherwise have to set a numeric field to a primary-name string. Authoring intent ("compute Defense from Discreet instead of Quick") has no expressible form today. Contrast: `combat.attackAttribute` IS a writable per-slot primary-name scalar, so `setBase value: "quick"` is the canonical legal pattern there (`knife-mastery.novice`).
- **Open question — design:** Three shapes considered: (a) new modifier verb (e.g. `useAttribute`) accepted only on `secondary`, value = `PrimaryAttributeName`, consumed by the secondary-formula stage as a per-secondary primary override; (b) new target kind (e.g. `secondaryAttribute`) holding the primary-name scalar separately, with `setBase` written there; (c) refactor each secondary into explicit per-formula primary slots (e.g. `defense.attribute: "quick"`) writable via `setBase`. All three need engine + schema work.
- **Sibling to #34:** Both are `secondary`-target authoring needs the engine can't honor today. Likely solved together — whichever design lands probably touches the same secondary-formula stage. Filing separately because the **missing feature** is different (gating vs. primary-substitution).
- **Current decision (post-Chunk-F amendment, 2026-05-19):** Audit lint flags these 4 entries under Section 2 (parser would reject). Catalog left as-is; sibling apps may read the `setBase value` as a documentary hint. No engine wiring.
- **Status:** ⚠️ Open — design + engine work deferred. Tied to #34 resolution.

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

### 33. Registry quality effects don't recurse — engine-added qualities are inert
- **Where:** `src/rules/effects.mts` `collectAllEffects` / `appendArmorQualityEffects` (and the symmetric weapon path in `src/rules/derived.mts` `buildSlot`, which expands `weapon.qualities` once via the registry).
- **Impact:** Registry-side quality effects are sourced from the **authored** `qualities[]` set on each weapon / armor piece. They are expanded once at the top of `recalculate()` and the result is a flat list. `applyArmorQuality` / per-slot weapon-quality `addFlat`/`remove` later in the same recalc write to a **different** field (`qualitiesEffective` for armor, `slot.qualities` for weapons), which the collector never re-reads. Consequence: a quality added by an effect is **inert** — its own registry effects never fire. Symmetrically, when an effect *removes* a quality whose authored entry was present, that quality's registry effects already fired (during the authored read) and aren't unwound. Pattern at risk: an ability that grants quality X via `armorQuality:X:addFlat` expecting X's registry side-effects to apply (e.g. *Demiurge Hands* granting `flexible` and expecting `flexible`'s "remove `hampering_N`" registry effect to follow).
- **Repro:** Author an ability that adds `quality: flexible` to the plug via `target: { kind: "armorQuality", quality: "flexible" }, modifier: { type: "addFlat" }`. Equip a plug whose authored `qualities` does **not** include `flexible`. After recalc: `plug.qualitiesEffective` contains `"flexible"`, but `flexible`'s registered `hampering_N: remove` effect did not fire. The plug still has `hampering_N` in its `qualitiesEffective`.
- **Why it isn't a data-corruption bug:** Single-pass collection by construction. No infinite loop, no stale state — just a quietly missed effect chain.
- **Authoring workaround (current convention, no engine change):** the granting ability authors **both** sides explicitly. *Demiurge Hands Master* already does this pattern correctly (the `appliesTo: type=plug` → `condition: armorSlot:plug` cleanup in Item 3 left both the `flexible` add and the `hampering_2` remove on the same ability, gated by `armorSlot: plug`). New abilities that use this pattern must follow suit; document in `docs/reference-authoring.md` §10.5 next to the registry-synthesis note.
- **Sibling caveat (when picking the workaround over an engine fix):** authoring "double effects" can surface duplicate-looking entries to siblings reading the resolved-effect log — e.g. an authored "remove `hampering_2`" alongside adding `flexible`, when `flexible` itself would have removed `hampering_2` had it been authored on the piece. For `remove` modifiers this is **idempotent** (set-membership) and harmless. For *countable* `addFlat` adds to a numeric target (e.g. a quality whose registry effect grants `secondary.armor +1`, granted via an effect rather than authored), the duplication would **double-count**. Flag this in code review whenever the pattern is used to add a quality with a numeric registry effect; for the "remove" use case it's safe.
- **Fix options (deferred, in order of preference):**
  1. **Authoring discipline (current).** Author both sides on the granting ability. Cheap, no engine change, predictable. Sibling double-count caveat above.
  2. **Two-pass collection.** After `applyArmorQuality` / per-slot weapon-quality apply writes overlays, re-expand the post-effect quality set through the registry and re-run the flag phase. Needs cycle detection (X→Y, Y→X). Pipeline reasoning gets fuzzier.
  3. **Inline expansion at apply-time.** When the applicator adds quality X, look X up in the registry and append its effects to a worklist for the same flag phase. Same cycle risk; phase ordering becomes implicit-DAG rather than fixed.
- **Status:** ❌ Open — deferred. Discovered 2026-05-09 alongside Chunk-F-postpass Item 3 review. Tracker only; no work scheduled. Lean toward Option 1 unless authoring proves it doesn't scale.

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
