# Bug Tracker — RPG Engine (open)

> Open RPG-engine bugs and design weaknesses. Resolved engine bugs are
> archived in [`resolved.md`](resolved.md); non-engine bugs (API, HTTP,
> security, validation, storage) live in [`infra.md`](infra.md).
>
> See [`README.md`](README.md) for the `NB-N` id scheme, the severity rubric,
> and the filing / closing procedure. Cite a bug from code as `NB-<n>`.

## CRITICAL — Must Fix Before Building On

### NB-1. Entire rules engine uses `Record<string, unknown>` instead of typed `Character`
- **Where:** `src/rules/derived.mts`, `src/rules/attributes.mts`, `src/rules/applicator.mts`
- **Impact:** All TypeScript interfaces from rpg-types.mts provide zero compile-time safety in the rules engine. Every property access is an unsafe cast chain. Schema changes break silently at runtime.
- **Fix:** ADR-010 — pipeline operates on typed `Character` state (or a derived computation type). Functions receive typed sub-structures (`PrimaryAttributes`, `Combat`, etc.) not opaque records.
- **Status:** ❌ Open — Phase 6 Chunk C (engine rewrite gate)

### NB-2. No guaranteed effect ordering — numeric priority is insufficient
- **Where:** `src/rules/derived.mts` — `allEffects.sort((a, b) => (a.priority || 10) - (b.priority || 10))`
- **Impact:** Modifier math has strict ordering requirements: setBase MUST run before addFlat, addFlat before multiply, multiply before cap. Current system relies on data authors setting the right priority number. Wrong priority = silent math errors.
- **Fix:** ADR-010 + ADR-015 — explicit phase enum, `priority` field dropped entirely.
- **Status:** ❌ Open — Phase 6 Chunk C (engine rewrite gate)

## HIGH — Significant Risk

### NB-19. rpg-types `EffectModifier.value: number` is wrong for setBase
- **Where:** `src/rpg-types.mts` `EffectModifier` interface — `value: number`
- **Impact:** `setBase` effects carry attribute name strings (e.g., `"discreet"`), not numbers. The type lies. Any code trusting the type for setBase values gets wrong results silently.
- **Fix:** Change to `value: number | string` or better: ADR-010 defines proper modifier types per phase.
- **Status:** ❌ Open — Phase 6 Chunk C

### NB-20. Rules modules bypass rpg-types interfaces entirely
- **Where:** `src/rules/applicator.mts` defines local `Modifier` with `value: unknown`. `src/rules/derived.mts` defines local `RuleEffect` with `modifier: { type: string; value: unknown }`. Neither imports from `rpg-types.mts`.
- **Impact:** The shared types in rpg-types.mts provide zero compile-time safety in the rules engine. Two parallel type hierarchies that can diverge.
- **Fix:** Subsumed by Phase 6 Chunk C — rewrite to use typed Character and canonical effect types.
- **Status:** ❌ Open — Phase 6 Chunk C. Discovered in Phase 4 Session 4 testing.

### NB-3. Dotted-path string targeting is fragile
- **Where:** `src/rules/applicator.mts` — `applyEffect(character, targetPath, modifier)`, effect data uses `"attributes.secondary.defense"` strings
- **Impact:** Can't be validated at compile time. Breaks silently on field renames. Planned array syntax (`"equipment.weapons[].qualities"`) makes traversal even more complex. Requires custom `getNestedValue`/`setNestedValue` which are themselves untyped.
- **Fix:** ADR-015 — Typed discriminated-union targets (`{ kind: 'secondary', attribute: 'defense' }`). Gives exhaustive switch/case, refactor safety, autocomplete.
- **Coexistence:** Must work alongside schema-driven renderer (ADR-009). Schema renderer uses dotted paths for data binding — effect targets can use typed unions internally while schema paths remain strings for UI. These are different concerns.
- **Status:** ❌ Open — Phase 6 Chunk C

