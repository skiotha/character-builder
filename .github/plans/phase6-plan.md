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
| F.0 | Quality registry + locale-drift lint (prereqs) | medium | — | medium | medium | ✅ Done (2026-04-27) |
| F | Effect normalization (data, collaborative) + post-pass amendment items 2–13 | small | huge | medium | medium | ✅ Done (Item 1 resolved via Model B in Chunk G — declarative, not an engine resolver) |
| G.1 | Registry loader + effect/action wiring + reference-lint | medium | — | medium | small | ✅ Done (2026-07-04) |
| G.2 | Declarative-action policy + ADR/doc/tracker reconciliation | small | — | small | medium | ✅ Done (2026-07-10) |
| H.1 | Legacy trim & engine cleanup (`RawEffect` narrowed per NB-35; NB-36 audit) | small | — | small | — | ✅ Done (2026-08-07) |
| H.2 | Real validators (budget invariant, health, strict catalog membership) | large | — | large | small | ✅ Done (2026-08-08) |
| H.3 | `natural_weapon` unification via registry (NB-45) | medium | — | medium | small | ✅ Done (2026-09-01) |
| H.4 | Tracker & bookkeeping reconciliation | — | — | — | medium | ✅ Done (2026-09-01) |
| H.5 | Contract docs: data-contracts & sibling integration | — | — | — | large | ⏳ Not started |

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
> `.github/plans/deferred-tasks.md` refreshed, `.github/bugs/engine-weak-points.md`
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
6. Update `.github/plans/deferred-tasks.md`:
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
>   resolution), `docs/data-contracts.md` and `.github/plans/deferred-tasks.md`
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
   `docs/data-contracts.md`, `.github/plans/deferred-tasks.md`, `docs/architecture.md`,
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
>   moved to **Chunk H.3** (registry-driven `{ ref: ... }`
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
>   [done/phase6-chunkF-prereqs-plan.md](done/phase6-chunkF-prereqs-plan.md);
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
>   `done/phase6-chunkF-prereqs-plan.md`. New Chunk I authored. F-side
>   audit note rewritten + Chunk H step 8 (now **Chunk H.3** after the
>   2026-08-07 split) added to drive final resolution.
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

## Chunk F.0 — Prerequisite: Quality Registry & Locale-Drift Lint (GATE) ✅

> **Status:** Done 2026-04-27 (sub-sequence F.0a–F.0f shipped). Historical
> record lives in
> [done/phase6-chunkF-prereqs-plan.md](done/phase6-chunkF-prereqs-plan.md).
>
> **What actually landed** (the plan was rewritten mid-flight; the
> single-file locale merge was scrapped — see the prereqs-plan history
> note for rationale):
>
> - **Quality registry (ADR-016).** New `reference/qualities.{en,ru}.json`
>   as the single canonical source of weapon/armor quality effects;
>   `weapon.effects[]` / `armor.effects[]` become bespoke-only; engine
>   fans out quality effects with implicit `appliesTo` scoping; engine
>   throws on unknown ids at startup. `/api/v1/qualities` endpoint live.
> - **Locale-drift lint** (`test/reference-locale-drift.test.mts`).
>   Replaces the proposed file merge — compares non-localized fields
>   between `{en,ru}` pairs across all reference topics and fails the
>   build on drift. Cheaper than a loader split, same drift guarantee.
>
> No ADR-017 was created — the merge proposal never shipped.

---

## Chunk F — Effect Normalization (Data)

Pure data work. User-owned bulk edit pass over all reference files,
guided by an authoring spec produced by Copilot up-front. No per-batch
back-and-forth.

> **Authoring spec is live:**
> [`docs/reference-authoring.md`](../../docs/reference-authoring.md). Lock-in
> decisions captured in §1–§9; `SpecialAttack` / `Reaction` wire shape
> covered in §10.
>
> **Remaining open items after Chunk F closure:**
>
> - **Item 1 — resolved via Model B (2026-07-04), not an engine resolver.**
>   The `SpecialAttack` / `Reaction` wire shape and authoring sweep both
>   shipped via post-pass amendment (see progress log below). The
>   originally-planned per-slot inheritance resolver is **retired**: the
>   engine carries the declarative inheritance fields (`damageBonus` /
>   `ignoresArmor` / `appliesTo`) verbatim and sibling apps resolve them
>   against the live weapon at play time (weapon swaps are sibling-side, so
>   any value the engine inlined at save time would go stale). See the
>   reworked Chunk G framing note; `TODO(weapon-inheritance)` was deleted in
>   G.2 (2026-07-10).
> - **`EffectFlag` cleanup pass** — authors extended the union as they
>   went; consolidate near-duplicates after Chunk G stabilises.
>
> All other schema/engine amendments surfaced mid-authoring
> (special-attack inherit-by-default wire shape, `magicAttribute`,
> armor-side `condition`, `initiativeAttribute`, `inflicts`, `isFree`,
> talent effect collection, parser placement discipline) shipped via
> [`phase6-chunkF-postpass-amendment.md`](./done/phase6-chunkF-postpass-amendment.md).

**Workflow**

1. **Authoring spec** — done. Live at
   [`docs/reference-authoring.md`](../../docs/reference-authoring.md). Lock
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
> [`phase6-chunkF-postpass-amendment.md`](./done/phase6-chunkF-postpass-amendment.md)
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
| 5    | Universal `setBase` resolution (`resolveSetBase` helper) | 2026-05-08  | G2.A. `applySetBase` becomes a candidate-collector; resolution runs after primary phase against `primaryEffective`. Default-inclusive, strict `>`, default wins ties. Reused per-slot for `combat.attackAttribute` and by Items 2/4. ADR-015 §4a. **Behavioural change:** Smoke and Mirrors-novice / Tactics-adept / Sixth Sense-adept now coexist correctly on the same character. |
| 2    | `magicAttribute` derived character field                | 2026-05-08  | G2.B. New 8th `EffectTarget` kind, `setBase`-only, default `"resolute"`, hidden in UI. *Leader-novice* re-authored as typed Tier A. ADR-015 §3c. |
| 4    | `initiativeAttribute` derived character field           | 2026-05-08  | G2.C. Mirrors Item 2; default `"quick"`. *Tactics-novice* re-authored Tier C → Tier A. *Quick Reflexes Master* keeps `flag: initiativeExemption` (out of scope). ADR-015 §3d. |
| —    | Strip per-spell `attackAttribute` from spells.json      | 2026-05-08  | G2.D companion. Removed 25 hard-coded attribute strings from `specialAttacks[]` / `reactions[]` in `reference/spells.{en,ru}.json`. Sibling apps now read `character.magicAttribute`. |
| 3    | Armor-side `appliesTo` / character-level effect gating  | 2026-05-04  | New optional `condition?: ArmorCondition[]` on `ResolvedEffect` (kinds: `armorQuality`, `armorId`, `armorSlot`, `noArmor`), accepted on `secondary` (character-level) and `armorQuality` (per-piece). Bonus: armor overlay split — engine writes to `ArmorPiece.qualitiesEffective` (reset every recalc), authored `qualities` no longer mutated. Closes weak-point Bug #31's remaining caveat. ADR-015 §3f. Authoring sweep: Soldier Adept, Demiurge Hands Novice/Master across `abilities.{en,ru}.json`. Tracker entry: weak-point #32. |
| 9    | Special-attack rewrite by id (rank supersedes lower)    | 2026-05-10  | New `collectActions` step in `derived.mts`: walks `traits[]`, dedupes by required `Action.id` via `Map.set` last-write-wins; relies on registry's documented tier-ascending order (`TraitLookupResult` JSDoc) instead of a rank field. **Diverged:** dropped rank-stamping (free with ordered iteration) and **removed** the unused `Action.source` field rather than retaining it. Talents/equipment intentionally don't contribute (YAGNI). 7-test suite + nested-id locale-drift pin + audit lint Section 8 (missing/dup/cross-parent). ADR-014 §9; `data-contracts.md` + `reference-authoring.md` §11 updated. |
| 1 ✅ | `Action` inheritance shape (declarative — no engine resolver) | 2026-05-19 | Added `damageBonus?`, `ignoresArmor?`, `appliesTo?: WeaponPredicate[]` to `Action` (name `appliesTo` chosen over staging's `weaponFilter` to reuse existing scoping vocabulary). Audit lint enforces `damageBonus` ⇒ non-empty `appliesTo` and forbids `ignoresArmor`/`damageBonus` on non-`manual`. **Authoring sweep complete:** `intrigues-backstab` (novice + master) re-authored with `damageBonus` + `appliesTo`; entries that are legitimately bespoke (Cheap Shot, Strangling, Riposte armor-ignoring d6, poisoner/hunter/skirmish reactions) correctly retain hardcoded `damage`/`attackAttribute` per the original Item 1 "Cheap Shot and innate/monster attacks stay as-is" carve-out. **Docs landed:** ADR-014 post-Chunk-F amendment block; `docs/data-contracts.md` Action shape extended; `docs/reference-authoring.md` §11 covers inheritance defaults + `damageBonus` + `ignoresArmor` + `appliesTo`. **Superseded by Model B (2026-07-04):** the engine carries these fields declaratively — no recalc-time inlining; sibling apps resolve against the live weapon (swaps are sibling-side, so inlined values would go stale). **Closed in Chunk G.2 (2026-07-10):** `TODO(weapon-inheritance)` deleted, staging-file `### Status` flipped ✅, ADR-014 / data-contracts / reference-authoring reconciled. |
| 6 ✅ | Status infliction (`inflicts: string[]`)               | 2026-05-19  | Field on `Action` validated against data-driven registry (`reference/statuses.{en,ru}.json` — display-only metadata; engine treats statuses as opaque tokens). Diverged from staging's `StatusKind` TypeScript union to match existing reference-catalog pattern. Added `statuses` topic in `src/models/reference.mts`, `/api/v1/statuses` locale-aware endpoint in `src/app.mts`, audit-reference lint resolves all `inflicts[]` ids, locale-drift test covers the pair. Authoring sweep complete — audit reports 8 distinct status ids referenced, all resolve. Docs landed: ADR-014 amendment + `docs/data-contracts.md` Action shape + `docs/reference-authoring.md` §11 "Status infliction". Sibling apps pick up `inflicts` through the standard ADR-014 Action reference. |
| 7 ✅ | Boons/sins opportunistic effects (engine path)         | 2026-05-19  | `collectAllEffects` walks `character.talents[]` via `registry.lookupTalent(id, level)` with warn-and-skip on unknown ids (mirrors trait pattern). Audit-reference lint accepts top-level `effects[]` on boon/sin entries. Authoring sweep complete (12 boons + 1 sin currently carry `effects[]`). Docs landed: `docs/reference-authoring.md` §3 and §4 document the opportunistic-effects rule with the rule-of-thumb test and examples. Production registry's `lookupTalent: () => null` stub is intentional and now documented in §3 — real talent effects flow only once Chunk G's loader lands; in-memory test registry exercises the full path. |
| 8 ✅ | Free-attack flag (`isFree?: boolean`)                  | 2026-05-19  | Field on `Action`; audit lint (section 11) enforces `isFree: true` only on `trigger: "manual"`. Engine remains declarative-only per staging decision — no derived `combat.freeAttacks` counter. Authoring sweep complete (Knife Mastery `stab`, Smoke and Mirrors `feint`, Two Weapons off-hand, Quick Reload, etc.); audit reports zero violations. Docs landed: ADR-014 amendment documents the field + no-engine-count rule; `docs/reference-authoring.md` §11 covers it under "Free attacks (Item 8)". |
| 12 ✅ | `appliesTo`/`condition` placement discipline (parser + lint) | 2026-05-19  | Parser in `src/rules/effects.mts` flipped from strip-with-warn to **reject-null** for misplaced `appliesTo`/`condition` (whole effect drops). Accept-lists per ADR-015 §3 widening: `appliesTo` on `combat | weaponQuality | flag | secondary` (last per Bug #34 — documentary, engine ignores at runtime); `condition` on `secondary | armorQuality`. Audit-reference lint sections 9–12 enforce placement at catalog-build time; authoring sweep complete — audit reports zero placement violations. 12b keep-as-is decision unchanged. Placement table folded into [`docs/reference-authoring.md`](../../docs/reference-authoring.md) §10 / §10.5. |
| —    | Statuses reference topic + endpoint                    | 2026-05-19  | Item 6 dependency. New `reference/statuses.{en,ru}.json` (display metadata: id/name/description), `statuses` topic in reference loader, `/api/v1/statuses` endpoint, locale-drift test entry. Sibling apps render the rich description; engine never reads this catalog. |
| —    | `TriggerKind` aligned with ADR-015 §5                  | 2026-05-19  | Replaced the stale 4-value `TriggerKind` with the 15-value union from ADR-015 §5 (un-drafted in ADR). `Action.trigger` accepts the full vocabulary; audit lint validates membership. No engine semantics change beyond accepting the wider set. |
| —    | Bugs #34, #35 filed (engine-weak-points)               | 2026-05-19  | #34: `secondary` + `appliesTo` accepted by parser post-J.4b but engine has no per-slot weighting mechanism for `secondary` targets (documentary today). #35: `secondary` + `setBase` rejected by parser — no primary-substitution mechanism; sibling to #34 with three design options sketched (new modifier verb `useAttribute`, new target kind `secondaryAttribute`, or per-formula primary slots). Both stay open; affects ~4 ability/spell entries (`smoke-and-mirrors.adept[0]`, `tactics.adept[0]`, `sixth-sense.adept[0]`, `dancing-weapon.master[1]`). |

Items 6, 7, 8, and 12 above are now fully closed — their `### Status`
blocks in the staging file flipped to ✅. Item 1 is now **closed** (Chunk
G.2, 2026-07-10): the engine inheritance resolver is retired — actions are
declarative and `TODO(weapon-inheritance)` is deleted. See the staging file
`### Status` blocks for the canonical per-item record.

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
>
> **Resolution locked (2026-08-07):** the first option — the catalog
> record is canonical and both the schema default and the engine fallback
> resolve through the registry. Gameplay-visible (bare hands become d4 +
> `short`), accepted as the intended shape. Scheduled as **Chunk H.3**;
> tracked as NB-45.

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

Decided 2026-08-07 — see the resolution note in the status blockquote
above; executed in Chunk H.3 (NB-45).

---

## Chunk G — Wire Ability/Spell Registry into Recalc

> **Reworked 2026-07-04** — replaces the original single-chunk outline and
> its Item 1 "inheritance resolver" (old step 3a). Split into **G.1**
> (loader + wiring + lint) and **G.2** (policy + doc/tracker
> reconciliation). Heading kept verbatim so the `NB-39` cross-link into
> this section still resolves.
>
> **Framing decision — Model B (declarative actions).** The engine does
> **not** resolve or inline special-attack / reaction damage. It collects
> actions from the registry, dedupes by `Action.id` with tier-rewrite
> (`collectActions`, already built), and carries every declarative field
> (`damage`, `attackAttribute`, `damageBonus`, `ignoresArmor`,
> `appliesTo`, `inflicts`, `isFree`) **verbatim** to sibling apps, which
> resolve against the live weapon at play time. Rationale: weapon swaps
> happen sibling-side and are not persisted per-swap (ADR-014), so any
> value the engine inlined at save time would go stale on the next swap.
> Per-slot **passive** weapon stats stay engine-computed
> (`deriveCombatSlots`, Chunk E). The clean line: **passives = engine;
> actions = declarative.** This retires the Item 1 inheritance resolver —
> `TODO(weapon-inheritance)` is **deleted, not implemented** (G.2).
>
> **Decisions locked (2026-07-04):**
> - **Actions declarative** (Model B, above).
> - **Conditional secondaries (NB-34): skip.** The engine skips any
>   `secondary`-target effect carrying an `appliesTo` predicate — it
>   cannot evaluate the weapon condition, and applying it unconditionally
>   bakes a sometimes-true bonus into the computed value (today
>   `double-strike.novice` grants +1 defense even bare-handed). The
>   effect + predicate ride to siblings as documentary data; a UI
>   "this weapon grants X" surface is deferred (roadmap Phase 8). ~9
>   abilities affected.
> - **Talents are engine-unrelated** beyond the flags they grant
>   (knowledge / resistance set-membership). `lookupTalent` returns the
>   flat top-level `effects[]` verbatim; **no level-scaling** (flags
>   ignore their numeric value; no talent carries a numeric-target effect
>   today).
> - **Load posture by source:** catalog (traits / spells / talents /
>   qualities) is **fail-fast** (throw, naming the entry) at startup; the
>   reference-lint test is **report-all**; runtime `character.effects[]`
>   overrides stay **warn-and-skip**.
> - **Engine locale** is `DEFAULT_LOCALE` (`en`); the locale-drift lint
>   guarantees en/ru structural parity, so `en` is authoritative for the
>   engine (mirrors `loadQualityIndex`).
> - **Spell tier-promotion retired.** ADR-014's tier-level spell→action
>   promotion is dropped; spells carry explicit id'd `specialAttacks[]` /
>   `reactions[]` with numeric `damage`. `reference-authoring.md` §2/§11
>   is authoritative over the older ADR-014 action / spell-tier prose.

### G.1 — Registry loader + effect/action wiring + reference-lint

> **✅ Completed 2026-07-04.** 672 / 672 tests + typecheck green.
> Deliverables and divergences from the outline below:
>
> - **Loader** — the `src/rules/registry.mts` shim is replaced by
>   `loadRegistry(): Promise<Registry>`: pre-deserializes traits
>   (abilities+spells, additive per-tier), talents (boons+sins, flat
>   top-level, level ignored) and qualities at `DEFAULT_LOCALE`,
>   fail-fast. Wired into `src/app.mts` in place of `emptyRegistry`
>   (loads 125 traits / 68 talents / 31 qualities). The `#rules` barrel
>   exports `loadRegistry`; `recalculate` stays synchronous. Closes
>   **NB-37**; the slot-2 `own` check (**NB-39**) runs at load and in the
>   lint.
> - **Deserializer** — `deserializeEffect` / `deserializeAction`
>   (throw-mode) added to `src/rules/effects.mts`, reusing
>   `normalizeRawEffect` / `parseAppliesTo`. Narrative (no `target` and no
>   `modifier`) → skip; `target` XOR `modifier` → throw; malformed →
>   throw. Actions carry all declarative fields verbatim (Model B).
>   **Divergence:** only `isFree` is manual-gated; `ignoresArmor` /
>   `damageBonus` are **not** (matches the audit lint and real data —
>   armor-ignoring reactions like `entanglement-choking-tie` / Riposte are
>   legitimate). The Item 1 note's "forbids `ignoresArmor`/`damageBonus`
>   on non-`manual`" was imprecise.
> - **NB-34 skip** — `collectAllEffects` drops `secondary` effects that
>   carry `appliesTo` (a single guard, DRY over the four secondary apply
>   paths named in the outline). NB-34 updated: stays open; the
>   conditional-secondary feature + UI surface are deferred to Phase 8.
> - **NB-44** — confirmed stale (the mechanism shipped with post-Chunk-F
>   Item 5's `resolveSetBase`). Corrected the audit's false finding, added
>   loader + deserializer regression coverage, **closed NB-44**.
> - **Reference-lint** — new `test/rules/reference-lint.test.mts`
>   (report-all, both locales) delegates effect/action *shape* to the
>   deserializers and adds the cross-refs: quality resolution
>   (`weaponQuality`/`armorQuality` targets, `appliesTo kind:"quality"`,
>   weapon/armor `qualities[]`), per-file id uniqueness, action placement
>   (special-attack ⇒ `manual`, reaction ⇒ non-`manual`), slot-2 `own`.
>   **Divergences:** (a) `appliesTo` `id`/`type` resolution against the
>   weapon catalog was **dropped** — the authored predicate vocabulary is
>   looser than the weapon `id`/`type` fields and the old audit never
>   gated on it (see finding below); (b) `scripts/audit-reference.mts` is
>   **kept** (its stale NB-44 line corrected) — its deletion and the
>   repointing of its doc/ADR references move to **G.2** (doc
>   reconciliation).
> - **Tests** — new `test/rules/registry.test.mts` (loader real-data +
>   deserializer units); all five `TODO(trait-talent-registry)` sites
>   removed.
>
> **⚠ Finding for author triage (not fixed here).** 11 `appliesTo`
> predicates use `kind: "type"` / `kind: "id"` values that don't resolve
> against the weapon catalog and are therefore **dead at runtime**
> (`matchesPredicates` matches `weapon.type` / `weapon.id` exactly):
> `smoke-and-mirrors` (`type: "short"` ×3), `polearm` + `staff-mastery`
> (`type: "long"`), `naval-warfare-and-artillery` (`type: "siege"`),
> `quick-hand` (`id: "revolver"`), `axe-patterns` (`id: "axe"` ×4).
> `short` / `long` are **qualities** (these likely want
> `kind: "quality"`); `axe` / `revolver` / `siege` map to no weapon
> `id` / `type`. Resolution is an RPG-authoring decision (re-author the
> predicates, or extend the weapon taxonomy), out of scope for the
> engine-wiring chunk.

**Steps**

1. **Loader** — replace the `src/rules/registry.mts` re-export shim
   (closes NB-37) with an async `loadRegistry(): Promise<Registry>`:
   - Loads merged traits (`abilities` + `spells`), merged talents
     (`boons` + `sins`), and qualities at `DEFAULT_LOCALE` via
     `src/models/reference.mts` (`getMerged` / `getTopic`).
   - `lookupTrait(id, tier)` — flatten `novice … tier` additively;
     deserialize each tier's `effects[]`; collect `specialAttacks[]` /
     `reactions[]` in tier-ascending order (the `collectActions`
     rewrite-by-id contract in `registry-types.mts`).
   - `lookupTalent(id, level)` — return the boon / sin top-level
     `effects[]` verbatim (flags). No scaling.
   - `lookupQuality` — unchanged (ADR-016).
2. **Deserializer** (`deserializeEffect` / `deserializeAction`):
   - **Skip** narrative entries (neither `target` nor `modifier`).
   - **Throw** (fail-fast, naming the entry) on `target` XOR `modifier`
     and on any unparseable target / modifier / predicate / trigger.
   - Actions: preserve **all** declarative fields verbatim (Model B);
     validate `id` present, `trigger ∈ TriggerKind`, `isFree` /
     `ignoresArmor` ⇒ `manual`, `damageBonus` ⇒ non-empty `appliesTo`,
     `inflicts[]` resolve in `reference/statuses`.
   - Reuse the `src/rules/effects.mts` parser posture (it already accepts
     `secondary + setBase` — see step 4).
3. **`src/app.mts`** — replace the inline `emptyRegistry` stub with
   `await loadRegistry()`; **rename** to `registry`. `recalculate` stays
   synchronous (the loader is the only async work, at startup — mirrors
   `loadQualityIndex`). Remove the `TODO(trait-talent-registry)` sites.
4. **Reconcile the audit / parser drift (NB-44).** `secondary + setBase`
   (e.g. `smoke-and-mirrors.adept` "use Discreet for Defense") is
   **valid and already wired end-to-end**: `parseModifier` accepts it,
   `applySetBase` buckets it per-stat, and the formula phase resolves it
   via `resolveSetBase` (default-inclusive max-by-primary — "Discreet
   unless a higher-valued base is set"). Fix `scripts/audit-reference.mts`,
   which falsely reports it "rejected by parser"; ensure the deserializer
   accepts it. Add a regression test and **close NB-44**.
5. **Conditional-secondary skip (NB-34).** In the applicator's `secondary`
   apply paths, skip effects that carry an `appliesTo` predicate
   (documentary, not engine-evaluable). Update NB-34 with the decision
   and the deferred UI-surface note.
6. **Reference-lint test** (`test/rules/reference-lint.test.mts`) —
   promote `scripts/audit-reference.mts` (delete the standalone script
   once absorbed), **corrected** so `secondary + setBase` is accepted,
   not flagged. Report-all (don't bail). Iterate every
   ability / spell / boon / sin / ritual across locales and assert: each
   effect / predicate / modifier / trigger parses; each `appliesTo`
   id / type / quality exists in `reference/weapons.*`; ids unique per
   file; en/ru structural parity. **Quality-resolution validator**
   (deferred from F.0): every weapon / armor `qualities[]` id and every
   `weaponQuality` / `armorQuality` target + `appliesTo` `kind: "quality"`
   value resolves in `qualities.<DEFAULT_LOCALE>`. **Slot-2 `own` check**
   (NB-39): assert `qualities.*` contains an `own` entry.
7. **Tests** (`test/rules/registry.test.mts` + additions):
   - Load real data; non-empty; additive tier stacking.
   - `secondary + setBase` end-to-end (Discreet-for-Defense) — locks NB-44.
   - Actions flow + dedupe: `intrigues-backstab` master (`damageBonus: 8`)
     rewrites novice; declarative fields round-trip verbatim.
   - Talent flags flow via `lookupTalent`; conditional secondaries skipped.
   - A deliberately malformed catalog entry → throws at load.

**Closes:** NB-37, NB-39, NB-44. Removes `TODO(trait-talent-registry)`.

### G.2 — Declarative-action policy, ADR / doc reconciliation & cleanup

> **✅ Completed 2026-07-10.** Pure docs / tracker / comment reconciliation
> — no engine behavior change; 672 / 672 tests + typecheck green.
> Deliverables:
>
> - **Declarative-action policy landed** across ADR-014 (§4 declarative-only
>   note, §5 spell-tier promotion retired, `§inheritance-fields` anchor
>   reworded), `docs/data-contracts.md` (Action shape), and
>   `docs/reference-authoring.md` §11 (inheritance defaults now
>   sibling-resolved). The engine never inlines weapon stats; sibling apps
>   resolve against the live carried weapon at play time. Prose is
>   substantive (no ephemeral "Model B" label in the shipped docs/code).
> - **`TODO(weapon-inheritance)` deleted** from `src/rpg-types.mts`; the
>   `Action` inheritance-field JSDoc reframed declarative. Staging-file
>   Item 1 `### Status` flipped ✅.
> - **NB-38 closed** via path (a): ADR-014 §5 + `reference-authoring.md` §2
>   dropped the tier-root `attackAttribute` promotion (spells declare
>   explicit id'd arrays; attack attribute is character `magicAttribute`).
>   Archived to `resolved.md`.
> - **NB-47 filed** (talent gaps: no level-scaling + many check-bonus
>   talents carry no flag). Counter bumped to NB-48.
> - **`scripts/audit-reference.mts` deleted**; every live doc / ADR / code
>   cite that named it (ADR-014, ADR-016, `data-contracts.md`,
>   `reference-authoring.md`, `rpg-types.mts`, `infra.md`) repointed to
>   `test/rules/reference-lint.test.mts`. Remaining mentions are archival
>   (`resolved.md` NB bodies, `done/` plans).
> - **Conditional-secondary skip + talent stance** documented in
>   `docs/data-contracts.md` (NB-34 / NB-47).
> - **Verification #4 (manual UI) deferred to Chunk I** — no trait picker
>   exists yet and G.2 changed only docs/comments; folded into Chunk I
>   step 7.

**Steps**

1. **Amend ADR-014** — the action-shape anchor (`§inheritance-fields`)
   becomes declarative-only (siblings resolve at play time; engine
   inlining explicitly rejected — weapon swaps are sibling-side, so
   inlined values go stale); retire the tier-level spell→action promotion
   (superseded by `reference-authoring.md` §2 — explicit id'd arrays,
   numeric `damage`). **Closes NB-38.**
2. **Delete `TODO(weapon-inheritance)`** in `src/rpg-types.mts` (Model B
   = never inlined). Update `docs/reference-authoring.md` §11 to state the
   inheritance fields are **sibling-resolved**, not engine-resolved. Flip
   the Item 1 `### Status` block in
   [`phase6-chunkF-postpass-amendment.md`](./done/phase6-chunkF-postpass-amendment.md).
3. **Talent-gaps tracker** — file a new NB capturing (a) numeric talent
   level-scaling is unimplemented, and (b) many check-bonus talents
   (Actor, Powerful Voice, Deceiver, …) carry no engine representation
   (no flag), so siblings can only key off "talent present + level."
   Authoring revisit if / when siblings need it.
4. **Docs** — reflect the Model B action policy, the conditional-secondary
   skip, and the talent stance in `docs/data-contracts.md` and
   `docs/reference-authoring.md`.
5. **Retire `scripts/audit-reference.mts`.** Its semantic checks were
   promoted into `test/rules/reference-lint.test.mts` (Chunk G.1). Delete
   the script and repoint the references that name it — ADR-014, ADR-016,
   `docs/data-contracts.md`, `docs/reference-authoring.md`,
   `src/rpg-types.mts` (Action JSDoc), and `.github/bugs/infra.md` — to
   the reference-lint test. (Its stale NB-44 finding was already corrected
   in G.1.)

**Verification**

1. `npm test` green — including the reference-lint pass over real data.
2. `secondary + setBase` resolves (Discreet-for-Defense); conditional
   secondaries are skipped (no bare-handed Double Strike defense bump).
3. Actions round-trip verbatim; master-tier rewrite-by-id holds; no engine
   inlining of weapon stats.
4. ~~Manual: create a character, add traits via UI, see derived combat
   values, flags, special attacks, and reactions populate.~~ **Deferred to
   Chunk I** (2026-07-10) — no trait picker exists yet (`trait-list` is
   read-only) and G.2 changed only docs / comments, so nothing it touched
   is UI-observable. Folded into Chunk I step 7.

### Follow-up (post-G): canonical engine-semantics digest

> ✅ **Shipped & signed off (2026-09-01).** The digest lives at
> [`docs/rpg-engine-semantics.md`](../../docs/rpg-engine-semantics.md)
> (cite `ES §<anchor>`). Scoping plan archived:
> [`done/engine-semantics-digest-plan.md`](./done/engine-semantics-digest-plan.md).
> Only the cross-repo sibling pointer lines (nagara-addon, malizia) remain,
> coordinated separately in those repos.

---

## Chunk H — Validators, Sibling Docs, Cleanup

> **Re-scoped and split 2026-08-07** — replaces the original eight-step
> outline (authored 2026-04-21), which had drifted against decisions taken
> during Chunks E–G, the 2026-06-21 tracker migration, and the digest plan.
> Split into **H.1–H.5** so each unit lands independently reviewable
> (G.1/G.2 precedent). Heading kept verbatim so existing cross-links
> resolve. Sequence: **H.1 → H.2 → H.3 → H.4 → H.5** — code first, then
> trackers record what shipped, then contract docs are written against the
> post-H.3 reality. H.2 and H.3 are technically decoupled (validators use
> the models-layer reference loader, not the engine registry), but the
> listed order keeps the validator suite in place to catch H.3's fixture
> churn.
>
> **What changed against the original outline:**
>
> - **Old step 0 (delete `RawEffect` / `normalizeRawEffect`) narrowed to a
>   trim.** Its premise — "the legacy wire shape has no remaining
>   producers" — is false: DM-writable `character.effects[]` still produces
>   it, the Chunk-G load-posture decision keeps that boundary
>   warn-and-skip, and the fail-fast catalog deserializer
>   (`deserializeEffect`) is built *on top of* `normalizeRawEffect`. Full
>   removal is NB-35 (deferred until Phase 7 clarifies sibling lifecycle
>   metadata). → **H.1**.
> - **Old step 0a** was already preempted by Chunk E.0.7 (recorded there);
>   nothing remains.
> - **Old step 1 (validators) hid real scope decisions** — budget
>   semantics, the three derived-field stubs it never listed, catalog
>   access from the models layer, and an update-path cross-field mechanism
>   that doesn't exist yet. Locked below. → **H.2**.
> - **Old step 4 targeted a file that no longer exists.**
>   `engine-weak-points.md` became `.github/bugs/engine.md` + `resolved.md`
>   with permanent `NB-<n>` ids (2026-06-21). The sweep also gains **NB-3**
>   (present in this plan's own coverage table, omitted from the old
>   step-4 enumeration by transcription slip) and the factually-stale
>   NB-10 / NB-12 / NB-13 / NB-14 entries. → **H.4**.
> - **Old step 6's "mark Phase 6 completed" is impossible** — Chunks I and
>   J remain open. The roadmap gets an honest "engine-complete" status
>   instead. → **H.4**.
> - **Old step 7 is half-superseded.** `nagara-rpg-rules.md` deletion is
>   owned by the digest plan's pending step 4 (awaiting sign-off); H only
>   refreshes `character-builder.md`. → **H.4**.
> - **Old step 8 (`natural_weapon`) needs a `Registry` extension** — the
>   registry indexes traits / talents / qualities but has **no weapon
>   lookup** today. → **H.3**.
> - **NB-36 pulled in** (`enforceConsistency()` redundancy audit — the
>   tracker nominates it for the H cleanup umbrella). → **H.1**.
>
> **Decisions locked (2026-08-07, with the user):**
>
> - **Attribute budget is a base-stat invariant.** Base primaries are
>   creation-locked identity: each 5–15, sum **exactly 80**, for the
>   character's whole life. Every post-creation change — trait-granted or
>   DM fiat — is authored as a `kind: "primary"` effect and lands in
>   `attributes.primaryEffective`, which is **never** validated.
>   The sum rule is enforced on every write path that can touch base
>   primaries. `perm_attr` (DM write on base primaries) stays as-is — a
>   DM rebalance that keeps the sum at 80 remains legal.
> - **Derived-field validator stubs die.** `defenseValid` /
>   `painThresholdValid` / `corruptionThresholdValid` validate recalc-owned
>   output and were never in the original step-1 list; they are deleted
>   together with the `skipOnCreation` secondary-field creation overrides.
>   The six secondary derived fields become `serverControlled` so creation
>   warns-and-ignores client-supplied values (matching `playerId`); updates
>   already reject via the `derived` denylist. `toughness.current` is NOT
>   part of the flip (it is real state, seeded at creation) — but note it
>   is already `derived: true` today, so PATCH rejects health writes for
>   every role; when health tracking becomes writable is a Phase 7
>   (sibling-integration) question, out of H's scope.
> - **Ref-validity is strict catalog membership** (user certainty settled
>   2026-08-07 — no deferral tracker filed). Reference files are the sole
>   source of truth: neither the UI nor sibling apps may invent items.
>   Every id in `equipment.weapons[]` / `equipment.armor.*` / `traits[]` /
>   `talents[]` / `rituals[]` / `traditions[]` must resolve in its catalog,
>   and item `qualities[]` must resolve in the quality registry. **No
>   field-level canonicalization**: validators check id membership and
>   structure, not that display/numeric fields match the catalog — entries
>   are authored per-locale by the client, so canonicalizing at
>   `DEFAULT_LOCALE` would bake EN display strings into characters. Field
>   tampering stays possible and accepted for the trusted userbase
>   (ADR-003 posture); revisit alongside Chunk I if the picker wire shape
>   changes.
> - **`RawEffect` is sanctioned wire format, not deprecated.** It survives
>   for `character.effects[]` until NB-35's migration; the `@deprecated`
>   tags come off in favor of boundary doc-comments. `priority` is deleted
>   from the interface (ADR-015 removed it from the vocabulary); `duration`
>   **stays**, documented-as-ignored — it is the field NB-35's Phase-7
>   decision is actually about.
> - **`natural_weapon` unifies on the catalog record** — damage 4,
>   `["own", "short"]`, display name "Natural Weapon". This is a
>   gameplay-visible change (bare hands deal d4 and gain `short`), accepted
>   as the intended shape; the stripped damage-0 seed was always marked
>   transitional. Registry-driven resolution per NB-45.
> - **Digest interplay.** `docs/rpg-engine-semantics.md` is content-stable
>   for H's purposes (user-reviewed 2026-08-07; minor issues pending, so it
>   is deliberately **not** marked stable in-file). H cites `ES §` anchors
>   against the current iteration. The digest plan's remaining steps
>   (memory deletion, sibling pointer lines, archival) stay with that plan;
>   H.5 rewrites sibling contract *content* only and adds no pointer lines.

### H.1 — Legacy trim & engine cleanup (code, small)

> **✅ Completed 2026-08-07.** 670 / 670 tests + typecheck green. NB-36
> closed (entry moved to `resolved.md`). Notes against the outline:
>
> - **NB-36 audit took the both-hold branch — full deletion — after
>   closing one real gap.** (b) held outright: no `EffectTarget` kind can
>   reach `experience` (applicator write surface verified), and the API
>   boundary already rejects negative XP (`min: 0` on `unspent`,
>   `increment` deltas validated against the same bound, creation business
>   rule in `validateRPGRules`). (a) had a genuine finding: `armor.body` /
>   `armor.plug` carried **no** schema default, so the on-disk
>   `armor: { body: null, plug: null }` creation shape was actually
>   produced by `enforceConsistency`, not the boundary. Both fields gained
>   `default: null` in `src/models/character.mts`; the schema boundary now
>   owns the shape and the function + its call site + the
>   `TODO(enforce-consistency-redundancy)` anchor are deleted.
> - **Residual caveat scheduled into H.2:** an explicit `null` PATCH on an
>   object-typed parent (`equipment`, `attributes`, …) passes the `typeof`
>   type check — a systemic boundary gap `enforceConsistency` neither
>   prevented nor repaired (it left a dangling own-slot `weaponIndex`).
>   Added as an H.2 step-4 sub-bullet (object-parent `null` rejection).
> - **Regression pin added:** `test/rules/derived.test.mts` now asserts
>   recalc passes out-of-range XP through untouched (recalc is a pure
>   derivation; the boundary owns validity).
> - **Adjacent staleness fixed in the same pass:** `attributes.mts`
>   `clampValues` doc no longer names the deleted function (cites NB-21);
>   the plan's cross-cutting lifecycle note now says `recalculate` instead
>   of "the `enforceConsistency` step"; `derived.mts` module header
>   records the pure-derivation posture.

**Steps**

1. `src/rpg-types.mts` — delete `RawEffect.priority`; keep `duration` with
   its ignored-by-engine doc-comment. Replace the `@deprecated` tags on
   `RawEffect` / `RawEffectModifier` with boundary prose: sanctioned wire
   shape for `character.effects[]` only, single consumer
   `src/rules/effects.mts`, migration tracked by NB-35. The
   `TODO(rawEffect-removal)` + NB-35 cite stay.
2. `src/rules/effects.mts` — delete the legacy-only reject branches: the
   dotted-path string special-case in `parseTarget` and the
   `add` / `mul` / `set` special-case in `parseModifier`. Both inputs
   still reject through the generic invalid-target / unknown-modifier
   paths (a warn is still emitted) — only the legacy-flavored messaging
   goes. Delete the no-op `priority` / `duration` guard blocks in
   `normalizeRawEffect`.
3. `src/rules/effects.mts` module header — re-frame "legacy `RawEffect`
   wire shape" as the *untrusted runtime* wire shape; fix the stale
   "reference-lint … will promote misses to a hard failure once it ships"
   sentence (the lint shipped in G.1; runtime misses stay warn-and-skip by
   design).
4. **NB-36 audit** (`enforceConsistency()`): (a) confirm every field it
   defaults is also defaulted at the schema/storage boundary; (b) confirm
   no typed `EffectTarget` can reach `experience.unspent`; (c) if both
   hold, delete the function and its `recalculate` call site (if only (a)
   holds, keep the XP guard as an inline one-liner); (d) update the
   `derived.mts` module header in the same edit. Close **NB-36** in the
   same commit (entry moves to `resolved.md`).
5. Tests — retitle the two legacy-reject tests (assertions unchanged:
   `null` + warn); rework the `priority`-ignored test into an
   unknown-junk-keys-ignored test (the field is gone from the interface);
   drop/adjust `enforceConsistency` coverage in
   `test/rules/derived.test.mts` per (c)'s outcome.

**Verification**

1. `npm test` + `npm run typecheck` green.
2. No `add` / `mul` / `set` verb handling remains under `src/rules/`;
   `priority` is gone from `RawEffect`.
3. A malformed DM-injected `character.effects[]` entry still
   warn-and-skips (boundary behavior unchanged).

### H.2 — Real validators (code, the load-bearing sub-chunk)

> **✅ Completed 2026-08-08.** 697 / 697 tests (+27 net) + typecheck green;
> in-browser creation + edit round-trip verified via Playwright MCP.
> Divergences and findings against the outline:
>
> - **Creation stayed sync; the handler composes.** Of the two allowed
>   options, `validateCharacterCreation` keeps its sync signature (schema
>   layer stays pure, ~30 call sites untouched) and
>   `handleCreateCharacter` awaits the catalog pass over
>   `validation.validatedData` with the same 400 surface. The new module
>   is `src/models/reference-validation.mts` (`validateCatalogRefs`).
> - **The merged-update pass is scoped to touched subtrees** — a
>   mid-execution discovery: the cross-field hooks and catalog checks are
>   INPUT-shape validators, while stored characters legitimately carry
>   recalc output they would reject (`validateCombatCarried` chokes on a
>   saved slot's derived fields; a catalog id retired after a character
>   was saved must not block an unrelated rename). Both re-runs filter by
>   "does any updated field address this subtree" (`touchesSubtree`);
>   `validateRPGRules` (XP only) runs unconditionally.
> - **PATCH validation failures surface as 422** ("Some updates failed",
>   the handler's existing all-or-nothing convention), not the outline's
>   shorthand "400"; creation failures are 400 as before. The
>   previously-crashing unknown-quality PATCH now lands in that designed
>   422 instead of reaching the ADR-016 recalc throw.
> - **NB-48 filed** (counter → NB-49): wholesale parent-object PATCH
>   bypasses leaf-level write permissions (`attributes` is owner-RW while
>   `attributes.primary.*` is owner-RO). Discovered while wiring the
>   budget hook; the hook + recalc keep it non-exploitable into invalid
>   state, so it is deferred rather than fixed here.
> - **Digest lockstep:** `ES §primaries`' Where facet repointed from
>   `validateRPGRules` to `rpgValidators.attributePointsValid` + the
>   merged-update pass — its "enforced on every write" claim is now
>   literally true.
> - **Test-seed upgrade was load-bearing:** the test server's seeded
>   weapons catalog had no `natural_weapon` entry, so every seeded POST
>   would have 400'd under strict membership. Seeds are now structurally
>   complete (full natural_weapon, typed test entries, armor slots, boon
>   `levels`).
> - **Three API tests were single-primary bumps** (e.g. `strong: 15`
>   alone) — now correctly rejected by the lifetime budget; rewritten as
>   budget-preserving rebalances (+5 strong / −5 appealing).
> - **UI verification (user rider):** creation form renders post-flip
>   (secondaries display as read-only computed previews), POST → 201,
>   sheet shows server-computed secondaries + disabled primaries +
>   derived own-slot fields, edit-in-view PATCH → 200 with SSE live.
>   Pre-existing quirks observed, none H.2-caused: favicon fetch errors,
>   one benign SSE reconnect blip, and the `#character-name` element
>   intercepting pointer events over the Location field (mouse-editing
>   Location is impossible at common viewport widths — client CSS
>   layering; flagged for Chunk I's view rework).

**Design notes (locked)**

- Catalog access from the models layer goes through
  `src/models/reference.mts` (`getTopic` / `getMerged` at
  `DEFAULT_LOCALE`; the locale-drift lint guarantees en/ru id parity, so
  EN ids are authoritative — mirrors the registry). Same-layer import, no
  ADR-013 violation; the mtime cache keeps validators fresh without a
  startup-frozen index.
- Membership checks are async ⇒ creation validation gains an async step
  (`validateCharacterCreation` becomes async, or the handler composes a
  second async pass); `validateCharacterUpdate` is already async. Handler
  and test churn expected.
- The update path gains the cross-field/business pass creation already
  has: after merging updates, run `validateCrossFieldRules` +
  `validateRPGRules` against the merged character. Today updates validate
  per-field only, so e.g. the budget rule is unreachable on PATCH.
- The ADR-016 recalc-time throw on unknown quality ids stays as
  defense-in-depth for hand-edited on-disk data; validators simply make it
  unreachable through the API (today it surfaces as an accidental 400
  carrying a raw `[quality-registry] …` engine message).

**Steps**

1. **Budget** — implement `attributePointsValid` (sum of the eight base
   primaries === 80, evaluated over merged data) as the **single home**:
   delete the duplicate inline budget block in `validateRPGRules` (its
   negative-XP guard stays); update the schema `error` string to the
   exact-80 phrasing. Enforced at creation (existing cross-field pass) and
   on any PATCH touching `attributes.primary.*` (new merged-data pass).
2. **Health** — implement `currentHealthValid`:
   `0 ≤ toughness.current ≤ toughness.max` against `allData`. At creation
   `toughness.max` may be absent pre-recalc (server-controlled defaults
   are skipped after step 3), so the upper bound applies only when `max`
   is present; the engine clamp remains the backstop. Note: the validator
   is creation-reachable only today — `toughness.current` is
   `derived: true`, so PATCH rejects it for every role; flipping health
   writability is Phase 7 territory and will pick this validator up for
   free.
3. **Derived-field stubs** — delete `defenseValid` / `painThresholdValid` /
   `corruptionThresholdValid` and their schema `validate:` references;
   remove the six `attributes.secondary.*` entries from `skipOnCreation`'s
   creation-override list; mark the six secondary derived fields
   (`toughness.max`, `defense`, `armor`, `painThreshold`,
   `corruptionThreshold`, `corruptionMax`) `serverControlled: true`.
   Verify `generateDefaultCharacter` + create-time recalc still produce a
   complete character (server-controlled fields drop out of the generated
   defaults; recalc fills all six before first save).
4. **Catalog-membership validators** (strict; resolved at
   `DEFAULT_LOCALE`):
   - `equipment.weapons[]` — structural shape (`id` / `name` / `type` /
     `damage` / `qualities` with correct types) + `id` resolves in
     `reference/weapons` + every `qualities[]` id resolves in the quality
     registry (designed 400 naming the offending id, pre-recalc).
   - `equipment.armor.body` / `.plug` — `null` allowed; otherwise `id`
     resolves in `reference/armor`, the entry's `slot` matches its
     position, `qualities[]` resolve in the registry.
   - `traits[]` — `id` resolves in merged abilities+spells;
     `tier ∈ {novice, adept, master}`; `source` consistent with where the
     id resolved.
   - `talents[]` — `id` resolves in merged boons+sins; `level` is an
     integer within `1..levels` from the catalog entry; `source`
     consistent.
   - `rituals[]` — `id` resolves in `reference/rituals`; `level` integer
     ≥ 1.
   - `traditions[]` — each id resolves in `reference/abilities`
     (traditions are curated ability ids; the deferred-tasks "separate
     file?" question stays formally parked).
   - `combat.carried` — already enforced by `validateCombatCarried` since
     Chunk D (tuple shape, index range, own-slot rules); no change,
     formally noted as done.
   - **Object-parent `null` rejection** (H.1 / NB-36 residual): an
     explicit `null` on an object-typed field passes the `typeof` type
     check (`typeof null === "object"`), so a PATCH can null out parents
     like `equipment` or `attributes` wholesale. Reject `null` for
     object-typed fields unless the schema marks them nullable (the two
     armor slots, which legitimately clear to `null`).
   - `character.effects[]` — **explicitly out of scope**: the raw
     warn-and-skip boundary is the NB-35 design; no input-shape validation
     is added.
5. **Tests** — per rule: happy path + rejection naming the offending id;
   budget at creation and on PATCH (a rebalance keeping 80 passes, 79/81
   reject); health range; creation payload seeding secondary values →
   warning + ignored (not 400); regression: PATCH with a bogus quality id
   → designed 400 pre-recalc (previously reached the engine throw).
6. **UI verification** (the user's "carefully test" rider + the
   ui-browser-verify rule): exercise the creation form and an edit
   round-trip in-browser; confirm the `serverControlled` flip didn't break
   form rendering, submission, or the SSE round-trip.

**Verification**

1. `npm test` green with the new validator suites; typecheck green.
2. 400s: over/under-budget (both paths), current > max at creation,
   unknown weapon / armor / trait / talent / ritual / tradition id,
   unknown quality id (pre-recalc), non-`own` / null own slot
   (pre-existing).
3. Creation with client-supplied secondary values succeeds with warnings;
   the stored values are recalc-owned.
4. In-browser creation + edit round-trip verified.

### H.3 — `natural_weapon` unification (code, medium — closes NB-45)

> **✅ Completed 2026-09-01.** 698 / 698 tests (+1 net) + typecheck green.
> Landed as outlined; notes against the steps:
>
> - **Projection shape settled:** `lookupWeapon` returns the engine
>   `Weapon` shape (`id`/`name`/`type`/`damage`/`qualities`, plus
>   `effects` when authored non-empty) — catalog-only presentation
>   fields (`description`, `cost`) are dropped (YAGNI). Returned objects
>   are shared registry instances; both consumers clone before storing.
> - **Injection mirror:** `initDefaultSeeds({ lookupWeapon })` lives in
>   `src/models/schema-utils.mts` (re-exported via `#models`), wired in
>   `src/app.mts` right after `initCharacterService` — same
>   throw-if-uninitialised pattern.
> - **Engine synthesis throws** (not warn-and-skip) when the registry
>   lacks `natural_weapon`: production `loadRegistry()` fail-fasts at
>   startup, so a miss at recalc time can only be a mis-built stub.
> - **Guards replaced, not just dropped:** the E.0.5 snapshot test became
>   a drift guard deep-equaling the creation seed against the projection
>   of the REAL catalog record; `reference-lint` gained a per-locale
>   `natural_weapon` anchor check (NB-45, beside the NB-39 `own` check);
>   the POST /characters API test now asserts the own slot derives
>   `baseDamage: 4` + `short` end-to-end.
> - **Digest lockstep: no-op confirmed** — `docs/rpg-engine-semantics.md`
>   makes no bare-hand damage claim (its one `natural_weapon` mention,
>   "creation default", stays true).
> - Stored dev characters wiped via `hard-delete.mts --all` (one
>   character carried the retired damage-0 seed; no migration per the
>   test-data policy). NB-45 moved to `resolved.md` (its "weapons[2]"
>   index slip corrected in the archived entry).

**Steps**

1. **Registry extension** — add `lookupWeapon(id)` to the `Registry`
   interface (`registry-types.mts`); `loadRegistry` pre-indexes
   `reference/weapons` at `DEFAULT_LOCALE` and **fail-fasts if
   `natural_weapon` is absent** (the engine's own-slot synthesis depends
   on it). Update `test/helpers/registry.mts`: `createInMemoryRegistry` /
   `emptyRegistry` seed the catalog-shaped `natural_weapon`;
   `BASE_QUALITIES` gains `short`.
2. **Schema default via injection** — replace the inlined
   `equipment.weapons.default[0]` copy: `models/` gets a startup-injected
   weapon lookup (mirroring `initCharacterService` — models must not
   import `#rules`), wired from `src/app.mts` after `loadRegistry()`;
   `generateDefaultCharacter` resolves the seed through it. Test helpers
   seed the injection.
3. **Engine fallback** — `deriveCombatSlots` synthesizes the own-slot
   anchor via `registry.lookupWeapon("natural_weapon")`; delete the
   `NATURAL_WEAPON` constant.
4. **Tests** — drop the temporary E.0.5 snapshot test in
   `test/validation.test.mts`; replace it with an assertion that the
   creation default deep-equals the catalog record (locks the wiring, not
   a copy). Update `test/helpers/fixtures.mts` seeds to the catalog shape
   (damage 4, `["own", "short"]`, "Natural Weapon"); adjust defaults-based
   assertions (tests that author explicit weapons are unaffected).
5. **Digest lockstep** — bare-hand damage is rule-backed, gameplay-visible
   behavior: check the relevant `ES §` entry and update it in the same
   commit if it states the old value (per the rpg-engine-semantics
   lockstep rule).
6. Close **NB-45** (entry moves to `resolved.md`, same commit).

**Verification**

1. `npm test` + typecheck green.
2. No inlined `natural_weapon` object literal remains under `src/` — the
   schema default and the engine fallback both resolve through the
   catalog.
3. A freshly created character's own slot derives `baseDamage: 4` and
   `qualities` including `short` end-to-end (creation → recalc → API
   response).

### H.4 — Tracker & bookkeeping reconciliation (trackers / roadmap / memory)

> **✅ Completed 2026-09-01.** Pure tracker / roadmap / memory
> reconciliation — no code changes. Notes against the outline:
>
> - **Steps 1–2 landed as listed.** Thirteen entries archived to
>   `resolved.md` with resolution date + chunk (NB-1–6, NB-10, NB-12,
>   NB-13, NB-19–22); NB-14 slimmed to the runes-only orphan and kept
>   open. `engine.md` now holds exactly NB-33, NB-34, NB-35, NB-47 and
>   slimmed NB-14.
> - **Step-4 nit:** the roadmap table already carried a Chunk I row —
>   only J was missing. Beyond the letter of the step, the
>   Phase-5-relocation bullet for `rpgValidators` gained its shipped
>   marker (H.2).
> - **Step 5 went wider than the four listed bullets** — the refresh
>   applied the memory-curation rules wholesale: deleted everything
>   duplicated from `copilot-instructions.md` (import ordering, ADR
>   digest, deployment, client architecture), the shipped/stale
>   post-Chunk-F section (cites of the deleted `audit-reference.mts`,
>   the pre-G.1 `lookupTalent` stub note), and point-in-time status
>   lines. What remains: canonical-home pointers, verified gotchas,
>   working-style preferences, environment facts.
> - The step-5 caveat about `nagara-rpg-rules.md` was already moot — the
>   digest plan shipped & archived 2026-09-01 and that memory file is
>   long deleted; only the cross-repo sibling pointer lines remain (with
>   the digest plan, not H).
> - **Deliberately not done:** no NB filed for the `#character-name`
>   pointer-interception quirk from H.2's UI pass — it stays folded into
>   Chunk I's view rework, where it is already recorded.

**Steps**

1. **Close the Chunk-C/E bookkeeping debt** in `.github/bugs/engine.md` →
   `resolved.md` (entries keep their ids): NB-1, NB-2, NB-3, NB-4, NB-5
   (Chunk C engine side + G.1 data wiring), NB-6, NB-19, NB-20, NB-21,
   NB-22 — each with resolution date and chunk reference.
2. **Reconcile the stale entries:** NB-10 (both files fully implemented —
   close citing C + G.1); NB-13 (Chunk F shipped the normalization —
   close); NB-12 (close-by-decision: character-state conditions are
   deliberately out of engine per the Cross-Cutting Notes / the digest's
   out-of-engine section; the surviving conditional thread is NB-34's);
   NB-14 (slim to the runes-only orphan and keep open, pointing at the
   deferred-tasks orphan note — runes stay formally parked per the
   2026-08-07 ruling).
3. **`.github/plans/deferred-tasks.md`** — no section-status work left
   (the 2026-07-01 audit already marked §1 shipped / §3 subsumed).
   Annotate the status summary with the 2026-08-07 ruling that the two
   orphans (runes, traditions file) deliberately stay parked, so the file
   stops looking actionable.
4. **`docs/roadmap.md` Phase 6** — fix "8 chunks (A–H)" → A–J; refresh the
   Chunk Status table (G → G.1/G.2 ✅ with dates, drop the retired
   "inheritance resolver" framing, F status line updated, H → H.1–H.5
   rows, I / J rows); record the honest completion posture:
   **engine-complete at H; Chunks I (usability) and J (real-data suite)
   outstanding** — Phase 6 is not marked done.
5. **Repo memory** — refresh `/memories/repo/character-builder.md`
   (validators real, `natural_weapon` unified, `RawEffect` posture,
   tracker state). `nagara-rpg-rules.md` is **not** touched here — its
   deletion belongs to the digest plan's pending step 4.

**Verification**

1. `npm test` green — the `bug-anchors` lint passes (every `NB-<n>` cite
   resolves; no duplicate ids after the moves).
2. `engine.md` holds only genuinely-open bugs (NB-33, NB-34, NB-35,
   NB-47, slimmed NB-14); `resolved.md` gained the archived entries.
3. The roadmap chunk table matches this plan.

### H.5 — Contract docs: data-contracts & sibling integration (docs)

**Steps**

1. **`docs/data-contracts.md` §1.1 reconciliation** (the Action shape,
   conditional-secondary, and talent-stance blocks are already current
   from G.2 — this is a targeted pass, not a rewrite):
   - `EffectTarget` table: 5-kind → **8-kind** (add `primary`,
     `magicAttribute`, `initiativeAttribute`), aligned with ADR-015 + its
     amendment anchors.
   - `secondary` row: the discriminator key is **`stat`** (not
     `attribute`); values `toughness | defense | armor | painThreshold |
     corruptionThreshold | corruptionMax` (drop the nonexistent `pain` /
     `xpMax` / `toughness.max`).
   - `armorQuality` row: the gate is `condition?: ArmorCondition[]`
     (ADR-015 §3f), not `slot?`.
   - Vocabulary intro: "reference files in `data/`" → `reference/`.
   - `setBase` value: a primary-attribute name (string) — not
     `string | number`.
   - Effect-object framing aligned with H.1's outcome (`priority` gone;
     `duration` engine-ignored, sibling-owned).
   - Point at `ES §` anchors where the digest owns the system fact
     (digest = why, data-contracts = wire shape; don't restate).
   - Document the H.2 validation contract: strict catalog membership and
     the 400 vocabulary.
2. **`docs/addon-integration.md`:**
   - §8 Effect Object Schema — rewrite: typed `EffectTarget` / per-phase
     `EffectModifier`, no `priority`, no priority-ordered processing (drop
     the `Core/Effects.lua` pipeline-ordering instruction — effects arrive
     engine-resolved; the addon consumes **derived outputs**, not raw
     pipelines).
   - §3 vs §2.5 `schemaVersion` contradiction — the current version is
     **2** everywhere (the server stamps 2).
   - §2.5 export shape — surface the derived contract: per-slot derived
     fields (`attackAttribute`, `baseDamage`, `bonusDamage`, `qualities`,
     `flags`), top-level `flags`, `specialAttacks` / `reactions`,
     `magicAttribute` / `initiativeAttribute`,
     `attributes.primaryEffective`.
   - §9 trait shape — `source` (not `category`); tier/level split per
     data-contracts §1.2.
   - 3-slot semantics, no `combat.active`, `appliesTo` predicate
     semantics, weapon-swap-is-sibling-side, declarative actions (the
     original step-5 content).
   - **No digest pointer line** — that insertion belongs to the digest
     plan's step 5.
3. **`docs/bot-integration.md`** — same pass: 3-slot model, derived
   collections, declarative actions, no `combat.active`; bot writes must
   use catalog ids (H.2's strict membership is now part of the write
   contract).
4. **Chunk-closing stale-vocabulary sweep** (absorbs the original
   verification #3): grep `docs/`, `src/`, `public/` for `combat.active`,
   `bonusDamage: number[]`, dotted-path effect targets, and
   `add` / `mul` / `set` verbs — ADRs, `resolved.md`, and `done/` plans
   are exempt as historical context.

**Verification**

1. `npm test` green (`adr-anchors` lint over the new cites).
2. Stale-vocabulary grep clean outside historical context.
3. `schemaVersion` consistent (2) across the addon doc and the server.
4. Both sibling docs describe the v2 export surface including derived
   fields; no doc instructs siblings to run effect pipelines.

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
7. **End-to-end manual test** (absorbs the manual verification deferred
   from Chunk G.2): create a fresh character via UI,
   add a weapon to `equipment.weapons[]`, see it appear in the
   slot dropdown, assign it to slot 0, see derived `baseDamage` /
   `attackAttribute` update, add a trait, and confirm the registry-driven
   derived outputs populate — per-slot combat values, top-level `flags`,
   `specialAttacks`, and `reactions`. (Chunk G.1 wired the registry so
   these compute; Chunk I is the first point they're reachable through
   the UI.)
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
  and re-call recalc. `recalculate` deliberately never prunes
  `character.effects[]` from the result.
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
I blocks on Chunk H.2 (validators must exist before pickers can rely on
them) but can begin the per-component pickers (steps 2–6) opportunistically
as soon as the matching schema field is stable — `equipment-list` in
particular can ship right after E since `equipment.weapons[]` is already
final.

Suggested execution: A → B → C → D → E → F.0 → G (registry + tests landing
first; lint-over-real-data turned on once F finishes) → H → I → J. F runs
independently in user time after A and F.0 ship. Chunk I closes Phase 6
with a manually usable app; Chunk J locks the catalog↔engine contract
once both have stabilized. J's Layer 1 (per-entry spot tests) may ride
alongside G's reference-lint if convenient — they share the registry
scaffold; Layers 2 and 3 wait for I.

The post-F amendment plan
([phase6-chunkF-postpass-amendment.md](done/phase6-chunkF-postpass-amendment.md))
sequences between F and G — its 11 implementation steps add the engine
features the bulk authoring pass surfaced (`magicAttribute`,
`initiativeAttribute`, primary-attribute target, `setBase` conflict
policy, etc.). Treat it as Chunk F+ rather than a separate chunk number.

## References to sweep on completion

Code-side `TODO(<scope>)` cites that name this plan and must be removed
(with their citations) when the corresponding work ships. Added per the
docs-cleanup-plan Pass E reciprocal-obligation convention; the
docs-cleanup Pass H reconciliation gate checks this list.

- ~~**`TODO(trait-talent-registry)`**~~ — ✅ **removed in Chunk G.1**
  (2026-07-04). The production loader (`loadRegistry` in
  `src/rules/registry.mts`) replaced the stub; all five sites
  (`src/app.mts`, `src/rules/registry.mts`, `src/rules/registry-types.mts`,
  `src/rules/effects.mts`, `test/helpers/registry.mts`) are cleared.
- ~~**`TODO(weapon-inheritance)`**~~ — ✅ **deleted in Chunk G.2**
  (2026-07-10). The engine never inlines weapon stats into actions — the
  declarative fields (`damageBonus` / `ignoresArmor` / `appliesTo`) ride to
  sibling apps verbatim. Site was `src/rpg-types.mts`; the JSDoc was
  reframed declarative and the TODO removed.
