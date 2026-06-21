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

### 1. `EffectTarget` is an eight-kind discriminated union

```ts
type EffectTarget =
  | { kind: "primary";             stat: PrimaryAttributeName }
  | { kind: "secondary";           stat: SecondaryAttributeName }
  | { kind: "combat";              field: CombatSlotField }
  | { kind: "weaponQuality";       quality: string }
  | { kind: "armorQuality";        quality: string }
  | { kind: "flag";                name: EffectFlag }
  | { kind: "magicAttribute" }
  | { kind: "initiativeAttribute" };
```

`CheckTarget` is **dropped** — no ability in the catalog needs it.

`armorQuality` is kept because *Soldier-adept* removes the `"hampering"` quality from worn armor. The full worked example:

```jsonc
{
  "target":   { "kind": "armorQuality", "quality": "hampering" },
  "modifier": { "type": "remove" }
}
```

`magicAttribute` and `initiativeAttribute` are server-derived `PrimaryAttributeName` pointers used by sibling apps at roll time (§3c, §3d).

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

- `setBase` always carries a primary-attribute *name* (string), never a number. Closes NB-19.
- `remove` carries no value — semantics are determined by the target kind (`weaponQuality` / `armorQuality` / `flag`).
- The verb names are canonical. `add` / `mul` / `set` are not accepted. Closes NB-6.

**Why `remove` is safe under the additive-only pipeline:** in the authoring vocabulary, *negative* qualities (e.g. `hampering`, `unwieldy`, `cumbersome`) are **only ever removed**, and *positive* qualities are **only ever added**. There is no case where two effects fight over the presence of the same quality. This is documented as an authoring invariant in the data-contracts vocabulary section.

### 3a. Set-membership authoring convention

`weaponQuality`, `armorQuality`, and `flag` targets address *set membership*, not numeric state. The canonical authoring shape is:

- **Add** a value: `{ "type": "addFlat", "value": 1 }`
- **Remove** a value: `{ "type": "remove" }`

The applicator treats the numeric value of `addFlat` as **ignored** for these three target kinds — only the verb matters. `1` is the canonical literal so authoring stays uniform; other numbers are accepted but produce no different result. `multiply` and `cap` are not meaningful for set-membership targets and the registry deserializer (Chunk G) rejects them.

This convention keeps the `EffectModifier` union narrow (no separate `add` verb) while letting the applicator reuse the same `addFlat` handler dispatch for both numeric (`secondary`, `combat`) and set-membership targets.

### 3b. `attackAttribute` accepts `setBase` only

The combat target field `attackAttribute` is non-numeric — it names a primary attribute the slot rolls against (e.g. `"accurate"`, `"strong"`). Only the `setBase` modifier is meaningful for it. The registry deserializer (Chunk G) and the runtime parser (`src/rules/effects.mts`) reject `addFlat`, `multiply`, `cap`, and `remove` on `combat.attackAttribute`.

Per-slot default is `"accurate"` (set in `deriveCombatSlots`); a `setBase` effect overrides it. When multiple `setBase` effects compete on the same slot, resolution follows the universal max-by-primary rule documented in §4a.

### 3c. `magicAttribute` accepts `setBase` only

`magicAttribute` is a character-level server-derived `PrimaryAttributeName` consumed by sibling apps (Discord bot, addon) at roll time — it names the primary attribute spell power rolls against. The schema default is `"resolute"`; an authored `setBase` effect (e.g. *Leader-novice* shifting spell power to `appealing`) joins the candidate pool and resolution follows the universal max-by-primary rule (§4a) with the default included.

Accepted modifiers:

- `setBase` — value is a `PrimaryAttributeName`.

Rejected modifiers (parser returns `null` with a warn):

- `addFlat`, `multiply`, `cap` — the field is non-numeric.
- `remove` — not a set-membership target.

`appliesTo` is silently stripped with a warn — `magicAttribute` is character-level, not slot-level.

Worked example — *Leader-novice*:

```jsonc
{
  "target":   { "kind": "magicAttribute" },
  "modifier": { "type": "setBase", "value": "appealing" }
}
```

### 3d. `initiativeAttribute` accepts `setBase` only

`initiativeAttribute` mirrors `magicAttribute` for initiative rolls. The schema default is `"quick"`; an authored `setBase` effect (e.g. *Tactics-novice* shifting initiative to `cunning`) joins the candidate pool and resolution follows the universal max-by-primary rule (§4a) with the default included.