### NB-4. Magic `"rules."` prefix convention for setBase detection
- **Where:** `src/rules/derived.mts` — `effect.target?.startsWith("rules.")` + `target.split(".")[1]`
- **Impact:** Undocumented convention baked into implementation. Only works for secondary attribute overrides. Won't generalize to combat attribute overrides, quality manipulation, or Tier B flags.
- **Fix:** Subsumed by ADR-010 + ADR-015 — explicit phase enum makes setBase a phase, not a prefix pattern. Typed targets eliminate the need for string prefix parsing.
- **Status:** ❌ Open — Resolved by Phase 6 Chunk C

### NB-5. Dual/triple effect sources with no unified collection
- **Where:** `src/rules/derived.mts` — three separate code paths:
  1. `character.effects[]` (temporary) — filtered at top of recalculateDerivedFields
  2. Ability/spell effects — NOT yet implemented (planned for Phase 6 Chunk E)
  3. Equipment effects — handled separately in `applyEquipmentBonuses()`
- **Impact:** Effects from different sources are processed at different points in the pipeline with different logic. No single place where "all effects on this character" is visible. Makes debugging and testing harder.
- **Fix:** ADR-010 — explicit `collectAllEffects()` step that merges all sources into a single typed array before pipeline processing.
- **Status:** ❌ Open — Phase 6 Chunk C (gate); data wired in Chunk E

### NB-6. Applicator uses wrong modifier verb names
- **Where:** `src/rules/applicator.mts` — `case "add"` / `case "mul"` / `case "set"`
- **Impact:** Misaligned with canonical spec (`setBase`/`addFlat`/`multiply`/`cap`). Code and spec disagree. Any data using canonical names will fall through to the `default` case (no-op).
- **Fix:** Rename when applicator is reworked in Phase 6 Chunk C; reference data updated in bulk in Chunk F.
- **Status:** 📋 Already tracked — Phase 6 Chunks C + F, deferred-tasks §1.6

### NB-34. `secondary` + `appliesTo` has no engine semantics
- **Where:** `src/rules/effects.mts` (parser), `src/rules/applicator.mts` (`secondary` apply paths). Authoring discovered: 9 abilities/spells carry `target.kind: "secondary"` effects with a `WeaponPredicate` `appliesTo` (e.g. Oils Novice, Cloak Dance Novice, Staff Mastery Novice ×2, Double Strike Novice, Shields Novice, Berserk Adept, Soldier Novice, Spirit Path Adept).
- **Impact:** The engine has **no slot-aware path for character-level `secondary` aggregates** (`defense`, `toughness`, `armor`, `painThreshold`, `corruptionThreshold`, `corruptionMax`). `appliesTo` was designed exclusively for per-slot weapon narrowing in `deriveCombatSlots`; on a character-level target it has nowhere to evaluate. Today (post-Chunk-F): parser accepts the predicate (Item 12 placement widened), engine ignores it at runtime. Authoring needs the gate (e.g. "+1 defense only while wielding a staff") but the engine can't honor it.
- **Open question — semantics:** What does "this secondary bonus applies while a matching weapon is carried" mean operationally? Options: (a) bonus fires if **any** carried slot satisfies the predicate (OR fold), (b) bonus is per-slot like combat-target effects but secondaries aren't per-slot today, (c) introduce a new gating mechanism distinct from `appliesTo`. Needs design.
- **Current decision (Chunk J, 2026-05-19):** Item 12 placement table **widens** to accept `appliesTo` on `secondary` so the strict parser doesn't reject authored data. Engine still ignores the predicate. The catalog stays as-is; sibling apps treat the predicate as documentary.
- **Update (Chunk G.1, 2026-07-04):** the engine now **skips** any `secondary`-target effect that carries an `appliesTo` predicate (`collectAllEffects` filters them out) instead of applying it unconditionally. Applying a weapon-conditional bonus unconditionally bakes a sometimes-true value into the derived stat (e.g. `double-strike.novice` granting +1 defense even bare-handed); skipping is the safe interim behavior. The predicate still rides to sibling apps as documentary data. The weapon-conditional-secondary *feature* remains unbuilt (a UI "this weapon grants X" surface is deferred to roadmap Phase 8), so this stays open.
- **Status:** ⚠️ Open — interim behavior is skip-not-apply (Chunk G.1); the conditional-secondary feature + UI surface are deferred to Phase 8.

