# Phase 6 — Engine Foundation Rework (Per-Slot Combat + Special Attacks)

> Created 2026-04-21. Replaces the original Phase 6 Step 0/5 plan in
> [`docs/roadmap.md`](../../docs/roadmap.md). Drives ADR-014 and an amendment
> to [ADR-011](../../docs/decisions/011-typed-effect-targets.md).

## TL;DR

Replace the current single-stat `Combat` shape with a 3-slot derived model
(slot 2 = non-disarmable / `own` quality), drop `combat.active` (sibling
projects manage it), introduce typed `EffectTarget` discriminated union with
weapon predicates, introduce derived `SpecialAttack[]` and `Reaction[]`
collections, rewrite the rules engine with typed state and explicit phases,
and renormalize ability/spell/armor reference data to the new shape. Sliced
into 8 chunks (A–H) so each is independently reviewable. Existing characters
will be deleted; no migration code path.

## Engine Weak-Points Coverage

Maps [`engine-weak-points.md`](../bugs/engine-weak-points.md) items to the
chunks that resolve them.

| Bug | Title | Chunk |
|----:|-------|-------|
| #1  | Engine uses `Record<string, unknown>` | C |
| #2  | Numeric priority insufficient for ordering | C (priority dropped) |
| #3  | Dotted-path string targeting | C (typed targets) |
| #4  | Magic `"rules."` prefix | C |
| #5  | Dual/triple effect sources, no unified collection | C + G |
| #6  | Applicator uses wrong modifier verb names | C |
| #7  | `deriveCombat()` buried in `enforceConsistency()` | C / E |
| #8  | `deriveCombat()` only reads first weapon | E |
| #9  | `bonusDamage` empty / `attackAttribute` hardcoded | E |
| #10 | `effects.mts` and `registry.mts` are empty | C + G |
| #12 | No evaluator for conditional effects (Tier B) | partial — see cross-cutting note |
| #13 | Free-text effect data | F |
| #18 | Crash on undefined effect target | already resolved |
| #19 | `EffectModifier.value: number` wrong for setBase | C |
| #20 | Rules modules bypass rpg-types interfaces | C |
| #21 | Double toughness clamping | C |
| #22 | Nested effects on RuleEffect never unwound | C |
| #23 | `attackAttribute \|\|` prevents effect overrides | E |

## Chunks Overview

| Chunk | Focus | Code | Data | Tests | Docs |
|-------|-------|------|------|-------|------|
| A | Decisions, vocabulary lock & armor refactor | — | small | — | ADRs |
| B | Reference catalog relocation (`data/` → `reference/`) | medium | move | medium | medium |
| C | Typed pipeline foundation (no combat fanout) | large | — | large | — |
| D | Schema migration: `Combat` + `specialAttacks` | large | wipe chars | large | small |
| E | Combat phase per-slot fanout + predicates | medium | — | medium | — |
| F | Effect normalization (data, collaborative) | — | huge | — | — |
| G | Wire ability/spell registry into recalc | small | — | medium | — |
| H | Validators, sibling docs, cleanup | medium | — | medium | large |

---

## Chunk A — Decisions, Vocabulary Lock & Armor Refactor

**No engine code changes.** Get all design docs and reference vocabulary
into a stable state before any code moves.

**Steps**

1. Write **ADR-014**: *Per-Weapon Combat Slots, Special Attacks & Reactions*.
   - Fixed 3-slot model: slot 0 primary, slot 1 secondary, slot 2 non-disarmable.
   - Slot 2 is **required** (defaults to `natural_weapon` on creation).
   - No `combat.active`; sibling apps determine active weapon at gameplay time.
   - Slot 2 must reference a weapon with the `own` quality.
   - Combat phase of pipeline runs once per non-empty slot.
   - `SpecialAttack[]` and `Reaction[]` are derived collections on `Character`,
     server-only. Same shape, separated by semantics: special attacks are
     player-invoked on their own turn; reactions fire on a `trigger` during
     others' turns.
   - Spells produce `SpecialAttack` and/or `Reaction` entries; spell **tiers**
     gain `attackAttribute`/`damage`/`trigger` metadata where applicable.
     (No `cost` field — corruption cost is computed by sibling apps from
     character `traditions` vs spell tags.)
   - Tier stacking is additive (master = novice + adept + master effects).
