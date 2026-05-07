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

| Chunk | Focus | Code | Data | Tests | Docs | Status |
|-------|-------|------|------|-------|------|--------|
| A | Decisions, vocabulary lock & armor refactor | — | small | — | ADRs | ✅ Done (2026-04-22) |
| B | Reference catalog relocation (`data/` → `reference/`) | medium | move | medium | medium | ✅ Done |
| C | Typed pipeline foundation (no combat fanout) | large | — | large | — | ✅ Done |
| D | Schema migration: `Combat` + `specialAttacks` | large | wipe chars | large | small | ✅ Done (2026-04-25) |
| E | Combat phase per-slot fanout + predicates | medium | — | medium | — | ✅ Done |
| F | Effect normalization (data, collaborative) | — | huge | — | — | ⏳ Not started |
| G | Wire ability/spell registry into recalc | small | — | medium | — | ⏳ Not started |
| H | Validators, sibling docs, cleanup | medium | — | medium | large | ⏳ Not started |

---

## Chunk A — Decisions, Vocabulary Lock & Armor Refactor

> **✅ Completed 2026-04-22.** Final decisions diverged from the original
> outline below in two ways:
>
> - The armor `type` field refactor was **reverted**. Negative quality stays
>   as a single literal `"hampering"` (no `_N` suffix); magnitude is implicit
>   in the armor's `armor` value. No engine code reads armor type, so the
>   refactor offered no payoff. See ADR-014 / ADR-015 for the locked shape.
> - ADR-011 was superseded by **[ADR-015](../../docs/decisions/015-typed-effect-targets-final.md)**
>   rather than amended (ADRs are immutable, mirroring how ADR-009 superseded
>   ADR-004). ADR-015 records the final 5-kind `EffectTarget` union, the
>   `WeaponPredicate` shape (no `subtype` kind), `EffectModifier` per-phase
>   shapes including `remove`, the dropped `priority` field, and the
>   `TriggerKind` draft.
> - The armor reference field formerly named `defense` is now `armor`
>   (matches `secondary.armor` semantics). A transition fallback in
>   `src/rules/attributes.mts` keeps existing characters loadable; it is
>   marked `TODO(phase6-chunk-D)` and dropped together with the character
>   wipe in Chunk D.
>
> Live deliverables: ADR-014, ADR-015, ADR-011 (status header updated),
> `data/armor.{en,ru}.json` rewritten, `docs/data-contracts.md` §1.1 rewritten,
> `docs/deferred-tasks.md` refreshed, `.github/bugs/engine-weak-points.md`
> re-linked to chunks. 445 / 445 tests + typecheck green.

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

> **✅ Completed 2026-04-23.** Outcome diverged from the original outline in
> three ways:
>
> - The locale-less `abilities.json` reconciliation in step 3 turned out to
>   be moot: `src/models/abilities.mts` had been reading a non-existent
>   `data/abilities.json` (only the `.en/.ru` variants ever existed on
>   disk). The whole module was deleted and replaced with a generic
>   `src/models/reference.mts` loader covering all seven topics.
> - **Reference data is no longer served as static files.** The decision
>   in step 5 went the other way: `reference/` is exposed only through the
>   API, never via the static handler. This let us move locale resolution
>   and the abilities+spells / boons+sins merging entirely to the server.
> - The original single endpoint `GET /api/v1/abilities` was dropped (now
>   404) in favor of five locale-aware endpoints matching the character
>   schema's field names: `/api/v1/traits` (merged abilities+spells with
>   `source: "ability" | "spell"`), `/api/v1/talents` (merged boons+sins
>   with `source: "boon" | "sin"`), `/api/v1/rituals`, `/api/v1/weapons`,
>   `/api/v1/armor`. Locale resolution: `?locale=` query → first matching
>   primary subtag in `Accept-Language` → `en` default; supported set is
>   hard-coded as `["en", "ru"]`; unknown locale returns 400.
>
> Live deliverables:
>
> - **Code:** `src/lib/config.mts` exports `REFERENCE_DIR`, `LOCALES`,
>   `DEFAULT_LOCALE`, `Locale`. New `src/lib/locale.mts` (`parseLocale`).
>   New `src/models/reference.mts` with mtime-cached `getTopic` /
>   `getMerged`, asserts id-uniqueness across merge components and names
>   both source files in the error. New `src/routes/handleGetReference.mts`
>   factory exposing the five handlers. Old `src/models/abilities.mts` and
>   `src/routes/handleGetAbilities.mts` deleted. `src/app.mts` rewires the
>   five paths and falls through to 404 for `/api/v1/abilities`.
> - **Data:** 14 reference JSON files moved with `git mv` (history
>   preserved). On disk the files stay split per topic + locale; the merge
>   for `traits`/`talents` is API-only. Sibling projects (Discord bot, WoW
>   addon) read split files directly from disk.
> - **Client:** `public/components/trait-list.mjs` now fetches
>   `/api/v1/traits?locale=…` (locale derived from `navigator.language`).
>   `public/api.mjs` `getAbilities()` (currently unused) updated to hit
>   `/traits`.
> - **Tests:** new `test/locale.test.mts` (9 tests) and
>   `test/reference.test.mts` (4 tests covering cache hit, mtime
>   invalidation, `source` stamping, duplicate-id error). `test/api.test.mts`
>   replaces the old abilities block with three new blocks covering
>   `/traits` (5 tests including Cache-Control, locale=fr → 400,
>   Accept-Language honoured, default fallback), `/talents` (sources
>   stamped), and `/abilities` (404). `test/helpers/{temp-dir,http}.mts`
>   gained a `referenceDir` and seed all seven topics × two locales. The
>   three `mock.module("#config")` sites in api/storage/character-service
>   tests gained `REFERENCE_DIR`/`LOCALES`/`DEFAULT_LOCALE`. Final count:
>   464 / 464 tests + typecheck green.
> - **Docs:** updated `docs/architecture.md` (endpoint table + reference
>   note), `docs/bot-integration.md` (`data/` → `reference/` table; API
>   marked website-internal), `docs/addon-integration.md` §7 (replaced
>   `/api/v1/abilities` with the five new endpoints, documented locale
>   resolution), `docs/data-contracts.md` and `docs/deferred-tasks.md`
>   (path updates), `README.md`, `.github/bugs/engine-weak-points.md`,
>   and `.github/copilot-instructions.md` (URL→fs table now notes
>   `reference/` is API-only; `reference/` listed as a top-level project
>   directory).
> - **Memory:** new repo memory `/memories/repo/reference-catalog.md`
>   capturing the relocation, endpoint surface, locale policy, and
>   sibling-project expectations.

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