## MEDIUM — Address During Engine Work

### NB-21. Double toughness clamping (redundant logic)
- **Where:** `src/rules/derived.mts` — `clampValues()` clamps `toughness.current` to `[0, max]`, then `enforceConsistency()` does the exact same clamping again a few lines later.
- **Impact:** Wastes cycles, confuses readers about which stage "owns" clamping. If logic diverges later, creates subtle bugs.
- **Fix:** Remove the duplicate from `enforceConsistency()` (ADR-010 pipeline separates these stages cleanly).
- **Status:** ❌ Open — Phase 6 Chunk C. Discovered in Phase 4 Session 4 testing.

### NB-22. Nested effects on RuleEffect never unwound
- **Where:** `src/rules/derived.mts` — `allEffects` is `character.effects[]` only. RuleEffect type DOES have an `effects?` sub-array, but recalculateDerivedFields never recurses into it.
- **Impact:** If any effect has child effects (conditional or triggered), they're silently ignored.
- **Fix:** ADR-010 `collectAllEffects()` should recursively unwrap nested effect arrays.
- **Status:** ❌ Open — Phase 6 Chunk C. Discovered in Phase 4 Session 4 testing.

### NB-33. Registry quality effects don't recurse — engine-added qualities are inert
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

### NB-10. `effects.mts` and `registry.mts` are empty files
- **Where:** `src/rules/effects.mts`, `src/rules/registry.mts`
- **Impact:** Placeholder files with no implementation. Effect resolution and ability lookup don't exist yet.
- **Fix:** Will be populated in Phase 6 Chunks C (effects pipeline) and E (ability registry lookup).
- **Status:** 📋 Phase 6 Chunks C + E

## LOW — Track But Not Blocking

### NB-12. 📋 No evaluation engine for conditional effects (Tier B)
- **Where:** Planned in deferred-tasks §1.3 (Tier B vocabulary definition)
- **Impact:** Many abilities have conditions ("when wielding heavy weapons", "when wearing no armor"). These remain text-only until a condition evaluator exists.
- **Status:** 📋 Phase 6 Chunks C/E

### NB-13. 📋 Effect data in reference files is free-text, not normalized
- **Where:** `reference/abilities.en.json`, `reference/spells.en.json` — ~654 tier effects
- **Impact:** Engine can't process any ability effect until normalization is done.
- **Status:** 📋 Phase 6 Chunk F (bulk normalization)

### NB-14. 📋 Reference data files missing (weapons, armor, runes)
- **Where:** Planned in deferred-tasks §2
- **Status:** 📋 Weapons + armor exist (armor refreshed in Chunk A); relocation to `reference/` in Chunk B; runes still pending.

## DEFERRED — Track for later, not currently scoped

### NB-35. `RawEffect` wire shape still leaks into the engine via `character.effects[]`
- **Where:** `src/rpg-types.mts` — `RawEffect` / `RawEffectModifier` interfaces, `Character.effects: RawEffect[]`. Normalization boundary: `src/rules/effects.mts#normalizeRawEffect`. Reference catalogs (weapons, armor, abilities, spells, qualities) were migrated to author `ResolvedEffect[]` directly during Chunk F; `Character.effects[]` (player- / DM-authored persistent overrides) is the last consumer.
- **Impact:** Two parallel effect shapes still exist. New contributors mis-author by copying the wrong one; the normalization layer is dead weight everywhere except the in-character path; the `duration` and `priority` fields on `RawEffect` are silently ignored (documented but easy to miss). Cleanup risk is also non-trivial because in-character `effects[]` is the one place where the legacy shape might carry real player data.
- **Fix when scoped:** (a) Decide the migration path for in-character `effects[]` — either author as `ResolvedEffect` directly (simplest; loses the `duration` hint sibling apps may want) or define a thin typed wrapper that carries `effect: ResolvedEffect` + sibling-app metadata. (b) Migrate any persisted `character.effects[]` entries (storage rewrite + schema bump). (c) Delete `RawEffect` / `RawEffectModifier` / `normalizeRawEffect` and inline the resolved shape everywhere. The `TODO(rawEffect-removal)` comment in `src/rpg-types.mts` is the in-code anchor.
- **Status:** ⏸️ Deferred — not breaking anything; pure cleanup. Revisit once the addon/bot integration in Phase 7 has clarified what (if any) lifecycle metadata sibling apps need on persistent overrides.

