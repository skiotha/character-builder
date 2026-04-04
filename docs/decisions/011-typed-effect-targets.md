# ADR-011: Typed Effect Targets

**Status:** Accepted
**Date:** 2026-04-04
**Deciders:** Project owner + Copilot design session
**Related:** [ADR-010](010-effect-resolution-pipeline.md) (Effect Resolution Pipeline),
[ADR-009](009-schema-driven-rendering.md) (Schema-Driven Rendering)

## Context

Effects in the RPG engine need to specify _what_ they modify. A "setBase" effect on Defense targets a different field than an "addFlat" effect on bonus damage. The targeting system determines how flexible, safe, and maintainable the engine is.

### Current Approach: Dotted-Path Strings

Today, effects use dotted-path strings:

```jsonc
{
  "target": "attributes.secondary.defense",
  "modifier": { "type": "setBase", "value": "discreet" }
}
```

The applicator resolves these via generic `getNestedValue(character, path)` / `setNestedValue(character, path, value)` traversal functions in `src/models/traversal.mts`.

### Problems with Dotted Paths

1. **No compile-time validation.** Typo in `"atributes.secondary.defense"` → silent no-op. Field rename in `Character` interface → all string paths break with no compiler warning.

2. **No exhaustive handling.** A `switch` on the first segment of a dotted path can't be checked for exhaustiveness. New target kinds get silently ignored.

3. **Complex traversal for arrays.** The planned syntax `"equipment.weapons[].qualities"` requires custom array-aware traversal code. Every bracket pattern is a special case in the traversal engine.

4. **No semantic distinction.** `"attributes.secondary.defense"` (a number) and `"equipment.weapons[].qualities"` (a string array) look the same to the applicator. The modifier type must be inferred from context.

### Coexistence with Schema-Driven Rendering (ADR-009)

ADR-009 established schema-driven rendering where the client uses dotted paths for data binding: `data-path="attributes.primary.accurate"`.

**These are different concerns:**
- **Schema paths** (ADR-009) are for UI data binding — mapping form fields to character JSON properties. They need to be strings because they're generated from schema metadata and used in DOM attributes.
- **Effect targets** (this ADR) are for the rules engine — telling the applicator what to modify and how. They're processed in TypeScript code where type safety matters.

The two systems operate independently. Schema paths live in the client and schema metadata. Effect targets live in the rules engine and reference data. There is no conflict.

### Options Considered

**A. Keep dotted-path strings.** Establish a vocabulary of valid paths as documentation. Add runtime validation to check paths against the `Character` type at startup.
- ✓ Zero refactoring for existing effect data
- ✓ Maximally flexible — any new `Character` field is automatically targetable
- ✗ Runtime-only validation. Misses issues until the code runs.
- ✗ Traversal complexity grows with each new pattern (arrays, nested objects)
- ✗ No exhaustive switch — new target types silently fall through

**B. Typed discriminated union.** Define a TypeScript union type where each variant represents a target kind. The applicator uses exhaustive `switch (target.kind)`.
- ✓ Compile-time safety: `tsc` catches invalid targets and missing handlers
- ✓ Exhaustive switch: adding a new kind without handling it = compile error
- ✓ Each kind can carry its own typed payload (stat name, quality name, flag type)
- ✓ Autocomplete and documentation built into the type system
- ✗ New target kinds require updating the union type (by design — forces you   to add a handler)
- ✗ Reference data (JSON files) must map their effect targets to the union. Needs a deserialization step.

**C. Hybrid — typed union internally, string alias for serialization.** Store effects in JSON as short string aliases (`"defense"`, `"baseDamage"`, `"weaponQuality.remove"`). Deserialize into the typed union at load time.
- ✓ Compact JSON representation
- ✓ Full type safety in the engine
- ✓ Deserialization validates targets at load time (fail fast)
- ✗ Two representations to keep in sync (string aliases ↔ union variants)

## Decision

**Approach B — Typed discriminated union**, with a thin deserialization layer from JSON reference data (borrowing the best part of Approach C).

### The EffectTarget Union

```typescript
/**
 * Typed target for an RPG effect. Each variant defines exactly what
 * the effect modifies and what payload it carries.
 *
 * Exhaustive switch on `kind` ensures every target type is handled.
 */
type EffectTarget =
  | SecondaryTarget
  | CombatTarget
  | WeaponQualityTarget
  | ArmorQualityTarget
  | FlagTarget
  | CheckTarget;

/** Targets a secondary attribute (defense, toughness.max, painThreshold, etc.) */
interface SecondaryTarget {
  kind: 'secondary';
  stat: keyof SecondaryAttributes;
  // setBase: value is a PrimaryAttributeName (string)
  // addFlat/multiply/cap: value is a number
}

/** Targets a combat-derived stat */
interface CombatTarget {
  kind: 'combat';
  field: 'attackAttribute' | 'baseDamage' | 'bonusDamage';
}

/** Adds or removes a quality from a weapon */
interface WeaponQualityTarget {
  kind: 'weaponQuality';
  action: 'add' | 'remove';
  quality: string;
  weaponFilter?: string;  // e.g., "battle-heels" — applies only to this weapon id
}

/** Adds or removes a quality from armor */
interface ArmorQualityTarget {
  kind: 'armorQuality';
  action: 'add' | 'remove';
  quality: string;
  slot?: 'body' | 'plug';
}

/** Tier B structured flags (non-numeric effects) */
interface FlagTarget {
  kind: 'flag';
  flag: EffectFlag;
  scope?: string;  // what the flag applies to, e.g., "melee", "movement"
}

/** Targets an attribute check (for advantage/disadvantage) */
interface CheckTarget {
  kind: 'check';
  attribute: PrimaryAttributeName;
  checkType?: string;  // e.g., "attack", "defense", "initiative"
}
```

