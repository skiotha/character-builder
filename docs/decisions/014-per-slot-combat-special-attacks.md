# ADR-014: Per-Slot Combat, Special Attacks & Reactions

**Status:** Accepted
**Date:** 2026-04-22
**Deciders:** Project owner + Copilot design session
**Related:** [ADR-010](010-effect-resolution-pipeline.md) (Effect Resolution Pipeline),
[ADR-015](015-typed-effect-targets-final.md) (Typed Effect Targets — Final Vocabulary)

## Context

The current `Combat` shape on `Character` has three problems that block the Phase 6 engine rework:

1. **Single-stat fanout.** `combat.attackAttribute`, `combat.baseDamage`, `combat.bonusDamage` are scalars. Real characters wield more than one weapon at a time, and per-weapon abilities (Polearm, Marksmanship, Behemoth, etc.) need per-weapon derived stats.
2. **No place for special attacks or reactions.** Many abilities and spells grant new actions — invocable strikes (e.g. *Berserk*'s rage attack) and triggered responses (e.g. *Iron Fist*'s parry). Today these live as free-text descriptions on traits with no machine-readable home.
3. **`combat.active` is a presentation concern.** The website does not schedule combat turns; sibling apps do. Tracking which weapon is "currently active" inside the canonical character record forces every consumer to agree on a state machine the website cannot enforce.

Bug tracker items NB-7, NB-8, NB-9, NB-23 (now resolved — archived in [`.github/bugs/resolved.md`](../../.github/bugs/resolved.md)) all point at the same root cause: combat derivation cannot express per-weapon results.

## Decision

### 1. Three-slot carried-weapons model

`Combat.carried` is a fixed-length tuple of three slots:

```ts
combat.carried: [Slot | null, Slot | null, Slot]
//                ^slot 0       ^slot 1       ^slot 2 (required)
```

- **Slot 0** — primary carried weapon. Nullable.
- **Slot 1** — secondary carried weapon. Nullable.
- **Slot 2** — *non-disarmable* weapon. **Required.** Must reference a weapon whose `qualities[]` contains `"own"` (natural weapons, body-mounted weapons). On character creation, defaults to `natural_weapon`.

Each `Slot` references a weapon by index into `equipment.weapons[]`:

```ts
interface Slot {
  weaponIndex: number;            // index into equipment.weapons[]
  attackAttribute: PrimaryName;   // derived
  baseDamage: number;             // derived
  bonusDamage: number;            // derived (additive across all sources)
  qualities: string[];            // derived (weapon's qualities + grants − removals)
  flags: EffectFlag[];            // derived (per-slot flag set)
}
```

`equipment.weapons[]` is unchanged in capacity — characters can own any number of weapons; `combat.carried` selects three of them.

### 2. No `combat.active`

The canonical character record describes what a character *carries*, not what they are *doing*. Sibling apps (addon, bot) track active-weapon state at gameplay time using their own session state.

### 3. Combat phase fans out per slot

The rules engine's combat phase runs once per non-empty slot. The slot's weapon is matched against each combat-targeted effect's `appliesTo` predicate (see [ADR-015](015-typed-effect-targets-final.md)). Effects that match contribute to that slot's derived fields; non-matching effects are
ignored for that slot.

This makes "Polearm grants +d6 to polearm-typed weapons" naturally expressible: the predicate is `{ kind: "type", values: ["polearm"] }`, slot 0 matches if it holds a polearm, slot 1 matches independently.

### 4. Derived `SpecialAttack[]` and `Reaction[]`

Two new derived collections on `Character`, populated by the engine and read-only to clients:

```ts
interface Action {
  /**
   * REQUIRED stable identifier (see Item 9 below). Locale-independent.
   * Used as the rewrite key: same id at a higher tier replaces the
   * lower; different ids coexist.
   */
  id: string;
  name: string;
  trigger: TriggerKind;
  attackAttribute?: PrimaryName;
  damage?: string | number;        // dice notation or flat value
  effects?: ResolvedEffect[];      // per-use effects applied on resolution
}

type SpecialAttack = Action & { trigger: "manual" };
type Reaction      = Action & { trigger: Exclude<TriggerKind, "manual"> };
```