### NB-36. `enforceConsistency()` may be fully redundant with schema/storage defaulting
- **Where:** `src/rules/derived.mts` — `enforceConsistency()`. In-code anchor: `TODO(enforce-consistency-redundancy)` at the head of the function.
- **Impact:** Post-Chunk C the function is reduced to two responsibilities — XP non-negativity guard and equipment defaulting (filling `equipment.weapons[]` / `equipment.armor` / etc. when absent). Both responsibilities are *also* enforced at the schema/storage boundary on every write (`src/models/character.mts` + `src/models/storage.mts`). The recalc pipeline calls `enforceConsistency()` defensively after a deep-clone, but if the schema layer is the single source of truth for defaulting, this call is dead weight and the function can be deleted entirely. The uncertainty is about *negative XP* specifically: validation rejects writes that submit negative XP, but the engine has no equivalent guard against an effect pipeline producing negative XP mid-recalc (currently there is no such effect — XP isn't a typed `EffectTarget`). If that ever changes, the XP clamp becomes load-bearing.
- **Fix when scoped:** (a) Audit `src/models/character.mts` + `src/models/storage.mts` to confirm equipment defaulting is exhaustive (every field `enforceConsistency` fills is also filled at the boundary). (b) Confirm no current `EffectTarget` can mutate `experience.unspent` (it should be unreachable from the typed pipeline). (c) If both hold, delete `enforceConsistency()` and its call site in `recalculate()`. If only (a) holds, keep the XP guard as a one-liner inline in `recalculate()` and delete the rest. (d) Update the module header to drop the "Equipment defaulting" bullet.
- **Status:** ⏸️ Deferred — pure cleanup, no functional bug. Surfaced 2026-05-23 during docs-cleanup Pass D1.5 sweep. Fits the Chunk H "cleanup" umbrella per [`phase6-plan.md`](../plans/phase6-plan.md) but is not currently listed as a Chunk H step; revisit during Chunk H execution or sooner if a contributor touches the function.

### NB-47. Talent engine representation is incomplete (no level-scaling; many talents carry no flag)
- **Where:** `src/rules/registry.mts` (`lookupTalent`), `src/rules/effects.mts` (talent collection loop), `reference/boons.{en,ru}.json`, `reference/sins.{en,ru}.json`.
- **Impact:** Two gaps in how the engine represents talents (boons / sins). (a) **No numeric level-scaling.** `lookupTalent(id, level)` returns the boon / sin top-level `effects[]` verbatim and **ignores** `level`. Talents carry a numeric `levels` (max purchasable, 1–3) and a bought `level`, but no talent currently carries a numeric-target effect, and flags ignore their numeric value (ADR-015 §3a), so the engine produces the same output at level 1 and level 3. If a future talent needs magnitude that scales with level, the loader must grow a scaling rule (×level vs +per-level is undecided). (b) **Many talents have no engine representation at all.** Only ~12 boons + 1 sin carry a top-level `effects[]` (all `flag` targets — knowledge / resistance set-membership). The large class of check-bonus talents (Actor, Powerful Voice, Deceiver, …) grant a "+1 on X checks" that is Tier-C narrative — no flag, no engine effect. Sibling apps can only key off "talent present + level"; the engine surfaces nothing derived for them.
- **Fix when scoped (authoring-driven):** revisit if / when a sibling app needs engine-computed talent output. Options: (a) add a `flag` per check-bonus talent so siblings gate on set-membership; (b) introduce a numeric talent-effect target + a level-scaling rule in `lookupTalent`. Both are authoring + small-engine changes; neither is needed while siblings treat talents as "present + level."
- **Status:** ⏸️ Deferred — no live-data impact (no talent needs scaling or a flag today). Filed 2026-07-10 during Chunk G.2 doc/tracker reconciliation.