2. Amend ADR-011 (typed effect targets):
   - Drop `CheckTarget`.
   - Keep `ArmorQualityTarget` (Soldier-adept needs `hampering_N` removal,
     which after the refactor below becomes an armor-type-derived flag).
   - Add `WeaponPredicate` discriminated union: `{ kind: "any" | "type" |
     "subtype" | "quality" | "id"; values: string[] }`. Multiple predicates
     compose by AND (effect carries `appliesTo: WeaponPredicate[]`).
   - Final `EffectTarget` union: `secondary | combat | weaponQuality |
     armorQuality | flag` (5 kinds).
   - Drop `priority` field from effects (phase ordering replaces it).
   - Define **early-draft** `TriggerKind` enum (engine treats as opaque
     string literal — no logic attached; sibling apps interpret). Working
     starting set, to be finalized during Chunk F as patterns emerge:
     `manual | onTurnStart | onTurnEnd | onAttacked | onDamaged | onCrit |
     onAllyDamaged | onSpellCast | onMovement | onSightOf | onRageStart |
     onRageEnd`. `manual` = special attack (player-invoked).
     Engine validates only "trigger value is one of the known set";
     adding/removing values is a one-line enum change.
3. Add `own` quality to `data/weapons.en.json` and `data/weapons.ru.json`
   for non-disarmable weapons: `natural_weapon`, `war_claws`, `heels`
   (review the full list during the chunk).
4. Refactor armor `hampering_N` qualities into armor `type` field:
   - `hampering_2` → `type: "light"`
   - `hampering_3` → `type: "medium"`
   - `hampering_4` → `type: "heavy"`
   - Update `data/armor.{en,ru}.json` accordingly.
   - Soldier-adept's effect becomes a `flag` or `armorQuality` removal of
     the type-derived restriction (decide concrete shape during data pass).
5. Update `docs/data-contracts.md` §1.1:
   - Canonical `EffectTarget` vocabulary.
   - Canonical lists of weapon `type`, weapon `quality`, weapon `id`,
     armor `type`, armor `quality` — sourced from reference files.
   - `SpecialAttack` shape.
   - `WeaponPredicate` semantics (AND composition; default `any`).
   - Armor type vocabulary: `light` | `medium` | `heavy` | `plug`.
6. Update `docs/deferred-tasks.md`:
   - Mark §1 (effect normalization) as in-progress with new shape.
   - Mark §3 (dual-wield) as subsumed by per-slot fanout.
   - Replace Tier-B `specialAttack`/`reaction` flag examples with
     `SpecialAttack` promotion.

**Verification**

1. ADR-014 reviewed and accepted by user; ADR-011 amendment accepted.
2. `weapons.{en,ru}.json` and `armor.{en,ru}.json` validate as JSON;
   non-disarmable weapons flagged; armor types replace `hampering_N`.
3. `docs/data-contracts.md` lists complete weapon + armor vocabulary;
   `npm run typecheck` still passes (no code changed).

**Decisions locked**

- Non-disarmable marker = quality `"own"`.
- `armorQuality` target stays in union (Soldier-adept needs it).
  Soldier-novice is a normal `addFlat` on `secondary.armor`.
- Spells gain `damage`/`attackAttribute`/`trigger` fields directly on the
  spell **tier** object (not the spell root, not a parallel file). No `cost`
  field — sibling apps compute corruption from `traditions` vs spell tags.
- Special attacks vs reactions: same shape, two collections. Distinction is
  `trigger === "manual"` (special attack) vs anything else (reaction).
  Engine populates both lists; sibling apps render them separately.
- Slot 2 weapon binding: by index into `equipment.weapons[]`, same as 0/1.
- `equipment.weapons[]` may contain >3 entries; `combat.carried` selects
  exactly 3 (or null for empty slots 0/1; slot 2 is always non-null).
- **Tier stacking is additive.** A character with `{ id, tier: "master" }`
  collects effects from `novice` + `adept` + `master`. Each tier is authored
  with only the *new* effects it introduces. Higher tiers extend lower ones.
- **Berserk exception**: novice's "Defense cap 5 during rage" is rage-state
  only (temporary), and master "removes" it. The engine has no way to cancel
  a previous tier's effect. Resolution: re-tier Berserk-novice's cap as
  **Tier C narrative** (rage is a temporary toggle anyway, not a permanent
  character mod). Berserk-novice's `+d6` melee `bonusDamage` stays Tier A.
  This eliminates the only known cancellation case and keeps the engine
  purely additive. If gameplay needs the cap, sibling apps apply it when
  rage is active.