Accepted and rejected modifiers, and the `appliesTo` strip-with-warn behaviour, are identical to §3c.

Worked example — *Tactics-novice*:

```jsonc
{
  "target":   { "kind": "initiativeAttribute" },
  "modifier": { "type": "setBase", "value": "cunning" }
}
```

### 3e. `primary` accepts `addFlat` and `cap` only

The `primary` target kind addresses the eight base primary attributes (`accurate`, `cunning`, `discreet`, `appealing`, `quick`, `resolute`, `vigilant`, `strong`) and runs in its own pre-pipeline phase ahead of `setBase`. The engine writes the post-effect snapshot to `result.attributes.primaryEffective` (a sibling field of `primary`); all downstream stages — secondary formulas, override resolution, per-slot combat — read primaries via `readPrimary`, which pulls from `primaryEffective`.

`attributes.primary` is the player-authored 5–15 base and is **never** mutated by the engine. This preserves the round-trip invariant (save → load → recalc must not drift), keeps schema validation honest (the base stays in range), and lets the UI render "base + bonus = effective". `attributes.primaryEffective` is `serverControlled: true` — clients receive it for display but cannot write it; POST/PATCH bodies that include it are stripped before validation.

Accepted modifiers:

- `addFlat` — accumulates additively per stat.
- `cap`     — smallest cap wins per stat.

Rejected modifiers (parser returns `null` with a warn):

- `setBase`  — primary attributes have no meta-attribute to override.
- `multiply` — no authoring case in the catalog; would be a foot-gun.
- `remove`   — not a set-membership target.

Worked example — *Exceptional Attribute (strong) +1*:

```jsonc
{
  "target":   { "kind": "primary", "stat": "strong" },
  "modifier": { "type": "addFlat", "value": 1 }
}
```

`appliesTo` is silently stripped with a warn — primary attributes are character-level, not slot-level.

### 3f. Character-level effect gating via `condition`

`appliesTo` (§2) narrows **per-slot** combat effects to a subset of weapons. It does **not** apply to character-level targets like `secondary` or to armor-side `armorQuality` effects, which run once against the character / once per armor piece. To gate those, `ResolvedEffect` carries an optional `condition?: ArmorCondition[]` field whose entries AND-compose:

```ts
type ArmorCondition =
  | { kind: "armorQuality"; values: string[] }   // any equipped piece carries any of these
  | { kind: "armorId";      values: string[] }   // any equipped piece has one of these ids
  | { kind: "armorSlot";    values: ("body" | "plug")[] } // listed slot is non-empty
  | { kind: "noArmor" };                          // both slots empty
```

Accepted target kinds: `secondary` (character-level read), `armorQuality` (per-piece read; see below). The parser strips `condition` with a warn from any other target kind. Within a single condition's `values[]`, membership is OR-composed; across conditions, AND-composed.

Per-piece semantics for `armorQuality` targets: when `applyArmorQuality` iterates `body` / `plug`, each condition is evaluated against the current piece — `armorSlot` matches only when that piece's slot is in `values`, `armorQuality` reads only that piece's qualities, and `noArmor` always returns false (a piece exists). This keeps add/remove operations scoped exactly to the piece the authoring intent describes.

Worked example — *Combat Oils Novice* (`secondary.armor +4`, only when an oiled piece is equipped):

```jsonc
{
  "target":    { "kind": "secondary", "stat": "armor" },
  "modifier":  { "type": "addFlat", "value": 4 },
  "condition": [{ "kind": "armorQuality", "values": ["oiled"] }]
}
```

Worked example — *Demiurge Hands Master* (remove `hampering_2`, but only from the plug, and only if it actually carries it):

```jsonc
{
  "target":    { "kind": "armorQuality", "quality": "hampering_2" },
  "modifier":  { "type": "remove" },
  "condition": [
    { "kind": "armorSlot",    "values": ["plug"] },
    { "kind": "armorQuality", "values": ["hampering_2"] }
  ]
}
```

Implementation note — armor overlay: the engine writes per-piece add/remove results to `ArmorPiece.qualitiesEffective` (an optional, server-controlled overlay) and resets it from `qualities` at the top of every recalc. Authored `qualities` is never mutated. Quality-registry synthesis (§3a) for a piece's own qualities is auto-stamped with `condition: [{ kind: "armorSlot", values: [<piece>] }]` so a body piece's quality can never bleed onto the plug. Closes NB-31's remaining caveat (armor overlay) and the "armor-side `appliesTo` ignored" gap.