> **History note:** the original ADR draft included a structured
> `source: { kind, id, tier }` field on `Action`. It was never read
> by the engine and was dropped in Item 9 (2026-05) in favour of the
> required `id` as the dedupe key. Sibling apps that need provenance
> can recover it from the trait list itself.

> **Post-Chunk-F amendment (2026-05-19, amendment Items 1, 6, 8, 12).**
> `Action` gained five optional declarative fields:
>
> - `damageBonus?: number` — flat bonus added on top of the carrying
>   slot's inherited base damage (Backstab pattern). Requires non-empty
>   `appliesTo` to scope which slots the bonus fires on.
> - `ignoresArmor?: boolean` — bypasses target armor. `manual` triggers
>   only.
> - `inflicts?: string[]` — status ids the action applies to its target.
>   Validated by `scripts/audit-reference.mts` against
>   `reference/statuses.{en,ru}.json` (a data-driven registry, *not* a
>   `StatusKind` TypeScript union). Engine declares; sibling combat
>   resolvers own duration, stacking, and saves — same lifecycle policy
>   as `EffectFlag`.
> - `isFree?: boolean` — does not consume the action economy. `manual`
>   triggers only. Engine carries the flag verbatim; **no derived
>   `combat.freeAttacks` counter** is computed. Sibling apps sum free
>   attacks themselves (typically one per turn, ability-modified).
> - `appliesTo?: WeaponPredicate[]` — narrows which carried slots an
>   action applies to (same vocabulary as effect `appliesTo`).
>   `[{ "kind": "any" }]` is the canonical "every slot" form for
>   actions whose semantics are slot-bound; omit on innate / monster
>   attacks. Required when `damageBonus` is present.
>
> Engine consumption is **declarative-only** in the post-Chunk-F
> landing: the fields round-trip through the catalog and reach sibling
> apps verbatim. Per-slot inheritance resolution at recalc time
> (inlining the matched slot's `damage` / `attackAttribute` when
> omitted) is the remaining Item 1 engine work, scheduled against the
> Chunk G production registry landing.

**Distinction is purely semantic** — same shape, two collections:

- `trigger === "manual"` → `SpecialAttack` (player-invoked on their own turn).
- Any other trigger → `Reaction` (fires automatically on the named event).

The engine populates both lists from registry lookups; sibling apps render them in their own UI surfaces (action bar vs. reaction list).

### 5. Spell tier shape gains action metadata

Spell tiers (`novice`, `adept`, `master`) gain optional fields on the tier object directly:

```jsonc
{
  "tiers": {
    "novice": {
      "description": "...",
      "attackAttribute": "cunning",
      "damage": "1d6",
      "trigger": "manual",
      "effects": [ /* ResolvedEffect[] */ ]
    }
  }
}
```

A spell tier with `trigger` set is promoted to a `SpecialAttack` (or `Reaction`) by the registry. Spells without `trigger` are passive effect sources, like abilities.

**No `cost` field on tiers.** Corruption cost is computed by sibling apps from the character's `traditions` vs. the spell's tags — it is not part of the canonical character schema.

### 6. Tier stacking is additive

A character with `{ id, tier: "master" }` collects effects, special attacks, and reactions from `novice` + `adept` + `master`. Each tier is authored with **only the new effects it introduces** — higher tiers extend lower ones. The registry's `lookup(id, tier)` flattens all tiers up to and including the requested one.

### 7. No effect cancellation across tiers

The engine has no mechanism to cancel an effect granted by a lower tier. This forces a clean authoring discipline:

- *Berserk-novice's* "Defense cap 5 during rage" is **re-tiered as Tier C narrative.** Rage is a temporary toggle anyway, not a permanent character modification; sibling apps can apply the cap when rage is active. *Berserk-novice's* `+d6` melee `bonusDamage` stays Tier A.
- This eliminates the only known cancellation case in the catalog and keeps the engine purely additive.

### 8. Slot 2 invariants

The validator enforces:

- `combat.carried[2]` is **never null**.
- `combat.carried[2].weaponIndex` references a weapon whose `qualities[]` contains `"own"`.

Three weapons currently carry the `"own"` quality: [`natural_weapon`](../../data/weapons.en.json), `war_claws`, `heels`.

### 9. Action rewrite by id

`Action.id` is a required string and is the **rewrite key** during the
engine's collection step (`collectActions` in
[`src/rules/derived.mts`](../../src/rules/derived.mts)):

