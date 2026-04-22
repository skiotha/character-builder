# ADR-015: Typed Effect Targets — Final Vocabulary

**Status:** Accepted
**Date:** 2026-04-22
**Deciders:** Project owner + Copilot design session
**Supersedes:** [ADR-011](011-typed-effect-targets.md) (Typed Effect Targets)
**Related:** [ADR-010](010-effect-resolution-pipeline.md) (Effect Resolution Pipeline),
[ADR-014](014-per-slot-combat-special-attacks.md) (Per-Slot Combat, Special Attacks & Reactions)

## Context

[ADR-011](011-typed-effect-targets.md) established the move from dotted-path string targets to a discriminated union, but left several pieces unresolved:

- The full set of target kinds was provisional (included a `CheckTarget` that no real ability used).
- Weapon-conditional effects had no representation. Per-weapon abilities like Polearm or Marksmanship could not express *which* weapons their bonuses apply to.
- Effect ordering relied on a numeric `priority` field, restating the problem [ADR-010](010-effect-resolution-pipeline.md) explicitly identified as a category error (math ordering is not a data-driven preference).
- Triggered actions (special attacks, reactions) had no target type.

The Phase 6 engine rework needs the vocabulary fixed before any code lands.

## Decision

### 1. `EffectTarget` is a five-kind discriminated union

```ts
type EffectTarget =
  | { kind: "secondary";     stat: SecondaryAttributeName }
  | { kind: "combat";        field: CombatSlotField }
  | { kind: "weaponQuality"; quality: string }
  | { kind: "armorQuality";  quality: string }
  | { kind: "flag";          name: EffectFlag };
```

`CheckTarget` is **dropped** — no ability in the catalog needs it.

`armorQuality` is kept because *Soldier-adept* removes the `"hampering"` quality from worn armor. The full worked example:

```jsonc
{
  "target":   { "kind": "armorQuality", "quality": "hampering" },
  "modifier": { "type": "remove" }
}
```

### 2. `WeaponPredicate` for combat-effect filtering

Combat-targeted effects carry an optional `appliesTo: WeaponPredicate[]` field. The predicate kinds are:

```ts
type WeaponPredicate =
  | { kind: "any" }
  | { kind: "type";    values: string[] }   // e.g. ["polearm", "heavy"]
  | { kind: "quality"; values: string[] }   // e.g. ["ranged"]
  | { kind: "id";      values: string[] };  // e.g. ["halberd", "pike"]
```

`subtype` is **not** a kind — weapons in the reference catalog have no `subtype` field, and `id` + `type` + `quality` cover every authoring case identified in the catalog review.

**Composition is AND.** All predicates in the array must match for the effect to apply to the slot. `appliesTo: undefined` or `[]` defaults to `{ kind: "any" }`. Within a single predicate, `values[]` is OR.

Example — Polearm-novice grants `+d2` to polearms:

```jsonc
{
  "target":    { "kind": "combat", "field": "bonusDamage" },
  "modifier":  { "type": "addFlat", "value": 2 },
  "appliesTo": [{ "kind": "type", "values": ["polearm"] }]
}
```

### 3. `EffectModifier` is per-phase shaped

```ts
type EffectModifier =
  | { type: "setBase";  value: PrimaryAttributeName }
  | { type: "addFlat";  value: number }
  | { type: "multiply"; value: number }
  | { type: "cap";      value: number }
  | { type: "remove" };
```

- `setBase` always carries a primary-attribute *name* (string), never a number. Closes weak-point bug #19.
- `remove` carries no value — semantics are determined by the target kind (`weaponQuality` / `armorQuality` / `flag`).
- The verb names are canonical. `add` / `mul` / `set` are not accepted. Closes weak-point bug #6.

**Why `remove` is safe under the additive-only pipeline:** in the authoring vocabulary, *negative* qualities (e.g. `hampering`, `unwieldy`, `cumbersome`) are **only ever removed**, and *positive* qualities are **only ever added**. There is no case where two effects fight over the presence of the same quality. This is documented as an authoring invariant in the data-contracts vocabulary section.

### 4. No `priority` field

Effect ordering is determined by the phase the modifier belongs to, in the fixed order defined by [ADR-010](010-effect-resolution-pipeline.md):

```
setBase → formula → addFlat → multiply → cap → flag/remove
```

Reference data may not carry a `priority` field; if present in legacy data, the engine ignores it. Closes weak-point bug #2.

### 5. `TriggerKind` enum (engine treats as opaque)

Triggered actions ([ADR-014](014-per-slot-combat-special-attacks.md)) carry a `trigger` field. The current draft enum:

```ts
type TriggerKind =
  | "manual"          // player-invoked → SpecialAttack
  | "onTurnStart"
  | "onTurnEnd"
  | "onAttacked"
  | "onDamaged"
  | "onCrit"
  | "onAllyDamaged"
  | "onSpellCast"
  | "onMovement"
  | "onSightOf"
  | "onRageStart"
  | "onRageEnd";
```

The engine **validates only that a value is one of the known set**. It attaches no semantics to any value beyond `"manual"` (which routes the action into `SpecialAttack[]` rather than `Reaction[]`). All other behavior is a sibling-app concern.

The enum is expected to evolve as Chunk F surfaces new patterns; adding or removing a value is a one-line change.

## Consequences

**Positive**

- Five-kind union is exhaustive and small enough for a `switch` statement to compile-time-check completeness across every applicator handler.
- `WeaponPredicate` makes per-weapon bonuses a first-class concept rather than a special case smuggled into target paths.
- Removing `priority` removes an entire category of silent-misordering bugs from authoring.
- `setBase`'s typed value field eliminates the ambiguity that made `value: number | string` necessary in the previous shape.

**Negative**

- All reference effect data needs to be rewritten to the new shape. This is the bulk-edit pass owned by Chunk F, gated by an authoring spec.
- The `armorQuality` kind only services one ability today (*Soldier-adept*). Justified — removing it would force that one effect into `flag` with a bespoke flag name, which is worse.

**Acceptable**

- `subtype` is dropped on the assumption that future authoring stays within `id` + `type` + `quality`. If a use case for subtypes appears, the union grows by one kind.
- The trigger enum drift is contained: it is opaque to the engine, so expanding it is non-breaking for engine code.

## Implementation chunks

| Aspect                                    | Chunk |
| ----------------------------------------- | ----- |
| `rpg-types.mts` definitions               | C     |
| Applicator switch on target kind          | C     |
| Weapon predicate matcher                  | E     |
| Effect-data rewrite                       | F     |
| Registry deserializer (validates targets) | G     |
| Sibling integration docs                  | H     |