### 4. No `priority` field

Effect ordering is determined by the phase the modifier belongs to, in the fixed order defined by [ADR-010](010-effect-resolution-pipeline.md):

```
setBase → formula → addFlat → multiply → cap → flag/remove
```

Reference data may not carry a `priority` field; if present in legacy data, the engine ignores it. Closes NB-2.

### 4a. Universal `setBase` resolution (max-by-primary, default-inclusive)

Every `setBase` target kind — `secondary`, `combat.attackAttribute`, `magicAttribute`, `initiativeAttribute` — resolves competing candidates with one shared algorithm, implemented in `resolveSetBase(defaultName, candidates, primary)`:

1. The field's schema default is **prepended** to the candidate pool (when non-null).
2. The pool is reduced by max-by-primary against the post-effect primary snapshot (`attributes.primaryEffective`).
3. The comparison is strict `>`, so the default wins ties — an unfavourable override can never lower the chosen attribute below the default-driven value. Among non-default candidates, the first wins ties (stable).

`applySetBase` no longer picks a winner; it merely collects candidates by stat. Resolution happens after the primary phase so the post-effect primary snapshot is available, then again per-slot inside `deriveCombatSlots` for `combat.attackAttribute`, and once per derived attribute pointer in `deriveMagicAttribute` / `deriveInitiativeAttribute`.

The consequence for authoring: an ability that shifts a derived value to an alternate primary takes effect only when that alternate's effective value is *strictly greater* than the field's current best candidate. Three abilities are affected behaviourally vs the pre-G2 "last setBase wins" semantics: *Smoke and Mirrors-novice*, *Tactics-adept*, and *Sixth Sense-adept* all author `setBase` on `secondary.defense` and now coexist correctly on the same character.

### 5. `TriggerKind` enum (engine treats as opaque)

Triggered actions ([ADR-014](014-per-slot-combat-special-attacks.md)) carry a `trigger` field. The current draft enum:

```ts
type TriggerKind =
  | "manual"          // player-invoked → SpecialAttack
  | "onHit"
  | "onMiss"
  | "onContact"
  | "onProne"
  | "onAttacked"
  | "onCheck"
  | "onDodged"
  | "onAdvantage"
  | "onEnemyMovement"
  | "onAllyAttacked"
  | "onResisted"
  | "onSpellCast"
  | "onNewDay"
  | "onDamaged";
```

The engine **validates only that a value is one of the known set**. It attaches no semantics to any value beyond `"manual"` (which routes the action into `SpecialAttack[]` rather than `Reaction[]`). All other behavior is a sibling-app concern.

The enum is expected to evolve as Chunk F surfaces new patterns; adding or removing a value is a one-line change.

## Stable anchors

Code cites these with `ADR-015 §<anchor>`. `test/adr-anchors.test.mts`
asserts every such citation resolves to a row below. Both named anchors
and the frozen section numbers are listed; renaming or renumbering a
listed anchor is a breaking change for those citations.

| Anchor | Rule |
| --- | --- |
| `§3` | the eight-kind `EffectTarget` union and per-phase `EffectModifier` shaping (sub-points §3a–§3f). |
| `§3a` | set-membership convention — `weaponQuality` / `armorQuality` / `flag` use `addFlat` to add, `remove` to remove; numeric value ignored. |
| `§3e` | `primary` target kind: `addFlat` / `cap` only, runs in its own pre-pipeline phase writing `attributes.primaryEffective`. |
| `§3f` | character-level effect gating via `condition: ArmorCondition[]` (valid on `secondary` and `armorQuality` targets). |
| `§4` | no `priority` field — ordering is by phase (ADR-010); any legacy `priority` is ignored. |
| `§5` | `TriggerKind` enum; the engine validates membership only and attaches semantics solely to `"manual"`. |
| `§placement-table` | the `appliesTo` / `condition` accept-list matrix per target kind (engine-evaluated on `combat` / `weaponQuality`; documentary elsewhere). |
| `§primary-bucketing` | the `primary` pre-pipeline phase and its `primaryEffective` snapshot (see §3e). |
| `§spell-tier-actions` | per-spell `attackAttribute` is superseded by character-level `magicAttribute` (§3c); sibling apps read `character.magicAttribute`. |

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

See also: [docs/reference-authoring.md](../reference-authoring.md) for the practical authoring guide that consumes this decision.