### Flag Vocabulary (Tier B)

```typescript
type EffectFlag =
  | 'advantage'       // Roll twice, take best
  | 'disadvantage'    // Roll twice, take worst
  | 'immunity'        // Immune to a specific condition/effect
  | 'freeAttack'      // Grants or modifies free attacks
  | 'extraAction'     // Extra action under conditions
  | 'reaction'        // Grants a reaction ability
  | 'specialAttack'   // Unlocks a special attack maneuver
  | 'statusEffect'    // Applies a status (DoT, control, debuff)
  | 'statusRemoval';  // Removes a status
```

This vocabulary is not exhaustive today. New flags can be added to the union as abilities are normalized. The exhaustive switch pattern ensures each new flag gets a handler (or an explicit no-op comment).

### Applicator Usage

```typescript
function applyEffect(state: Character, effect: ResolvedEffect): void {
  const { target, modifier } = effect;

  switch (target.kind) {
    case 'secondary':
      applyToSecondary(state.attributes.secondary, target.stat, modifier);
      break;
    case 'combat':
      applyToCombat(state.combat, target.field, modifier);
      break;
    case 'weaponQuality':
      applyWeaponQuality(state.equipment.weapons, target, modifier);
      break;
    case 'armorQuality':
      applyArmorQuality(state.equipment.armor, target, modifier);
      break;
    case 'flag':
      applyFlag(state, target, effect);
      break;
    case 'check':
      applyCheckModifier(state, target, modifier);
      break;
    // No default — TypeScript exhaustive check ensures all kinds are handled.
    // If a new kind is added to EffectTarget, this switch will cause a
    //   compile error until a case is added.
  }
}
```

### Serialization in Reference Data

In JSON reference data files (`abilities.en.json`, `spells.en.json`), effects store targets as serializable objects matching the union shape:

```jsonc
{
  "effects": [
    {
      "target": { "kind": "secondary", "stat": "defense" },
      "modifier": { "type": "setBase", "value": "discreet" }
    },
    {
      "target": { "kind": "weaponQuality", "action": "remove", "quality": "unwieldy", "weaponFilter": "battle-heels" },
      "modifier": { "type": "remove" }
    },
    {
      "target": { "kind": "flag", "flag": "advantage", "scope": "melee" },
      "modifier": { "type": "flag", "value": true }
    }
  ]
}
```

A deserialization/validation function runs at reference data load time, mapping JSON objects to the `EffectTarget` union and failing fast on invalid shapes:

```typescript
function deserializeTarget(raw: unknown): EffectTarget {
  // Validate `kind` is a known discriminant
  // Validate kind-specific fields
  // Return typed EffectTarget or throw with descriptive error
}
```

This catches invalid reference data at startup, not at recalculation time.

### Extending the System

To add a new target kind (e.g., `corruption` modifiers):

1. Add a new interface: `interface CorruptionTarget { kind: 'corruption'; field: 'threshold' | 'max'; }`
2. Add it to the `EffectTarget` union
3. TypeScript immediately flags every `switch (target.kind)` that doesn't handle `'corruption'`
4. Add the handler
5. Add the deserializer case

This is a ~15-minute change with full compiler guidance. Compare with the dotted-path approach where adding `"corruption.threshold"` requires: auditing every traversal function, hoping no other path starts with `"corruption"`, and testing at runtime.

## Consequences

### Positive

- **Compile-time safety.** Invalid targets are caught by `tsc`, not at runtime. Field renames in `Character` propagate through the type system.
- **Exhaustive handling.** New target kinds produce compile errors until every switch is updated. Nothing falls through silently.
- **Self-documenting.** The union type IS the vocabulary. No separate documentation needed for "what targets are valid."
- **Condition-ready.** The `weaponFilter`, `slot`, `scope`, and `checkType` fields on target variants provide structured condition data without a separate condition evaluator. More complex conditions can be added later.
- **No traversal complexity.** No `getNestedValue` / `setNestedValue`. Each handler accesses the specific typed field directly.

### Negative

- **Closed vocabulary.** Every target must be pre-defined in the union. Purely data-driven "any path is valid" flexibility is deliberately removed. For this RPG system with well-defined mechanics, this is a feature.
- **JSON verbosity.** `{ "kind": "secondary", "stat": "defense" }` is more verbose than `"attributes.secondary.defense"`. Acceptable for reference data files that are authored once and read many times.
- **Deserialization step.** Reference data must be validated when loaded. This is ~50 lines of code and runs once at startup.

### Interaction with ADR-009 (Schema-Driven Rendering)

The schema-driven renderer continues to use dotted-path strings for UI data binding (`data-path="attributes.primary.accurate"`). These paths are used for DOM ↔ JSON mapping in the client, not for rules engine modifiers.

The two systems coexist cleanly:
- **Schema paths** = UI concern, strings in client code and schema metadata
- **Effect targets** = rules engine concern, typed unions in server code

If a future feature needs to map between them (e.g., "highlight the field that this effect modifies"), a simple lookup table from `EffectTarget` to schema path can be built without coupling the systems.

### Interaction with ADR-010 (Effect Resolution Pipeline)

ADR-010 defines `ResolvedEffect` with a `target: EffectTarget` field. This ADR defines what `EffectTarget` is. The two ADRs are complementary:
- ADR-010 defines the pipeline structure (phases, collection, typed state)
- ADR-011 defines the target vocabulary (what effects can target)
