# RPG Engine Semantics — the system ↔ engine contract

> Canonical statement of the **RPG-system facts the engine encodes and must
> preserve**. The inclusion test: *if the game designer changed this fact,
> the engine would have to change too.* Audience: coding agents and
> developers here and in the sibling projects
> ([nagara-addon](https://github.com/skiotha/nagara-addon),
> [malizia](https://github.com/skiotha/malizia)), who consume the engine's
> output and employ the rules around it.

## How this document works

**Correspondence invariants** — the contract that keeps this document true:

1. **Membership.** An entry belongs here iff it is engine behavior
   that exists *because an RPG-system rule requires it*. Every major engine
   operation must name the rule behind it; an engine behavior with no rule
   is a smell, a rule with no engine behavior is either explicitly
   out-of-engine (§ Out of engine) or a tracked gap.
2. **Doc → reality.** Every behavior stated here resolves to code or to a
   tracked gap (`TODO(<scope>)` / `NB-<n>`). Spec may lead code only while
   the gap is tracked.
3. **Reality → doc.** Adding or changing rule-backed engine behavior updates
   this document in the same commit.

**Anchors & citing.** Every `ES §<anchor>` entry heading below is a stable
anchor. Cite from code, tests, ADRs, and docs as `ES §<anchor>`. Renaming an
anchor is a breaking change for citing code. They are not lit-enforced,
unlike `ADR-NNN §anchor` and `NB-<n>` cites, `ES` cites.

**What lives elsewhere.** This document states *what* the engine must honor
and *why* but it never restates mechanism or shape:

- Engine mechanism & data flow → the ADRs
  ([010](decisions/010-effect-resolution-pipeline.md),
  [013](decisions/013-domain-layer-mutation-gate.md),
  [014](decisions/014-per-slot-combat-special-attacks.md),
  [015](decisions/015-typed-effect-targets-final.md),
  [016](decisions/016-quality-registry.md)) and
  [architecture.md](architecture.md).
- Wire shapes & API → [data-contracts.md](data-contracts.md).
- Catalog authoring → [reference-authoring.md](reference-authoring.md).
- Full rule prose, lore, galleries → the [`rpg/`](../rpg/README.md) vault
  (canonical for rules-as-written); machine-readable data → `reference/*.json`.

---

## Gameplay loop (context)

*Orientation only — how the rules are used around the engine's numbers.
These facts have no engine counterpart, so the correspondence invariants and
the three-facet format do not apply here. This is a summary; the
[`rpg/`](../rpg/README.md) vault is canonical. Keep aligned with the vault
when the designer changes the loop.*

- **Core mechanic.** Almost every action or check is a **d20 roll-under
  test against a primary attribute**: roll ≤ attribute = success, with very
  few exceptions. Player strategy is attribute distribution — play to
  strengths, protect weaknesses.
- **Combat.** An attack is a d20 check against the attacking slot's
  `attackAttribute`; the defender's `defense` is the value an opponent must
  overcome to land a hit. Damage on a hit is the weapon's damage plus
  accumulated bonus damage; damage past the `painThreshold` inflicts
  penalties. Initiative rolls use `initiativeAttribute`; spell power rolls
  use `magicAttribute`.
- **Corruption.** Learning and casting spells accrues corruption.
  Temporary corruption clears over time; permanent corruption marks the
  character forever. Crossing `corruptionThreshold` / exhausting
  `corruptionMax` has severe in-fiction consequences. Holding a matching
  **tradition** reduces corruption from that school's spells. The engine
  derives the two thresholds (§ Attributes); all accrual bookkeeping is
  sibling-side (§ Out of engine).
- **Experience.** Characters earn XP in play (`experience.total` lifetime,
  `experience.unspent` spendable). Traits are bought by tier
  (novice < adept < master cost), talents by level (1–3), rituals at
  integer levels. Pricing and spending happen at the table; the engine only
  stores the numbers (§ Out of engine).

---

## Attributes

### ES §primaries — the eight primary attributes

- **Rule.** Eight primaries — `accurate`, `cunning`, `discreet`,
  `appealing`, `quick`, `resolute`, `vigilant`, `strong`. At creation each
  is 5–15 and the total spends exactly the 80-point budget (8 × 10 default).
- **Engine.** Validates the per-attribute range and the exact-80 budget on
  every write. The player-authored base (`attributes.primary`) is **never**
  mutated by the engine.
- **Where.** Range: `src/models/character.mts`; budget:
  `rpgValidators.attributePointsValid` in `src/models/character.mts`,
  fired through the cross-field pass at creation and on the merged-update
  pass in `src/models/validation.mts`; base-never-mutated: ADR-015 §3e.

### ES §primary-effective — enhanced primaries

- **Rule.** Traits and items may enhance or cap a primary attribute; every
  downstream rule (formulas, rolls) sees the enhanced value.
- **Engine.** `primary`-target effects (`addFlat` accumulates, smallest
  `cap` wins) run in their own phase **before** everything else, writing the
  server-controlled snapshot `attributes.primaryEffective`; all later stages
  read primaries through it.
- **Where.** `derivePrimaryAttributes` in `src/rules/derived.mts`;
  ADR-015 §3e, §primary-bucketing.

### ES §secondaries — derived secondary attributes

- **Rule.** Six secondaries derive from primaries (or equipment), each with
  a default source:

  | Secondary | Default source | Formula |
  | --- | --- | --- |
  | `toughness` (max) | `strong` | `max(strong, 10)` |
  | `painThreshold` | `strong` | `ceil(strong / 2)` |
  | `corruptionThreshold` | `resolute` | `ceil(resolute / 2)` |
  | `corruptionMax` | `resolute` | `resolute` |
  | `defense` | `quick` | `quick` |
  | `armor` | — (equipment) | body armor value |

- **Engine.** Recomputed from scratch on every save; effects then modify the
  formula output (§ Pipeline order). `toughness` effects write the single
  `.max` value; `.current` is player state clamped into `[0, max]`.
- **Where.** `SECONDARY_FORMULAS` + `clampValues` in
  `src/rules/attributes.mts`; ADR-014 §toughness-write.

### ES §setbase — re-pointing a derived value's source

- **Rule.** A trait may re-point which primary feeds a derived value (e.g.
  Defense from `discreet` instead of `quick`). When several re-points
  compete, **the highest-valued primary wins**, and an override can never
  leave the character worse off than the default.
- **Engine.** `setBase` candidates resolve default-inclusive max-by-primary
  against the post-effect snapshot, strict `>` so the default wins ties.
  Applies uniformly to `secondary`, per-slot `combat.attackAttribute`,
  `magicAttribute`, and `initiativeAttribute`.
- **Where.** `resolveSetBase` in `src/rules/setbase.mts`; ADR-015 §4a.

### ES §magic-initiative — roll-attribute pointers

- **Rule.** Spell power rolls against a character-level magic attribute
  (default `resolute`); initiative rolls against an initiative attribute
  (default `quick`). Traits may re-point either.
- **Engine.** `magicAttribute` / `initiativeAttribute` are server-derived
  `PrimaryAttributeName` pointers, `setBase`-only, resolved per ES §setbase;
  siblings read them at roll time. Spells have no per-spell attack
  attribute.
- **Where.** `deriveMagicAttribute` / `deriveInitiativeAttribute` in
  `src/rules/derived.mts`; ADR-015 §3, §spell-tier-actions.

---

## Pipeline order

### ES §phase-order — modifier math has one total order

- **Rule.** Modifier arithmetic is order-sensitive; the system guarantees
  one total order: source re-points happen before formulas, flat bonuses
  before multipliers, multipliers before caps, set-membership last.
- **Engine.** Fixed phase sequence enforced by code structure, never by
  data: `primary` → `setBase` → formulas → `addFlat` → `multiply` → `cap` →
  flags/set-membership → per-slot combat fanout → action collection →
  clamps. Within a phase, order is undefined and must be semantically
  order-independent. There is **no `priority` field**; legacy `priority` in
  data is ignored.
- **Where.** `recalculate` in `src/rules/derived.mts` (module header
  documents the sequence); ADR-010; ADR-015 §4.

### ES §recalc-on-save — derived state is never authoritative

- **Rule.** The sheet always reflects the rules: derived values are a
  function of base state and active effects, never independently stored
  truth.
- **Engine.** Every mutation through the domain layer triggers a full
  recalc; derived fields are server-controlled (client writes stripped).
- **Where.** `createCharacterService` wiring in `src/models/index.mts`
  (ADR-013); recalc entry `src/rules/derived.mts`.

---

## Effects

### ES §modifier-verbs — five semantic operations

- **Rule.** Every mechanical modifier in the system is one of five
  operations: re-point a source (`setBase`), add/subtract flat
  (`addFlat`, negatives allowed), scale (`multiply`), impose a ceiling
  (`cap`), or remove a set member (`remove`).
- **Engine.** The verb names are canonical and closed; the parser rejects
  anything else. Each verb maps to exactly one pipeline phase
  (ES §phase-order).
- **Where.** `EffectModifier` in `src/rpg-types.mts`; parser accept-sets in
  `src/rules/effects.mts`; ADR-015 §3.

### ES §effect-sources — one collection point, four sources

- **Rule.** A character's mechanics come from learned traits (abilities &
  spells, by `{id, tier}`), talents (boons & sins, by `{id, level}`),
  equipment (armor/weapon bespoke effects + their qualities), and persistent
  overrides (`character.effects[]`, DM- or sibling-authored). Learning is
  reference-based: the character stores the id, the catalog owns the
  mechanics.
- **Engine.** All sources merge in a single collection step before the
  pipeline runs; catalog misses warn-and-skip for character-authored data
  and fail fast for catalog data.
- **Where.** `collectAllEffects` in `src/rules/effects.mts`;
  `src/rules/registry.mts` (loader); ADR-010.

### ES §tier-stacking — trait tiers stack additively

- **Rule.** A trait at `master` grants everything `novice` and `adept`
  grant, plus its own additions. Higher tiers never cancel lower-tier
  grants.
- **Engine.** Registry lookups flatten all tiers up to the requested one;
  each tier is authored with only what it adds. There is **no effect
  cancellation across tiers** — the pipeline is purely additive
  (cancellation cases are re-tiered as narrative).
- **Where.** `lookupTrait` in `src/rules/registry.mts` (ADR-014).

### ES §tier-abc — the mechanization boundary

- **Rule.** Rule text normalizes into three tiers: **A** — fully mechanical
  (numeric modifiers, the engine computes); **B** — structured flags
  (advantage, immunities, knowledge — the engine tracks set-membership,
  siblings attach meaning); **C** — narrative (DM adjudication, the engine
  carries nothing).
- **Engine.** Tier A resolves through the numeric phases; Tier B through the
  flag phase (ES §set-membership); Tier C never enters the catalog's
  `effects[]`.
- **Where.** phase mapping in `src/rules/applicator.mts`; authoring
  guidance [reference-authoring.md](reference-authoring.md).

### ES §set-membership — flags and qualities are sets

- **Rule.** Flags, weapon qualities, and armor qualities are present-or-not
  facts, not numbers. Negative qualities are only ever removed, positive
  ones only ever added — no two effects fight over the same membership.
- **Engine.** `flag` / `weaponQuality` / `armorQuality` targets resolve in
  the flag phase: `addFlat` adds (numeric value ignored), `remove` removes.
  The engine computes the final sets; what a flag *does* is sibling-side.
- **Where.** `applyFlag` in `src/rules/applicator.mts`; ADR-015 §3a.

### ES §armor-conditions — armor-state gating

- **Rule.** Some bonuses apply only under an armor condition — wearing a
  quality, a specific piece, a filled slot, or no armor at all.
- **Engine.** `condition: ArmorCondition[]` gates `secondary` and
  `armorQuality` effects (AND across entries, OR within one entry's
  `values[]`; per-piece evaluation for `armorQuality`). Effect-granted
  armor-quality changes land in the `qualitiesEffective` overlay; authored
  `qualities` is never mutated.
- **Where.** `matchesArmorConditions` + `applyArmorQuality` in
  `src/rules/applicator.mts`; ADR-015 §3f.

### ES §conditional-secondary — weapon-conditional secondaries are a gap

- **Rule.** The system has bonuses like "+1 defense while wielding a staff"
  — a character-level secondary gated on a carried weapon.
- **Engine.** Unbuilt. A `secondary` effect carrying a weapon predicate is
  **skipped** (applying it unconditionally would bake a sometimes-true bonus
  into the aggregate); the predicate rides to siblings as documentary data.
- **Where.** Tracked gap **NB-34**; skip lives in `collectAllEffects`
  (`src/rules/effects.mts`).

### ES §quality-registry — qualities are the shared mechanics vocabulary

- **Rule.** A weapon/armor quality means the same mechanics wherever it
  appears; magnitude variants are distinct qualities (`fortified`,
  `fortified_2`, …).
- **Engine.** `reference/qualities.{en,ru}.json` is the single canonical
  source of each quality's effects (one flat namespace, EN structurally
  authoritative); item-level `effects[]` is bespoke-only. Unknown quality
  ids **throw at recalc**. The engine loads one locale and never branches
  on localized fields.
- **Where.** `loadRegistry` in `src/rules/registry.mts`; throw sites
  `buildSlot` (`src/rules/derived.mts`) and `collectAllEffects`
  (`src/rules/effects.mts`); ADR-016.
- **Known limitation:** an effect-*granted* quality is inert — its registry
  effects don't fire (single-pass collection). Authoring states both sides
  explicitly. Tracked as **NB-33**.

---

## Combat

### ES §carried-slots — three carried weapons, one undroppable

- **Rule.** A character fights with up to three carried weapons: main-hand,
  off-hand (both optional), and an **own** weapon (natural weapon, body
  mount) that can never be taken away. Inventory is unbounded; *carried*
  selects from it.
- **Engine.** `combat.carried` is `[Slot|null, Slot|null, Slot]`; the own
  slot is required and must reference a weapon carrying the `own` quality
  (creation default `natural_weapon`). There is **no `combat.active`** —
  which weapon is in use is sibling session state.
- **Where.** `validateCombatCarried` in `src/models/character.mts`;
  ADR-014.

### ES §per-slot-fanout — combat derives per weapon

- **Rule.** Weapon bonuses are weapon-scoped: "+d2 with polearms" applies to
  the slots holding polearms and no others. Each carried weapon has its own
  attack attribute (default `accurate`), base damage, bonus damage, and
  quality set.
- **Engine.** The combat phase runs once per non-empty slot; `appliesTo`
  weapon predicates (`any` / `type` / `quality` / `id`; AND across entries,
  OR within `values[]`) select the slots an effect touches.
  `attackAttribute` is `setBase`-only and resolves per ES §setbase. A
  weapon's own effects and qualities enter with implicit
  `appliesTo` = itself, so they never bleed across slots.
- **Where.** `deriveCombatSlots` in `src/rules/derived.mts`;
  ADR-014, ADR-015 §placement-table.

---

## Actions

### ES §actions-declarative — actions pass through, passives compute

- **Rule.** Traits grant invocable **special attacks** (used on your turn)
  and **reactions** (fire on a named event). Their live numbers depend on
  the weapon in hand *at that moment* — so they cannot be precomputed.
- **Engine.** Passive modifiers are engine-computed (ES §per-slot-fanout);
  actions are **declarative pass-through**: `damageBonus`, `ignoresArmor`,
  `inflicts`, `isFree`, `appliesTo` reach siblings verbatim and the engine
  never inlines weapon stats. Siblings resolve them against the live
  carried weapon at play time. `isFree` is valid on `manual` triggers only.
  A higher tier re-declaring the same `Action.id` **rewrites** the
  lower-tier version; different ids coexist. Only traits contribute actions
  today (talents and equipment do not).
- **Where.** `collectActions` in `src/rules/derived.mts`; ADR-014
  §action-rewrite, §inheritance-fields, §is-free.

---

## Triggers & statuses

### ES §opaque-tokens — the engine validates membership, siblings own meaning

- **Rule.** Reaction triggers ("on hit", "on new day", …) and inflicted
  statuses (stun, bleed, …) are gameplay-time concepts resolved at the
  table.
- **Engine.** Both are opaque tokens: triggers must belong to the
  `TriggerKind` set (only `"manual"` has engine semantics — it routes the
  action into `specialAttacks[]`); status ids in `Action.inflicts[]` must
  resolve against the statuses catalog. Duration, stacking, and saves are
  sibling-side.
- **Where.** Trigger membership set in `src/rules/effects.mts`; status-id
  lint `test/rules/reference-lint.test.mts` against
  `reference/statuses.{en,ru}.json`; ADR-015 §5, ADR-014 §inflicts.

---

## Talents

### ES §talents — flags only, no level scaling

- **Rule.** Talents (boons & sins, levels 1–3) are mostly narrative
  color; the mechanical subset grants knowledge/resistance-style
  memberships.
- **Engine.** A talent contributes only its top-level `effects[]` (all
  `flag` targets today), identical at every level — numeric `level` is
  carried for siblings but never engine-scaled. Check-bonus talents carry
  no engine representation at all (Tier C); siblings key off "talent
  present + level".
- **Where.** `lookupTalent` in `src/rules/registry.mts`; ADR-014
  §opportunistic-effects; scaling/coverage gap tracked as **NB-47**.

---

## Out of engine

### ES §out-of-engine — deliberate non-goals, with owners

The engine deliberately does **not** compute the following; each has a
designated owner. Adding any of these to the engine is a contract change and
updates this document first.

| Not computed | Owner | Pointer |
| --- | --- | --- |
| Dice rolls (d20 checks, damage dice) | siblings / the table | ES §phase-order derives static values only |
| Character-state conditions ("while raging", "at low health", "while prone") | siblings gate at roll time (Tier C) | ES §tier-abc |
| Effect lifecycle — `duration` is ignored, expiry never pruned | siblings add/remove `character.effects[]` and re-save | drop site: `src/rules/effects.mts` |
| Corruption accrual & spell cost (traditions vs. spell school) | siblings compute; engine derives thresholds only | ES §secondaries; [data-contracts.md](data-contracts.md) |
| XP pricing & spending | the table; engine guards non-negativity only | `src/models/schema-utils.mts` |
| Action economy (free-attack counting) | siblings sum `isFree` grants | ADR-014 §is-free |
| Trigger & status semantics | siblings | ES §opaque-tokens |