> **Status: complete.** Storage was wiped at chunk start (no `schemaVersion`
> bump; on-disk shape change deferred to D). Engine rewritten end-to-end
> against typed `Character` state and the ADR-015 effect vocabulary.
> `RawEffect` retained as the deprecated wire shape; only `effects.mts`
> knows about it (deletion in H). Combat fanout, weapon predicates, talents
> collection, and equipment effects are all stubbed/deferred per the plan.
> All 472 tests pass; typecheck clean.
>
> **Deliverables**
> - ADR-015 type vocabulary in `src/rpg-types.mts` (`EffectTarget` 5-kind
>   union, `WeaponPredicate`, `EffectModifier` discriminated union with
>   `remove`, `EffectFlag`, `SecondaryAttributeName`, `CombatSlotField`,
>   `EffectPhase`, `ResolvedEffect`, `TriggerKind`, `Action`,
>   `SpecialAttack`, `Reaction`, `CombatSlot`, new 3-slot `Combat`).
> - New `src/rules/registry-types.mts` (`Registry` interface) plus banner
>   stub `src/rules/registry.mts` (real loader is Chunk G).
> - Rewritten `src/rules/effects.mts`: `normalizeRawEffect`,
>   `collectAllEffects` (traits + `character.effects[]` only), `groupByPhase`.
> - Rewritten `src/rules/attributes.mts` (typed `SECONDARY_FORMULAS`,
>   typed `clampValues` — sole toughness clamp site).
> - Rewritten `src/rules/applicator.mts` (phase-keyed handlers, exhaustive
>   `target.kind` switch, `applyWeaponQuality` stub).
> - Rewritten `src/rules/derived.mts` (`recalculate(char, registry)` with
>   total phase order; stubbed `deriveCombat` synthesizes
>   `natural_weapon` slot 2; `enforceConsistency` trimmed to XP guard +
>   equipment defaulting).
> - `src/app.mts` wires an inline `emptyRegistry` stub into
>   `initCharacterService` with `TODO(phase6-chunk-G)`.
> - Test helpers: `test/helpers/registry.mts` (`createInMemoryRegistry`,
>   `emptyRegistry`); `test/helpers/fixtures.mts` split into legacy
>   `makeCharacter` (schema-conformant, for storage/api/validation tests)
>   and `makeTypedCharacter` (typed `Character` for engine tests).
> - New `test/rules/effects.test.mts`; rewritten
>   `test/rules/{attributes,applicator,derived}.test.mts`.
>
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
   merge, nested unwinding, ignores `duration` on legacy input).

**Closes weak-point bugs**: #1, #2, #4, #5 (partial), #6, #18, #19, #20, #21,
#22.

**Verification**

1. `npm run typecheck` clean — no `Record<string, unknown>` in `src/rules/`.
2. `npm test` green; new + migrated rules tests pass.
3. Existing characters still load; secondary attributes correct.
4. Combat fields unchanged from pre-chunk values (combat phase still stub).

---

## Chunk D — Schema Migration: `Combat` + `SpecialAttack[]`

**Status:** ✅ Complete (471/471 tests passing). Schema collapsed to
`combat: { carried }`, schemaVersion bumped 1 → 2, derived per-slot inner
fields + top-level `flags`/`specialAttacks`/`reactions` are pure recalc
output (no schema entry, sanitizer denylist lets them through), client
`weapon-slots` renderer wired in, `data/` wiped.

**Divergences from the original outline**

- **Step 1 — derived fields stay out of the schema.** The plan called for
  per-slot `attackAttribute`/`baseDamage`/`bonusDamage`/`qualities`/`flags`
  and the new `specialAttacks` / `reactions` collections to live in the
  schema as read-only entries. We kept them out entirely: the schema only
  describes `combat.carried[i].weaponIndex`. Derived fields ride through
  the SSE/serializer because the sanitizer is a denylist (passes unknown
  fields), and validators reject any client input that tries to set them
  via the same denylist mechanism. Result: one source of truth (rules
  engine) instead of two (schema + engine), and authoring new derived
  fields stays a one-line change in `src/rules/`.
- **Step 4 — client widget is a placeholder.** The `weapon-slots`
  component override renders the 3-slot grid and the SSE round-trip works,
  but the `<select>` elements have only `data-slot` (no `name`), so the
  creation form serializer skips them and the server fills `combat.carried`
  + `equipment.weapons[0]` from schema `default` values instead. Edit-in-
  view PATCHes the tuple explicitly. A proper clickable-card widget plus a
  creation/view parity pass are logged in [`docs/roadmap.md`](../../docs/roadmap.md)
  Phase 8.
- **Step 7 — kept the two-factory split.** `makeCharacter` (input/PATCH-
  body shape) and `makeTypedCharacter` (post-recalc `Character`) did NOT
  collapse. Engine unit tests in `test/rules/*` need the recalc-output
  shape; storage / api / validation / sanitization tests need the input
  shape (otherwise derived fields trip the denylist). Building one fixture
  on top of the other keeps the duplication minimal. Both are documented
  with explicit "input" / "post-recalc" JSDocs.
- **Bonus — slot naming convention codified.** index 0 = main-hand,
  index 1 = off-hand, index 2 = own. Pinned in JSDoc on
  [`src/rpg-types.mts`](../../src/rpg-types.mts) `Combat`, in the ADR-014
  bullet of [`copilot-instructions.md`](../copilot-instructions.md), and in
  the `weapon-slots` component labels. The numeric tuple is treated as an
  implementation detail.