- Axe Patterns-adept's negative bonus is a normal `addFlat` with `value: -2`.
  No special casing — additive math handles it.

---

## Chunk B — Reference Catalog Relocation

**Steps** (already pre-planned in roadmap Gate)

1. Add `REFERENCE_DIR` to `src/lib/config.mts` (defaults `<root>/reference`).
2. Move `data/{abilities,spells,boons,sins,rituals,weapons,armor}.{en,ru}.json`
   → `reference/`.
3. Update `src/models/abilities.mts` to read from `REFERENCE_DIR`. Reconcile
   the legacy locale-less `abilities.json` read with the localized convention.
4. Update test helper `test/helpers/http.mts` seed paths.
5. Update static-file URL→fs mapping table in
   `.github/copilot-instructions.md`. Decide whether `reference/` is served
   over HTTP at all (likely yes, for client locale lookups today done from
   `/data/...`).
6. Update path references in `docs/{bot,addon}-integration.md`,
   `docs/data-contracts.md`, `docs/deferred-tasks.md`, `docs/architecture.md`,
   `docs/roadmap.md` Gate.
7. Repo memory updates (`/memories/repo/nagara-rpg-rules.md`,
   `/memories/repo/character-builder.md`).

**Verification**

1. `npm test` green.
2. `npm run start:dev`, hit `/api/abilities?locale=en` → returns 169.
3. `data/` contains only runtime mutable state.

---

## Chunk C — Typed Pipeline Foundation (Combat Phase Stubbed)

Rewrite the rules engine with typed state and ADR-010 phases. Combat fanout
deferred to Chunk E so the schema change can be done independently.

**Steps**

1. In `src/rpg-types.mts` add:
   - `EffectTarget` discriminated union (5 kinds).
   - `EffectFlag` literal union (existing ADR-011 vocabulary minus
     `specialAttack`/`reaction` which become `SpecialAttack` source kinds).
   - `EffectModifier` per-phase shape: `setBase: { type: "setBase"; value:
     PrimaryAttributeName }`, `addFlat: { type: "addFlat"; value: number }`,
     `multiply: { type: "multiply"; value: number }`, `cap: { type: "cap";
     value: number }`, `remove: { type: "remove" }`. Closes Bug #19/#20.
   - `WeaponPredicate` union.
   - `EffectPhase` enum: `setBase | formula | addFlat | multiply | cap | flag`.
   - `ResolvedEffect` interface: `{ source, target, modifier, appliesTo? }`.
   - `TriggerKind` literal union (per Chunk A draft).
   - `Action` base interface: `{ source, name, trigger, attackAttribute?,
     damage?, effects? }`. `SpecialAttack = Action & { trigger: "manual" }`,
     `Reaction = Action & { trigger: Exclude<TriggerKind, "manual"> }`.
   - `CombatSlot` interface: `{ weaponIndex, attackAttribute, baseDamage,
     bonusDamage: number, qualities, flags }`.
   - New `Combat`: `{ carried: [Slot|null, Slot|null, Slot] }`.
   - Add `specialAttacks: SpecialAttack[]` and `reactions: Reaction[]` to
     `Character`.
2. Create `src/rules/effects.mts`:
   - `collectAllEffects(char, registry): ResolvedEffect[]` merging traits,
     equipment, temporary (`character.effects[]`).
   - `groupByPhase(effects): Map<EffectPhase, ResolvedEffect[]>`.
   - Walks nested `effects[]` arrays recursively. Closes Bug #22.
3. Rewrite `src/rules/attributes.mts`:
   - `SECONDARY_FORMULAS` functions take typed `PrimaryAttributes`.
   - Drop `Record<string, unknown>`. Closes Bug #1.
4. Rewrite `src/rules/applicator.mts`:
   - Typed `Character` state.
   - Exhaustive `switch (target.kind)`.
   - Handlers: `applySecondary`, `applyCombat` (slot-aware, see Chunk E),
     `applyWeaponQuality`, `applyArmorQuality`, `applyFlag`.
   - Combat handler stubbed: no-op in C, real in E.
   - Removes `add`/`mul`/`set`; uses `setBase`/`addFlat`/`multiply`/`cap`/
     `remove`. Closes Bug #6.