- The registry's `lookupTrait(id, tier)` returns
  `specialAttacks[]` and `reactions[]` in tier-ascending order
  (novice → adept → master). The contract is documented on
  `TraitLookupResult` in [`src/rules/registry-types.mts`](../../src/rules/registry-types.mts).
- The engine iterates that order and writes into a `Map<id, Action>`.
  `Map.set` is last-write-wins, so a higher-tier entry with a shared
  `id` naturally replaces the lower-tier version. Different ids
  coexist.

Result: same-id at higher tier is the documented "rewrite this
action" pattern (e.g. *Intrigues*'s `intrigues-backstab` going
`damage: 10 → 12 → 14` across novice/adept/master). Same-id across
**different** parent abilities/spells is undefined behaviour
(last-trait-processed wins) and is flagged by the
`scripts/audit-reference.mts` lint as an authoring error.

**Engine declares; siblings consume.** Sibling projects (Discord
bot, WoW addon) read `character.specialAttacks` / `character.reactions`
verbatim — they do not run their own dedupe. Anyone changing the
collection step must preserve the rewrite-by-id semantic.

**Talents and equipment do not contribute actions today.** The hook is
deliberately limited to `character.traits[]`. Artifact actions are
YAGNI until a concrete authoring need lands.

## Stable anchors

Code cites these with `ADR-014 §<anchor>`. `test/adr-anchors.test.mts`
asserts every such citation resolves to a row below. Renaming or
renumbering a listed anchor is a breaking change for those citations.

| Anchor | Rule |
| --- | --- |
| `§action-rewrite` | §9 — same-`id` actions dedupe last-write-wins across tiers (master > adept > novice); cross-parent id collisions are an authoring error. |
| `§inheritance-fields` | `Action` optional `damageBonus` / `ignoresArmor` / `appliesTo` for per-weapon inheritance (authoring shape locked; engine runtime pending — `TODO(weapon-inheritance)`). |
| `§inflicts` | `Action.inflicts[]` is a `string[]` of status ids; statuses are opaque tokens to the engine, resolved against `reference/statuses.*`. |
| `§is-free` | `Action.isFree` is a boolean and may be `true` only on `trigger: "manual"` actions. |
| `§toughness-write` | `secondary.toughness` effects write the single `.max` value (stat is plain `"toughness"`, never `"toughness.max"`). |
| `§opportunistic-effects` | boons / sins may carry a top-level `effects[]` array, applied via `collectAllEffects` → `lookupTalent`. |

## Consequences

**Positive**

- Per-weapon derived stats become first-class. Polearm-vs-Marksmanship-vs-Behemoth interactions stop being a `combat.bonusDamage` concatenation hack.
- `SpecialAttack[]` / `Reaction[]` give sibling apps a stable contract for rendering invocable abilities — no string parsing of trait descriptions.
- Slot 2 + the `"own"` quality guarantee every character has a fallback weapon that cannot be disarmed.
- Removing `combat.active` removes a source of cross-project drift.
- Additive-only stacking is simple to reason about and removes the only case where data shape would otherwise need a "cancellation" mechanism.

**Negative**

- Schema migration is breaking. `combat.weapons[]` and the scalar `attackAttribute` / `baseDamage` / `bonusDamage` fields go away. Existing characters in `data/characters/` are wiped during Chunk D — no migration code path.
- Sibling integration docs need updates (no `combat.active`, new derived collections, slot-2 contract). Tracked in Chunk H.

**Acceptable**

- Three slots is fixed by design. If a future weapon style requires four, the tuple grows; no consumer should hard-code "exactly three."
- `equipment.weapons[]` may legitimately contain more than three entries; inventory and carried are decoupled.

## Implementation chunks

This ADR is implemented across Phase 6 chunks B–H per
[`.github/plans/phase6-plan.md`](../../.github/plans/phase6-plan.md):

| Aspect                         | Chunk |
| ------------------------------ | ----- |
| Reference relocation           | B     |
| Typed pipeline foundation      | C     |
| Schema migration + UI          | D     |
| Per-slot fanout in engine      | E     |
| Effect-data normalization      | F     |
| Registry wiring                | G     |
| Validators + sibling docs      | H     |

See also: [docs/reference-authoring.md](../reference-authoring.md) for the practical authoring guide that consumes this decision.