- **Bonus — schema-default audit logged.** `equipment.weapons` schema
  default inlines a stripped-down `natural_weapon` entry (damage 0, only
  `own` quality) instead of reusing the canonical entry from
  `reference/weapons.en.json` (damage 4, `[own, short]`). Fix logged in
  Chunk F's "F-side audit: schema defaults that hard-code reference data"
  subsection.

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
6. Drop the legacy-armor transition fallback. Remove the `body?.defense ??`
   branch in `src/rules/attributes.mts` `armor.base()` (search
   `TODO(phase6-chunk-D)`) and the matching test case in
   `test/rules/attributes.test.mts`. After the wipe in step 5 nothing on
   disk carries the old `defense` key.
7. Regenerate test fixtures in `test/helpers/fixtures.mts` for new shape.
   The Chunk-C transitional split (`makeCharacter` legacy /
   `makeTypedCharacter` typed) collapses back into a **single** typed
   `makeCharacter(): Character` factory. Delete `makeTypedCharacter` and
   migrate the engine tests (`test/rules/*.test.mts`) over. The two
   factories exist only because the on-disk schema (asserted by
   storage/api/validation/sanitization tests) still carries the legacy
   `combat.weapons` shape and lacks `flags` / `specialAttacks` /
   `reactions`; once steps 1–3 land they converge.
8. Tighten `RecalcFn` in `src/models/index.mts` (search
   `TODO(phase6-chunk-D)`) from `(c: Record<string, unknown>) =>
   Record<string, unknown>` to `(c: Character) => Character`. Drop the
   `as unknown as Character` adapter cast in `src/app.mts`. Threads
   typed `Character` end-to-end through the mutation gate, completing
   Chunk C step 6 of the original plan.
9. Update affected tests (storage, validation, sanitization, schema-serializer,
   data-contracts, sse, api). Expect significant churn.
10. Update repo memory (`character-builder.md`) with new shape.

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

> **✅ Completed 2026-04-25.** 498 / 498 tests + typecheck green. Outcome
> tracked deviations from the original outline:
>
> - **E.0.5 snapshot test was a partial mitigation, not a resolution.**
>   The F-side audit (three sources of truth for `natural_weapon`)
>   remains open — the test only locks the schema default against
>   *self*-drift, and Chunk E.1 introduced a third copy as the
>   `NATURAL_WEAPON` constant in `src/rules/derived.mts` (defensive
>   fallback when no `own` weapon is present). Audit note in this
>   plan was updated mid-session to reflect this; final unification
>   moved to **Chunk H step 8** (registry-driven `{ ref: ... }`
>   default once Chunk G's registry exists).
> - **Bug #31 partially closed.** Top-level `character.flags` and
>   per-slot `flags` reset between recalcs is fixed; the
>   `armor.body`/`plug` overlay-qualities reset is still deferred to
>   Chunk G or H (commented in `recalculate`).
> - **Combat tests landed at 26 cases, not the planned ~16** — the
>   per-slot/predicate matrix expanded once `weapon.effects[]` scoping
>   and per-slot `flags` reset got their own regression coverage.
> - **End-of-session architectural review surfaced two follow-on
>   refactors** that gate Chunk F: locale-merged reference files and
>   a quality registry. Captured in the new
>   [phase6-chunkF-prereqs-plan.md](phase6-chunkF-prereqs-plan.md);
>   inserted as **Chunk F.0** above the Chunk F header.
> - **End-of-session UI gap surfaced.** The `weapon-slots` widget is
>   wired but the catalog-fed pickers (`equipment-list`, `armor-slot`,
>   trait/talent/ritual/tradition/effect lists) remain stubs, so a
>   freshly-created character has no way to populate
>   `equipment.weapons[]` from the catalog. Captured as the new
>   **Chunk I — Catalog-Driven Client Pickers**, sequenced after H.
>
> Live deliverables:
>
> - **Code (engine):** `src/rules/derived.mts` `deriveCombatSlots`
>   replaces the Chunk-C stub (per-slot reset + filter + apply +
>   `weapon.effects[]` scoped to the carrying slot, with a defensive
>   `NATURAL_WEAPON` synth when `combat.carried[2]` cannot resolve an
>   `own` weapon). New `src/rules/predicates.mts` with
>   `matchesPredicates` (AND across predicates, OR within `values[]`,
>   match-all on undefined / `any`). `src/rules/applicator.mts`
>   `applyWeaponQuality` de-stubbed (mirror of `applyArmorQuality`).
>   `src/rules/effects.mts` `collectAllEffects` walks
>   `equipment.armor.body?.effects` / `plug?.effects` globally (typed
>   `ResolvedEffect[]` pass-through); weapon effects deliberately not
>   collected globally. `recalculate` resets `result.flags = []`
>   before the phase pipeline and wires `deriveCombatSlots` after
>   global non-combat phases, before `enforceConsistency`.
> - **Code (E.0 prep):** ADR-015 §3a / §3b appended.
>   `src/rpg-types.mts` `Weapon` and `ArmorPiece` crystallized
>   (required fields locked; `subtype` and open index signature
>   removed; `effects?: ResolvedEffect[]` end-to-end).
>   `src/models/character.mts` `equipment.weapons.default[0]` carries
>   `id: "natural_weapon"`. `src/rules/effects.mts` `parseTarget` /
>   `parseModifier` shrunk `CombatSlotField` to `attackAttribute |
>   baseDamage | bonusDamage`; rejects non-`setBase` on
>   `combat.attackAttribute` and `setBase` on other combat fields.
> - **Tests:** new `test/rules/combat.test.mts` (26 cases covering
>   predicate kinds, AND/OR composition, multi-slot independence,
>   slot-2 own-quality, negative `addFlat`/`cap`, `addFlat`
>   accumulation, `attackAttribute setBase`, parse-time rejection of
>   `attackAttribute` arithmetic / `remove`, `weaponQuality` and
>   `armorQuality` add/remove, Bug #31 regression for both top-level
>   and per-slot `flags`, armor `effects[]` global collection,
>   `weapon.effects[]` per-slot scoping). Snapshot invariant test
>   added in `test/validation.test.mts` for the schema default.
>   Fixtures in `test/helpers/fixtures.mts` updated with `id` field.
> - **Plan / bugs:** `.github/bugs/engine-weak-points.md` closed #7,
>   #9 (#8 was already resolved earlier), #23, and #31 (with armor
>   overlay caveat). New gate plan
>   `phase6-chunkF-prereqs-plan.md`. New Chunk I authored. F-side
>   audit note rewritten + Chunk H step 8 added to drive final
>   resolution.
> - **Memory:** repo memory `/memories/repo/character-builder-chunk-e.md`
>   captures crystallized `Weapon` / `ArmorPiece` shape, shrunk
>   `CombatSlotField`, the three-copies debt, and the per-slot
>   pipeline conventions.