5. Rewrite `src/rules/derived.mts`:
   - `recalculate(char, registry): Character` typed end-to-end.
   - Pipeline: `collectAllEffects` → `groupByPhase` → run phases in fixed
     order (`setBase` overrides → secondary formulas → `addFlat`/`multiply`/
     `cap` for non-combat targets) → `clampValues` → `enforceConstraints`.
   - No `"rules."` prefix. Closes Bug #4.
   - No `effect.target!` non-null assertions. Closes Bug #18.
   - `enforceConstraints` no longer clamps toughness. Closes Bug #21.
   - Combat derivation called as a separate stub function (filled in E).
6. Update `src/models/index.mts` and call sites to pass typed `Character`.
7. Migrate baseline tests to typed inputs:
   - `test/rules/attributes.test.mts`
   - `test/rules/applicator.test.mts`
   - `test/rules/derived.test.mts`
8. Add `test/rules/effects.test.mts` covering `collectAllEffects` (multi-source
   merge, nested unwinding, expired filtering).

**Closes weak-point bugs**: #1, #2, #4, #5 (partial), #6, #18, #19, #20, #21,
#22.

**Verification**

1. `npm run typecheck` clean — no `Record<string, unknown>` in `src/rules/`.
2. `npm test` green; new + migrated rules tests pass.
3. Existing characters still load; secondary attributes correct.
4. Combat fields unchanged from pre-chunk values (combat phase still stub).

---

## Chunk D — Schema Migration: `Combat` + `SpecialAttack[]`

Adopts the new shape end-to-end: server schema, validators, serializer,
SSE sanitizer, client renderer. Existing characters wiped.

**Steps**

1. Update `src/models/character.mts`:
   - Replace `Combat` schema metadata with `carried` (3-slot array of
     `weaponIndex | null` for slots 0/1, required `weaponIndex` for slot 2,
     plus derived per-slot fields).
   - Add `specialAttacks` and `reactions` sections with read-only schema
     metadata.
   - Add slot 2 validation: weapon must have `own` quality; cannot be null.
   - Mark derived fields (per-slot `attackAttribute`, `baseDamage`,
     `bonusDamage`, `qualities`, `flags`, plus all of `specialAttacks` and
     `reactions`) as server-controlled — exclude from input the way
     `lastModified` is.
   - Bump `schemaVersion`.
2. Update `src/models/validation.mts`: validate slot 2 own-quality + non-null
   rule; reject input attempting to set derived fields.
3. Update SSE sanitizer / schema serializer if they enumerate combat fields.
4. Update client:
   - `public/views/` — combat section becomes 3-slot grid + special attacks
     list + reactions list.
   - `public/renderers/` — render derived per-slot blocks read-only.
   - `public/state.mjs` if it references old `combat.weapons` shape.
   - On creation form, default slot 2 to `natural_weapon`.
5. Wipe `data/characters/*.json` and `data/index.json` (user authorized).
6. Regenerate test fixtures in `test/helpers/fixtures.mts` for new shape.
7. Update affected tests (storage, validation, sanitization, schema-serializer,
   data-contracts, sse, api). Expect significant churn.
8. Update repo memory (`character-builder.md`) with new shape.

**Verification**

1. `npm test` green after full rewrite of fixtures.
2. `npm run start:dev` — create a character via UI, see 3-slot combat block
   with slot 2 pre-filled, empty special attacks + reactions lists.
3. Round-trip through SSE preserves shape.
4. Reject 400 on input that tries to set `combat.carried[i].bonusDamage`,
   `specialAttacks`, `reactions`, or null slot 2.

---

## Chunk E — Combat Phase: Per-Slot Fanout + Predicates

Make the engine actually use weapon predicates. Synthetic test data only;
real reference data comes in Chunk F.

**Steps**

1. Implement `deriveCombatSlots(char, registry, effects)`:
   - For each non-empty slot in `combat.carried`:
     - Resolve weapon from `equipment.weapons[weaponIndex]`.
     - Build slot's local effect set: filter combat-targeted effects by
       `appliesTo(weapon)` (default match). Predicate matching is exhaustive
       switch on `kind`.
     - Run `setBase` → `addFlat` → `multiply` → `cap` against the slot's
       fields (`attackAttribute`, `baseDamage`, `bonusDamage`,
       `qualities`, `flags`).
     - Apply weapon-mounted effects (from `weapon.effects`) into the same
       slot pipeline.
   - Slot defaults: `attackAttribute = "accurate"` (use `??` not `||`).
     Closes Bug #23.