**Phase E.0 — Prep (docs + interfaces, no engine work)**

1. **ADR-015 §3a** — record the set-membership authoring convention:
   `addFlat: 1` to add, `remove` to remove, applicator ignores the
   numeric value of `addFlat` for `weaponQuality` / `armorQuality` /
   `flag` targets. Keeps the modifier union narrow without a separate
   `add` verb.
2. **ADR-015 §3b** — record that `combat.attackAttribute` accepts only
   `setBase`. Arithmetic on attack attribute is rejected by the runtime
   parser (`src/rules/effects.mts`) and the registry deserializer.
3. **Crystallize `Weapon` and `ArmorPiece`** in `src/rpg-types.mts`:
   required fields (`id`, `name`, `type`/`armor`, `damage`/—,
   `qualities`); optional `effects?: ResolvedEffect[]`, `cost?`. Drop
   `subtype` from `Weapon` and the open `[key: string]: unknown`
   index signature from `ArmorPiece`. `effects` is `ResolvedEffect[]`
   end-to-end (reference data feeds it through the registry
   deserializer in G; equipment never produces `RawEffect`).
4. **Schema default** in `src/models/character.mts`: add
   `id: "natural_weapon"` to `equipment.weapons.default[0]`. Damage
   stays 0; the catalog reconciliation (catalog has damage 4, qualities
   `[own, short]`) is intentionally deferred to Chunk F.
5. **Snapshot invariant test** (in `test/validation.test.mts`'s
   `generateDefaultCharacter` block): assert
   `equipment.weapons[0]` deep-equals the hardcoded snapshot. Resolves
   the F-side audit (option 2 — schema default + snapshot test).
6. **Fixtures** in `test/helpers/fixtures.mts`: weapon factories add
   the `id` field.
7. **Tighten `parseTarget` / `parseModifier`** in
   `src/rules/effects.mts`: shrink `CombatSlotField` to
   `attackAttribute | baseDamage | bonusDamage` (drop `qualities` and
   `flags`); reject non-`setBase` modifiers on
   `combat.attackAttribute`; reject `setBase` on other combat fields.
   Per-slot `qualities` / `flags` mutation flows through `weaponQuality`
   / `flag` targets with `appliesTo` narrowing.

**Phase E.1 — Per-slot combat fanout (engine)**

1. In `src/rules/derived.mts` `recalculate`: reset `result.flags = []`
   before running the phase pipeline. Closes Bug #31 for top-level
   flags. (`armor.body` overlay reset deferred to G/H — comment.)