2. Implement `applyEquipmentBonuses` rewrite for per-slot model.
3. Wire `deriveCombatSlots` into `derived.mts` after global phases.
4. Add `test/rules/combat.test.mts`:
   - Predicate matching by type / quality / id (each kind).
   - Predicate AND composition.
   - Multi-slot independence (Behemoth on slot 0 doesn't affect slot 1).
   - Empty slot handling (slot 0/1 may be null; slot 2 always present).
   - Slot 2 own-quality enforcement.
   - Negative `addFlat` (Axe Patterns adept) and negative `cap`.
   - `addFlat` accumulates across multiple effects.

**Closes weak-point bugs**: #7, #8, #9, #23.

**Verification**

1. `npm test` green; combat tests cover all predicate kinds.
2. With synthetic Behemoth + Polearm + Marksmanship effects, each slot
   computes independent `bonusDamage` and `attackAttribute`.

---

## Chunk F — Effect Normalization (Data)

Pure data work. User-owned bulk edit pass over all reference files,
guided by an authoring spec produced by Copilot up-front. No per-batch
back-and-forth.

**Workflow**

1. **Authoring spec** (Copilot, written once before F starts; lives at
   `docs/authoring-effects.md` or as a section of `data-contracts.md`):
   - Canonical JSON shape for an ability/spell/boon/sin/ritual entry
     (root, tiers, `effects[]`, `specialAttacks[]`, `reactions[]`).
   - Every `EffectTarget` kind with a real example.
   - Every `WeaponPredicate` kind with a real example.
   - Every `EffectModifier` verb (`setBase`, `addFlat`, `multiply`, `cap`,
     `remove`) with a real example.
   - Tier-stacking convention (only new effects per tier).
   - The trigger enum (current draft from Chunk A).
   - Worked Tier-A examples for: flat secondary bonus, weapon-conditional
     bonus, formula override, weapon-quality grant, armor-quality removal,
     special-attack promotion, reaction promotion, spell tier with
     `attackAttribute`/`damage`/`trigger`.
   - Explicit "do not encode" list: character-state conditions (rage,
     no-armor, low-health), per-encounter resource counts, action economy.
     Those stay Tier C narrative; sibling apps handle them.
2. **Bulk edit** (user, over multiple sessions/days): apply the spec to all
   `reference/*.{en,ru}.json` files. Mirror `.en` and `.ru` structurally
   (translations differ, schema identical). No Copilot in the loop.
3. **Validation** (handled by Chunk G's deserializer + lint tests once F
   is done — see G).

**Verification** (deferred to Chunk G; F itself has no test step beyond
"JSON parses"):

1. All reference JSON files parse as valid JSON.
2. (See Chunk G for semantic validation.)

---

## Chunk G — Wire Ability/Spell Registry into Recalc

**Steps**

1. Create `src/rules/registry.mts`:
   - Loads `reference/abilities.{locale}.json` and
     `reference/spells.{locale}.json` at startup.
   - `lookup(id, tier): { effects: ResolvedEffect[]; specialAttacks:
     SpecialAttack[]; reactions: Reaction[] }` — flattens tiers up to and
     including the requested one (additive stacking).
   - Validates target shapes, predicate shapes, modifier verbs, and trigger
     values via `deserializeTarget` / `deserializeAction` per ADR-011
     amendment; fails fast on bad data.
2. Update `collectAllEffects` to walk `character.traits[]`, call registry,
   merge `effects[]`. Same for spells stored on character.
3. Update `derived.mts` to also collect `specialAttacks` and `reactions`
   from registry and write to `character.specialAttacks` /
   `character.reactions`.
4. Remove any remaining `traits[].effects[]` inline-effect resolution code.
5. Add `test/rules/registry.test.mts`:
   - Load real reference data; assert non-empty.
   - Lookup known abilities; assert effect shapes and tier stacking.
   - Bad target shape → throws at load time.
6. Add `test/rules/reference-lint.test.mts` (the F validation pass):
   - Iterates **every** ability/spell/boon/sin/ritual entry across all
     locales.
   - Asserts: each effect parses; each predicate parses; each modifier verb
     is known; each trigger value is in the enum; each `appliesTo` weapon
     id/type/quality/subtype actually exists in `reference/weapons.*.json`;
     each ability/spell id is unique within its file; `.en` and `.ru`
     structures match (same set of ids, same tier counts, same
     `effects.length` per tier).
   - Reports **all** anomalies in one run (don't bail on first failure).
7. End-to-end test: character with Behemoth (master, slot 0 = heavy weapon),
   Polearm (novice, slot 0 = polearm — different character), Marksmanship
   (slot 1 = ranged) → assert slot fields, `specialAttacks`, and `reactions`.

**Verification**

1. `npm test` green — including the reference-lint pass over real data.
2. Manual: create character, add traits via UI, see derived combat values,
   special attacks, and reactions reflect them.

---

## Chunk H — Validators, Sibling Docs, Cleanup

**Steps**

1. Implement real `rpgValidators` (currently all return `true`):
   - Attribute budget validation.
   - Health range.
   - Slot count + slot 2 own-quality + non-null (already in D, formalize here).
   - Weapon ref validity (id exists in reference).
   - Trait/spell ref validity.
2. Update `docs/data-contracts.md` with final `EffectTarget`,
   `WeaponPredicate`, `SpecialAttack` vocabulary.
3. Update `docs/deferred-tasks.md` — mark §1, §3 done; remove obsolete items.
4. Update `.github/bugs/engine-weak-points.md` — mark #1, #2, #4, #5, #6,
   #7, #8, #9, #18, #19, #20, #21, #22, #23 resolved with date and chunk
   reference.
5. Update sibling integration docs:
   - `docs/addon-integration.md` — 3-slot model, special attacks, no `active`,
     `appliesTo` predicate semantics, weapon swap is sibling-side concern.
   - `docs/bot-integration.md` — same.
6. Update `docs/roadmap.md` Phase 6 — replace Step 0/5 with reference to
   chunks A–H; mark completed.
7. Update repo memory (`character-builder.md`, `nagara-rpg-rules.md`).

**Verification**

1. `npm test` green with real validators.
2. Validator rejects: over-budget attributes, slot 2 with non-`own` weapon,
   null slot 2, trait referencing nonexistent ability id.
3. Docs reviewed; no stale references to `combat.active`,
   `combat.bonusDamage: number[]`, dotted-path effect targets, or
   `add`/`mul`/`set` modifier verbs.

---

## Cross-Cutting Notes

- **Character-state conditions stay out of the engine**: "when raging",
  "when wearing no armor" (`equipment.armor.body` empty), "when at low
  health", "when prone", etc., are **not** modeled as `EffectTarget`s. They
  remain Tier C narrative; sibling apps gate them at roll time. The engine
  only handles permanent traits + weapon-conditional effects (via
  `WeaponPredicate`). This honestly addresses bug #12 by scoping it out
  rather than half-implementing a condition evaluator.
- **Soldier-adept (`hampering_N` removal)**: handled by `armorQuality`
  target. Concrete shape decided during Chunk A when armor type refactor
  semantics are finalized. Engine applies it; sibling apps see the result.
- **Soldier-novice (+1 protection step)**: simplified to
  `{ target: { kind: "secondary", stat: "armor" }, modifier: { type:
  "addFlat", value: 2 } }`.
- **Tier stacking**: registry's `lookup(id, tier)` returns effects from
  the requested tier AND all lower tiers (additive). `collectAllEffects`
  doesn't need to know about tier order — registry flattens it.
- **Berserk-novice Defense cap**: re-tiered as Tier C narrative — rage
  is a temporary toggle; sibling apps apply the cap when rage is active.
  This eliminates the only effect-cancellation case in the catalog.
- **Axe Patterns-adept negative bonus**: regular `addFlat` with
  `value: -2`. Engine math treats it identically to positive.
- **Slot 2 is required** to be non-null. On character creation, the client
  (or server, as a safety net) defaults it to `natural_weapon`. Validator
  rejects null slot 2 and rejects slot 2 weapon without `own` quality.
- **`equipment.weapons[]` capacity**: unchanged — array of any length;
  `combat.carried` references three of them (or null for slots 0/1).
- **Effect `priority`**: removed — phase ordering replaces it. If reference
  data has `priority` it's ignored.
- **Trigger enum is opaque to the engine**: engine validates only that a
  trigger value belongs to the known enum. It runs no per-trigger logic.
  Sibling apps decide what each trigger means at gameplay time. Adding a
  new trigger value is a one-line enum change + a doc update.

## Recommended Order

A → B can proceed in parallel (A is docs, B is code/move).
C blocks on A.
D blocks on C.
E blocks on D.
G blocks on E (uses real registry).
F blocks on A's authoring spec; runs as a long user-owned bulk edit.
G's reference-lint test (G step 6) blocks on F being complete.
H blocks on G.

Suggested execution: A → B → C → D → E → G (registry + tests landing first;
lint-over-real-data turned on once F finishes) → H. F runs independently in
user time after A ships.