2. Implement `deriveCombatSlots(char, registry, effects)` replacing
   the Chunk-C `deriveCombat` stub:
   - For each non-null slot in `combat.carried`:
     - Resolve `weapon = equipment.weapons[slot.weaponIndex]`.
     - Reset derived per-slot state from the weapon:
       `qualities = [...weapon.qualities]`, `flags = []`,
       `attackAttribute = "accurate"` (use `??` not `||`,
       closes Bug #23), `baseDamage = weapon.damage`,
       `bonusDamage = 0`.
     - Filter combat-targeted effects by `matchesPredicates(weapon,
       effect.appliesTo)` (default empty / `any` = match).
     - Run phases against the slot's numeric fields:
       `setBase` (attackAttribute only) → `addFlat` → `multiply` →
       `cap`. `flag`-phase effects with `weaponQuality` / `flag`
       targets mutate slot membership when their `appliesTo` matches.
     - Apply `weapon.effects[]` into the same slot pipeline with an
       implicit `appliesTo = this weapon` (no need to author).
   - Drop the Chunk-C "preserve old slot if well-formed" path: derived
     fields are now recomputed from scratch every recalc.
3. Implement `matchesPredicates(weapon, predicates)` in
   `src/rules/applicator.mts` (or new `predicates.mts`). Exhaustive
   switch on `kind`. Multiple predicates AND-compose; `values[]`
   within one predicate OR-compose. `undefined` / `[]` means match-all.
4. De-stub `applyWeaponQuality` (per-slot, same add/remove semantics
   as `applyArmorQuality`). Driven by `deriveCombatSlots`'s per-slot
   filter, not the global flag phase.
5. In `src/rules/effects.mts` `collectAllEffects`: walk
   `equipment.armor.body?.effects` and `equipment.armor.plug?.effects`
   (typed `ResolvedEffect[]` pass-through, no normalization).
   Weapon effects are NOT collected globally — they enter per-slot
   in step 2.
6. Wire `deriveCombatSlots` into `recalculate` after the global
   non-combat phases and before `enforceConsistency`.
7. Add `test/rules/combat.test.mts` (~16 cases):
   - Predicate kinds (`any`, `id`, `type`, `quality`).
   - AND / OR composition.
   - Multi-slot independence (Behemoth on slot 0 doesn't affect slot 1).
   - Empty slot handling (slots 0 / 1 may be null; slot 2 always
     present).
   - Slot 2 own-quality enforcement.
   - Negative `addFlat` (Axe Patterns adept) and negative `cap`.
   - `addFlat` accumulation across multiple effects.
   - `attackAttribute` `setBase` overrides default.
   - `attackAttribute` arithmetic / `remove` rejected at parse time.
   - `weaponQuality` add and remove per slot.
   - `armorQuality` add/remove on body and plug.
   - Bug #31 regression: top-level `character.flags` and per-slot
     `flags` reset between recalcs.
   - Armor `effects[]` collected globally (no-op smoke test).
   - `weapon.effects[]` scoped to the carrying slot only.

**Phase E.2 — End-of-chunk**

1. Update `.github/bugs/engine-weak-points.md`: close #7, #8, #9, #23;
   close #31 (slot side + top-level `character.flags`; armor body
   overlay caveat noted, deferred to G/H).
2. Update `/memories/repo/character-builder.md` repo memory with
   the crystallized `Weapon` / `ArmorPiece` shape and shrunk
   `CombatSlotField`.

**Verification**

1. `npm test` green; combat tests cover all predicate kinds.
2. With synthetic Behemoth + Polearm + Marksmanship effects, each slot
   computes independent `bonusDamage` and `attackAttribute`.

---

## Chunk F.0 — Prerequisite: Reference Layout Refactor (GATE)

> **Blocks Chunk F.** Two structural reference-data refactors must land
> first so the bulk authoring pass operates on the final shape from edit
> one (otherwise every reference file gets re-touched twice). Tracked in
> its own plan:
>
> - **[phase6-chunkF-prereqs-plan.md](phase6-chunkF-prereqs-plan.md)**
>   - **Task 1 — Single-file locale merge.** Collapse
>     `<topic>.{en,ru}.json` pairs into one `<topic>.json` per topic with
>     embedded `LocalizedString` nodes; loader projects to the requested
>     locale at read time. Eliminates silent en/ru mechanical drift.
>     New ADR-016.
>   - **Task 2 — Quality registry.** Introduce
>     `reference/qualities.json` mapping each quality id to its
>     localized name + canonical effects. `weapon.effects[]` /
>     `armor.effects[]` become rare (bespoke-only); engine fans out
>     quality effects with the same implicit `appliesTo` scoping as
>     Chunk E. New ADR-017.
>
> Sub-sequence is F.0a–F.0g. Once F.0g lands the gate opens.

---

## Chunk F — Effect Normalization (Data)

Pure data work. User-owned bulk edit pass over all reference files,
guided by an authoring spec produced by Copilot up-front. No per-batch
back-and-forth.

> **Authoring spec is live:**
> [`docs/authoring-effects.md`](../../docs/authoring-effects.md). Lock-in
> decisions captured in §1–§9; deferred items tracked in §10.
>
> **Deferred to a follow-up after Chunk F (do not lose):**
>
> - **`SpecialAttack` / `Reaction` wire shape on tier objects** —
>   bulk pass leaves these as Tier C narrative `description` entries.
>   Back-fill happens after Chunk G wires the registry-side collection.
>   See [authoring-effects.md §10](../../docs/authoring-effects.md#L0).
> - **`EffectFlag` cleanup pass** — authors extend the union as they
>   go; consolidate near-duplicates after the bulk pass closes.
> - **Schema/engine amendments surfaced mid-authoring** — special-attack
>   inherit-by-default, `magicAttribute` derived field, armor-side
>   `appliesTo`, `initiativeAttribute` derived field. Captured in
>   [`phase6-chunkF-postpass-amendment.md`](./phase6-chunkF-postpass-amendment.md).

**Workflow**

1. **Authoring spec** — done. Live at
   [`docs/authoring-effects.md`](../../docs/authoring-effects.md). Lock
   decisions reflected: boons / sins / rituals stay flat (no per-rank
   `effects[]` — non-combat, engine doesn't consume them); weapons and
   armor get an optional `description`; no `tags` on weapons / armor /
   qualities; special attacks and reactions deferred (see callout above).
2. **Bulk edit** (user, over multiple sessions/days): apply the spec to all
   `reference/*.{en,ru}.json` files. Mirror `.en` and `.ru` structurally
   (translations differ, schema identical). No Copilot in the loop.
3. **Validation** (handled by Chunk G's deserializer + lint tests once F
   is done — see G).

**Verification** (deferred to Chunk G; F itself has no test step beyond
"JSON parses"):

1. All reference JSON files parse as valid JSON.
2. (See Chunk G for semantic validation.)

### Progress log (post-pass amendment items)

> Living index of items from
> [`phase6-chunkF-postpass-amendment.md`](./phase6-chunkF-postpass-amendment.md)
> (the staging file for Chunk-F-surfaced amendments) that have actually
> shipped. Each entry points back at the per-item `### Status` block in
> the staging file for the canonical record. Chunks G.1/G.2/… below pull
> from the same staging list as they're scheduled.

| Item | What                                                   | Shipped     | Notes |
| ---- | ------------------------------------------------------ | ----------- | ----- |
| 13   | Roll-time modifier passthrough (`flag` + `appliesTo`)  | 2026-05-06  | One-clause parser change; unblocks `precise` / `advantage` documentary pattern. |
| 10   | `EffectTarget.kind = "primary"` + `derivePrimaryAttributes` stage | 2026-05-06  | G1.A. Six-kind union, addFlat/cap accepted, others rejected. |
| 10*  | Follow-up: `attributes.primaryEffective` sibling field | 2026-05-07  | Engine writes effective snapshot to a server-controlled sibling field; base stays validated 5–15 and never mutates. Closes accumulating-drift / schema-violation regression. No schema-version bump. |
| 11   | `secondary.toughness` writes-to-`.max` regression tests | 2026-05-06  | G1.B. Engine behaviour was already correct; added 3 explicit tests + authoring-spec note. |

Items still on deck (in staging, not yet scheduled): 1, 2, 3, 4, 5, 6, 7, 8, 9, 12.

### F-side audit: schema defaults that hard-code reference data

> Marked during Chunk D wrap-up. Do not address until F+G land.
>
> **Status update (Chunk E.0.5):** a snapshot test in
> `test/validation.test.mts` now locks the schema default against silent
> *self*-drift (the default cannot be edited without updating the
> snapshot). This is a temporary lint, **not** a resolution — it does
> not unify the schema-default copy with the catalog copy, and it does
> not cover the **third** source of truth introduced during Chunk E.1:
> a `NATURAL_WEAPON` constant in `src/rules/derived.mts` that
> `deriveCombatSlots` synthesizes when no `own` weapon is present.
>
> So as of Chunk E there are three copies of `natural_weapon` (schema
> default, engine fallback, catalog) and they already disagree on
> `name` / `damage` / `qualities`. Address in Chunk H per the options
> below.

`src/models/character.mts` currently inlines a copy of the `natural_weapon`
object as `equipment.weapons.default` (and `combat.carried[2]` points at
index 0). The canonical record lives in `reference/weapons.en.json` under
`id: "natural_weapon"`. `src/rules/derived.mts` carries a third copy as a
defensive fallback. If any of the three drifts the others go stale silently.

Options to consider once the registry exists (Chunk G):

- Replace the inlined default(s) with a `{ ref: "natural_weapon" }`
  placeholder that `generateDefaultCharacter` resolves through the
  registry at creation time, and have `deriveCombatSlots` synthesize
  its fallback from the same registry lookup (single source of truth,
  locale-aware).
- Or keep the inlined defaults but add a startup invariant test that
  asserts `schema.equipment.weapons.default[0]`, the engine fallback
  constant, and the EN catalog entry all deep-equal each other. Cheap
  lint, no runtime coupling, breaks the build on drift.

Decide between those (or a third option) when F is done and the registry
shape is firm. Until then the three copies are accepted as a known debt.

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
   - **Precursor:** `scripts/audit-reference.mts` (added during the Chunk F
     authoring pass) is the informal version of this lint and was used to
     audit the catalog before amendments. Promote its checks into this
     test (most of the categorization translates 1:1 — tier markers,
     parser rejections, predicate hygiene, quality resolution, flag-name
     vocabulary). Delete the standalone script once the test absorbs it.
   - Iterates **every** ability/spell/boon/sin/ritual entry across all
     locales.
   - Asserts: each effect parses; each predicate parses; each modifier verb
     is known; each trigger value is in the enum; each `appliesTo` weapon
     id/type/quality/subtype actually exists in `reference/weapons.*.json`;
     each ability/spell id is unique within its file; `.en` and `.ru`
     structures match (same set of ids, same tier counts, same
     `effects.length` per tier).
   - **Quality registry-resolution validator (deferred from F.0):** for
     every weapon entry's `qualities[]` and every armor entry's
     `qualities[]`, assert each id resolves in
     `reference/qualities.<DEFAULT_LOCALE>.json`. For every effect
     across abilities/spells/talents whose `target.kind` is
     `weaponQuality` or `armorQuality`, assert `target.quality` resolves
     in the registry too. Same for `appliesTo` predicate `kind: "quality"`
     values. Closes the F.0e "runtime warn/throw only" gap.
   - **Slot-2 `own` registry sanity:** assert `reference/qualities.*.json`
     contains an `own` entry. The schema validator checks that slot-2
     weapons carry `"own"` in their `qualities[]`; this asserts the
     symmetric registry side. Tracks engine-weak-points.md #19.
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

0. Delete `RawEffect`, `normalizeRawEffect`, and the translator's
   warn paths from `src/rpg-types.mts` and `src/rules/effects.mts`.
   Reference data must be authored in the typed `ResolvedEffect` shape
   directly by this point (Chunks F + G ensure this); the legacy wire
   shape has no remaining producers. Equipment effects are already
   typed `ResolvedEffect[]` end-to-end (crystallized in Chunk E.0.3).
0a. *(Preempted by Chunk E.0.7.)* `"qualities"` and `"flags"` were
    dropped from `CombatSlotField` during Chunk E.0 prep — per-slot
    set-membership flows through `weaponQuality` / `flag` targets with
    `appliesTo` narrowing, not via a dedicated combat field. The
    `CombatSlot.flags` array remains as the engine's per-slot output
    surface (populated by `flag` effects whose `appliesTo` matches the
    slot's weapon).
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
   chunks A–I; mark completed.
7. Update repo memory (`character-builder.md`, `nagara-rpg-rules.md`).
8. **Resolve the F-side audit** (three copies of `natural_weapon`):
   pick one of the two options recorded under Chunk F. Recommended
   path is the `{ ref: ... }` registry-driven default — by this point
   the Chunk-G registry exists and `generateDefaultCharacter` can
   resolve refs at creation time, and `deriveCombatSlots` can
   synthesize its fallback from the same lookup. Drop the temporary
   E.0.5 snapshot test once unified.

**Verification**

1. `npm test` green with real validators.
2. Validator rejects: over-budget attributes, slot 2 with non-`own` weapon,
   null slot 2, trait referencing nonexistent ability id.
3. Docs reviewed; no stale references to `combat.active`,
   `combat.bonusDamage: number[]`, dotted-path effect targets, or
   `add`/`mul`/`set` modifier verbs.
4. Only one in-code definition of `natural_weapon` remains (the
   catalog entry); schema default and engine fallback both resolve
   through it.

---

## Chunk I — Catalog-Driven Client Pickers

> Closes the gap between "engine works" and "user can actually use it."
> Until this lands, the per-slot weapon dropdown is empty for any new
> character (only the seeded `natural_weapon` shows up, and only in
> the own slot), and there is no way to add traits, talents, rituals,
> spells, armor, or extra weapons through the UI.

**Context**

The schema-driven renderer registers seven catalog-fed components as
stubs in `public/renderers/component-registry.mjs`:

- `equipment-list` — `equipment.weapons`, `equipment.ammunition`
- `armor-slot` — `equipment.armor.body`, `equipment.armor.plug`
- `trait-list` — `traits[]` (currently renders read-only; needs picker)
- `talent-list` — `talents[]` (same)
- `ritual-list` — `rituals[]`
- `tradition-list` — `traditions[]`
- `effect-list` — `effects[]` (DM/admin only — manual effect injection)
- `affiliation-list`, `notes-list` — non-catalog, plain editors

Each catalog-fed component needs to: (a) fetch the relevant
`/api/v1/{traits,talents,rituals,weapons,armor}` endpoint on mount;
(b) render an add/remove UI (typically a `<select>` of catalog
entries plus a list of current selections); (c) PATCH the resulting
array back through the existing API. The shape the client sends is
already validated server-side by Chunk H's `rpgValidators` (e.g.
weapon-ref validity, trait-ref validity).

**Steps**

1. **Authoring spec for client pickers** (`docs/client-pickers.md`):
   - For each of the seven components: which `/api/v1/*` endpoint
     it consumes, the shape of catalog entries it renders, the
     PATCH body shape it emits, the validation it relies on.
   - Locale handling: pickers honor the user's locale via the same
     `?locale=` query the existing `weapon-slots` already uses
     implicitly through pre-loaded `equipment.weapons[]`.
   - Permission model: read-only when the schema field's permissions
     reject the current role (mirrors existing `weapon-slots`).
2. **Implement `equipment-list`** (highest priority — unblocks the
   per-slot picker). Adds/removes weapons by id; PATCH replaces the
   whole `equipment.weapons[]` array. Special handling: cannot
   remove an entry currently referenced by `combat.carried`; cannot
   remove the seeded `natural_weapon` (or auto-replace with another
   `own` weapon).
3. **Implement `armor-slot`** for `body` and `plug`. Single-select;
   PATCH replaces the slot object. `null` clears the slot.
4. **Implement `trait-list` / `talent-list` pickers** (the existing
   `renderTraitList` / `renderTalentList` are display-only — extend
   with add/remove). Each entry stores `{ id, tier }`; tier picker
   surfaced inline.
5. **Implement `ritual-list` / `tradition-list`**. Add/remove by id;
   array of ids on the character.
6. **Implement `effect-list`** (DM-only). Free-form editor for the
   `effects[]` array — JSON textarea with structural validation, or
   structured form. Simplest viable shape.
7. **End-to-end manual test**: create a fresh character via UI,
   add a weapon to `equipment.weapons[]`, see it appear in the
   slot dropdown, assign it to slot 0, see derived `baseDamage` /
   `attackAttribute` update, add a trait, see its effects propagate
   to the slot.
8. Update `.github/copilot-instructions.md` and
   `/memories/repo/character-builder.md` — note that all schema
   stub components are now real; no more stubs in `STUB_COMPONENTS`.

**Verification**

1. No entries in `STUB_COMPONENTS` in
   `public/renderers/component-registry.mjs` (or only `notes-list` /
   `affiliation-list` if they remain non-catalog placeholders).
2. Manual round-trip: create → equip → assign → recalc visible in UI.
3. Sibling-project parity check: any catalog-fed picker shape change
   here is reflected in `docs/{addon,bot}-integration.md`.

---

## Chunk J — Real-Data Engine Test Suite

> **Precondition.** Reference data must be stable. After Chunk F closes
> (and the Chunk F-postpass amendments land), the catalog stops moving
> and the RPG pipeline is expected to behave deterministically end-to-end.
> Until that point, real-data tests would rot daily.
>
> **Sequence.** Sits after Chunk I. Layer 1 (per-entry spot tests) may
> ride alongside Chunk G's reference-lint if convenient — they share the
> registry-loading scaffold. Layers 2 and 3 wait for Chunk I so that
> end-to-end fixtures can be authored against the final, UI-reachable
> shape.
>
> **Why now and not in E.** Chunk E's `combat.test.mts` covers the
> *engine mechanics* (predicate composition, modifier verbs, per-slot
> independence) using synthetic fixtures. Chunk J covers *the catalog*:
> "does Polearm Mastery actually grant `reach` to the polearm in slot 0
> the way the rulebook says?" That question only becomes answerable —
> and worth locking — once the catalog is canonical.

**The "what passes mean" policy**

Authored data is fuzzy. The author (the user, who designed Nagara) is
the ground truth for "what this number should be." We translate that
authority into tests as follows:

- **Layer 1 — per-entry spot tests** carry the expected derived value
  inline as a hand-computed literal, sourced from the user. The test
  body and the literal are both in the same file (no off-the-shelf
  rules engine to "double-check" against — the engine *is* the rules,
  and the literal is the spec). When the author says "Polearm Mastery
  gives a polearm `reach`", the test asserts `slot.qualities.includes("reach")`
  with that exact id and no others added.
- **Layer 2 — multi-source interaction tests** carry an English-prose
  preamble describing the scenario ("Behemoth-master + Polearm-novice +
  iron polearm in slot 0") immediately followed by the expected derived
  state as a literal. Reviewers check the preamble against the literal;
  the engine just has to match.
- **Layer 3 — canonical character snapshots** use real `Character` JSON
  fixtures (built via `test/helpers/fixtures.mts` factories, not raw
  JSON, to combat fixture rot when schema fields shift). The expected
  recalc output is checked in as a sibling JSON. When intentional
  changes happen, the workflow is: run with `--update-snapshots` (or
  equivalent), eyeball the diff, get author sign-off, commit. The
  snapshot file is the spec; the engine matches it.

This shifts the burden cleanly: the engine asserts "I produce X"; the
fixture+literal asserts "X is what the rulebook says"; the author owns
the literal. If the engine changes and a literal needs updating, that
change must land in the same commit as a sentence explaining why — no
silent snapshot bumps.

**Steps**

1. **Test scaffold** (`test/rules/real-data/`):
   - Helper that loads the production registry once per file
     (`loadQualityIndex`, `loadAbilityIndex`, etc.) and exposes a
     `recalc(character)` that wires the same pipeline `recalculate`
     uses in production.
   - Factories in `test/helpers/fixtures.mts` extended with
     `withTrait(id, tier)`, `withSpell(id, tier)`, `withTalent(id, rank)`,
     `withRitual(id, level)`, `equip(slot, weaponId)`, `wear(slot, armorId)`
     to keep fixture authoring terse.

2. **Layer 1 — per-entry spot tests** (`test/rules/real-data/abilities.test.mts`,
   `spells.test.mts`, `talents.test.mts`, `qualities.test.mts`):
   - One `describe` block per catalog entry that has typed effects.
   - For each tier (or rank) that introduces effects, one `it` per
     observable change, asserting against a hand-computed literal.
   - **Coverage target**: every catalog entry whose `effects[]` has at
     least one Tier-A or Tier-B entry. Tier-C entries are skipped
     (engine doesn't consume them; nothing to assert).
   - Skip-list mechanism for entries whose semantics are still under
     discussion — annotated with a TODO and a tracker reference.

3. **Layer 2 — multi-source interaction tests**
   (`test/rules/real-data/interactions.test.mts`):
   - 30–50 hand-authored scenarios chosen by the author for cases
     where multiple effects compose in non-obvious ways:
     stacking, conflict resolution (highest-attribute-wins for
     `setBase` per Item 5), `addFlat` accumulation, `cap`
     interaction with `addFlat`, predicate AND/OR composition with
     real qualities, armor body+plug composition, Tier-stacking
     (novice + adept + master same ability).
   - Format: `describe("scenario name") { it("derived state") { /* literal */ } }`.

4. **Layer 3 — canonical character snapshots**
   (`test/rules/real-data/canon/`):
   - 5–10 archetypal characters chosen by the author (e.g. "Bare-handed
     monk", "Heavy-armored polearm soldier", "Witch with Leader",
     "Marksman with Quick Reflexes Master", "Ritualist"). Each is a
     factory-built `Character` checked in as a `.fixture.mts`.
   - Each fixture has a sibling `.expected.json` with the full
     `recalculate()` output (or a curated subset — derived combat
     slots, secondary attributes, special attacks, reactions, flags).
   - A snapshot updater script (`scripts/update-canon-snapshots.mts`)
     regenerates expected JSONs from current fixtures; commits
     require manual review of the diff.
   - Each fixture carries a markdown sibling (`<name>.md`) describing
     the build in prose — what abilities, what equipment, what the
     character is "supposed" to be good at. This is the human-readable
     spec for reviewers.

5. **CI integration**: real-data tests run as part of `npm test`. They
   are **not** opt-in — drift in the catalog or engine that breaks them
   is a release blocker. Failure messages should include the catalog
   id(s) involved so triage starts at the right entry.

**Verification**

1. `npm test` green; real-data tests cover ≥95% of Tier-A/B catalog entries.
2. A deliberate edit to `reference/abilities.en.json` (e.g. changing
   Polearm Mastery's `addFlat` value) triggers exactly the expected
   spot test failure(s) — no others.
3. A deliberate engine change (e.g. flipping conflict resolution policy)
   triggers a clearly-attributed wave of failures across Layer 2 and 3,
   not just Layer 1.
4. Author can review a snapshot diff and decide "yes that's correct,
   bump the literal" without re-deriving from first principles —
   the markdown sibling and the literal together carry the intent.

**Expectations (effort & risk)**

- Comparable scope to Chunk E. Heaviest cost is Layer 1's breadth
  (one assertion per Tier-A/B entry — likely several hundred `it`
  blocks once the catalog is fully authored), but each one is
  mechanical: pick a fixture, apply the entry, assert one literal.
- Layer 2 is the high-judgement layer and the smallest. Author picks
  the scenarios that matter; reviewer judges coverage by reading the
  preamble list, not the asserts.
- Layer 3 is the most fragile (any schema field rename can ripple
  through every snapshot). Mitigated by factory-built fixtures and
  the update script; risk only materializes on intentional schema
  churn, at which point a snapshot regeneration is the right answer.
- Hardest non-mechanical part: keeping Layer 1 literals from rotting
  silently when the author iterates a number in the catalog. Mitigation:
  the catalog change and the literal change land in the same commit;
  CI failure makes this enforceable rather than aspirational.

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
- **Phase order is total**: `setBase → formula → addFlat → multiply → cap →
  flag`. Within a single phase, effect order is undefined and must be
  semantically order-independent. The applicator does not sort within a
  phase.
- **Engine ignores effect lifecycle entirely**: `duration` was dropped from
  the type vocabulary in Chunk C; the engine never reads it. Temporary /
  expirable state belongs to sibling apps (Discord bot, WoW addon), which
  add and remove `character.effects[]` entries at the appropriate moments
  and re-call recalc. The `enforceConsistency` step deliberately does not
  prune effects from the result.
- **Trigger enum is opaque to the engine**: engine validates only that a
  trigger value belongs to the known enum. It runs no per-trigger logic.
  Sibling apps decide what each trigger means at gameplay time. Adding a
  new trigger value is a one-line enum change + a doc update.

## Recommended Order

A → B can proceed in parallel (A is docs, B is code/move).
C blocks on A.
D blocks on C.
E blocks on D.
F.0 (gate, separate plan) blocks on E and blocks F.
G blocks on E (uses real registry).
F blocks on A's authoring spec AND on F.0; runs as a long user-owned bulk edit.
G's reference-lint test (G step 6) blocks on F being complete.
H blocks on G.
I blocks on H (validators must exist before pickers can rely on them) but
can begin the per-component pickers (steps 2–6) opportunistically as soon
as the matching schema field is stable — `equipment-list` in particular
can ship right after E since `equipment.weapons[]` is already final.

Suggested execution: A → B → C → D → E → F.0 → G (registry + tests landing
first; lint-over-real-data turned on once F finishes) → H → I → J. F runs
independently in user time after A and F.0 ship. Chunk I closes Phase 6
with a manually usable app; Chunk J locks the catalog↔engine contract
once both have stabilized. J's Layer 1 (per-entry spot tests) may ride
alongside G's reference-lint if convenient — they share the registry
scaffold; Layers 2 and 3 wait for I.

The post-F amendment plan
([phase6-chunkF-postpass-amendment.md](phase6-chunkF-postpass-amendment.md))
sequences between F and G — its 11 implementation steps add the engine
features the bulk authoring pass surfaced (`magicAttribute`,
`initiativeAttribute`, primary-attribute target, `setBase` conflict
policy, etc.). Treat it as Chunk F+ rather than a separate chunk number.
