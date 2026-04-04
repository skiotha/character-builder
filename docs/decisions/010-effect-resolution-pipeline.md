# ADR-010: Effect Resolution Pipeline Architecture

**Status:** Accepted
**Date:** 2026-04-04
**Deciders:** Project owner + Copilot design session
**Related:** [ADR-009](009-schema-driven-rendering.md) (Schema-Driven Rendering),
[ADR-011](011-typed-effect-targets.md) (Typed Effect Targets)

## Context

The RPG rules engine is the core business system of the character builder. Every character sheet must compute derived attributes (toughness, defense, pain threshold, etc.) and combat stats (attack attribute, base damage, bonus damage) from the character's primary attributes, equipped items, and learned abilities.

### Current State

The existing engine (`src/rules/`) has the right conceptual idea — collect effects, sort, apply, derive — but the implementation has structural problems that make it fragile, hard to test, and unable to grow:

1. **Untyped pipeline.** Every function operates on `Record<string, unknown>`. The well-typed `Character` interface from `rpg-types.mts` is unused in the rules engine. Property access is chains of unsafe casts like `(char.attributes as Record<string, unknown> | undefined)?.primary as Record<string, number>`. TypeScript provides zero compile-time safety where it matters most.

2. **Numeric priority for ordering.** Effects are sorted by a `priority` number. But modifier ordering is a mathematical requirement, not a data-driven preference: `setBase` must run before `addFlat`, `addFlat` before `multiply`, `multiply` before `cap`. Wrong priority values cause silent math errors with no way for the system to detect the mistake.

3. **Scattered effect sources.** Three different places collect effects with different logic:
   - `character.effects[]` — filtered for expiry at the top of `recalculateDerivedFields`
   - Ability/spell effects — **not yet implemented** (planned lookup from reference data)
   - Equipment effects — processed separately in `applyEquipmentBonuses()`

   There is no single point where "all active effects on this character" is visible.

4. **Magic prefix convention.** `setBase` effects are detected by checking `effect.target?.startsWith("rules.")` and extracting the stat name via `target.split(".")[1]`. This undocumented convention works for secondary attribute overrides but cannot generalize to combat attribute overrides, quality manipulation, or Tier B flags.

5. **Tangled pipeline stages.** `enforceConsistency()` mixes data clamping, XP validation, expired-effect cleanup, equipment defaults, and combat derivation. These are conceptually distinct stages with no separation.

### What Works

The conceptual model is sound:
- The modifier taxonomy (`setBase` / `addFlat` / `multiply` / `cap`) is correct and covers ~95% of tabletop RPG modifier math
- The tiered normalization (A = mechanical, B = structured flags, C = narrative) is pragmatic and honest
- The reference-based ability model (character stores `{id, tier}`, engine looks up effects) is the right direction
- The `SECONDARY_FORMULAS` map is a clean, extensible pattern

### Options Considered

**A. Fix the current implementation incrementally.** Keep `Record<string, unknown>`, keep numeric priority, add ability lookup on top.
- ✓ Least refactoring effort
- ✗ Every future feature (Tier B effects, conditions, new modifiers) will fight the same structural problems
- ✗ Bugs remain runtime-only, invisible to `tsc`

**B. Typed pipeline with explicit phases.** Replace `Record<string, unknown>` with `Character`, replace numeric priority with a phase enum processed in fixed order, unify effect collection into a single step.
- ✓ Compiler catches schema mismatches
- ✓ Modifier ordering is guaranteed by code structure, not data
- ✓ Single effect-collection step simplifies debugging and testing
- ✓ Each pipeline stage is independently testable
- ✗ Requires rewriting the existing rules engine files
- ✗ `Character` interface becomes a dependency of the rules engine (acceptable — it should be)

**C. Entity-Component-System (ECS) architecture.** Model the character as an entity with attached components, effects as systems that process specific component types.
- ✓ Maximum flexibility and extensibility
- ✗ Massive over-engineering for a character sheet application
- ✗ Unfamiliar pattern for the codebase

## Decision

**Approach B — Typed pipeline with explicit phases.**

The engine is restructured around three principles: typed state, explicit phases, and unified effect collection.

### 1. Typed State

The pipeline operates on the `Character` type from `rpg-types.mts`. Internal functions receive typed sub-structures:

```typescript
// Instead of:
function base(char: Record<string, unknown>, statOverride?: string): number {
  const primary = (char.attributes as Record<string, unknown> | undefined)
    ?.primary as Record<string, number> | undefined;
  return primary?.[stat] ?? 0;
}

// Use:
function base(primary: PrimaryAttributes, stat: PrimaryAttributeName): number {
  return primary[stat];
}
```

When the `Character` interface changes, the compiler finds every affected formula. No unsafe casts, no silent breakage.

### 2. Explicit Phase Enum

Effects declare their phase. The pipeline processes phases in fixed order, enforced by code structure — not by numeric priority:

```typescript
const enum EffectPhase {
  /** setBase — changes which attribute feeds a formula. Runs first. */
  BASE_OVERRIDE = 0,
  // ── secondary attribute formulas run here (not an effect phase, a pipeline stage) ──
  /** addFlat — add/subtract a flat number after formulas compute. */
  FLAT_BONUS = 1,
  /** multiply — scale a value. Runs after flat bonuses. */
  MULTIPLIER = 2,
  /** cap — impose a ceiling. Runs last among numeric modifiers. */
  CAP = 3,
  /** Structured flags: advantage, immunity, quality manipulation. */
  FLAG = 4,
}
```

The canonical modifier types map directly to phases:

| Modifier type |      Phase      |
|---------------|-----------------|
| `setBase`     | `BASE_OVERRIDE` |
| `addFlat`     | `FLAT_BONUS`    |
| `multiply`    | `MULTIPLIER`    |
| `cap`         | `CAP`           |
| Tier B flags  | `FLAG`          |

Within each phase, effects are applied in source order (abilities first, then spells, then equipment, then temporary). The `priority` field is removed from the interface — it served as a workaround for the lack of phases.

### 3. Unified Effect Collection

A single function gathers effects from all sources before the pipeline runs:

```typescript
function collectAllEffects(
  character: Character,
  refs: ReferenceData,
): ResolvedEffect[] {
  const fromAbilities = character.abilities.flatMap(a =>
    lookupEffects(refs.abilities, a.id, a.tier)
  );
  const fromSpells = character.spells.flatMap(s =>
    lookupEffects(refs.spells, s.id, s.tier)
  );
  const fromEquipment = collectEquipmentEffects(character.equipment);
  const fromTemporary = character.effects.filter(e => !isExpired(e));

  return [...fromAbilities, ...fromSpells, ...fromEquipment, ...fromTemporary];
}
```

This makes "all active effects on this character" inspectable and testable in one place. Sources can be extended later (boon effects, sin effects, ritual effects) without changing the pipeline.

### 4. Pipeline Structure

The recalculation function becomes a clear sequence of stages:

```typescript
function recalculate(character: Character, refs: ReferenceData): Character {
  // 1. Collect all active effects from every source
  const effects = collectAllEffects(character, refs);

  // 2. Group effects by phase
  const byPhase = groupByPhase(effects);

  // 3. Clone to avoid mutation of the input
  const state = structuredClone(character);

  // 4. Phase: BASE_OVERRIDE — rewrite which primary feeds each secondary
  applyBaseOverrides(state, byPhase[EffectPhase.BASE_OVERRIDE]);

  // 5. Compute secondary attributes using (possibly overridden) formulas
  computeSecondaryAttributes(state);

  // 6. Phase: FLAT_BONUS — add/subtract flat values
  applyFlatBonuses(state, byPhase[EffectPhase.FLAT_BONUS]);

  // 7. Phase: MULTIPLIER — scale values
  applyMultipliers(state, byPhase[EffectPhase.MULTIPLIER]);

  // 8. Phase: CAP — impose ceilings
  applyCaps(state, byPhase[EffectPhase.CAP]);

  // 9. Phase: FLAG — advantage, immunity, quality changes
  applyFlags(state, byPhase[EffectPhase.FLAG]);

  // 10. Derive combat stats from (now-final) attributes and equipment
  deriveCombatStats(state);

  // 11. Clamp and enforce constraints (toughness.current ≤ max, XP ≥ 0)
  enforceConstraints(state);

  return state;
}
```

Each step is a pure function (or close to it), independently testable, with well-defined inputs and outputs.

### 5. Reference Data

The pipeline requires reference data to resolve ability/spell IDs to effects. Reference data is loaded once at startup and passed into the pipeline:

```typescript
interface ReferenceData {
  abilities: AbilityDefinition[];  // from data/abilities.en.json
  spells: SpellDefinition[];       // from data/spells.en.json
  // Future: weapons, armor, runes, boons, sins, rituals
}
```

This avoids global state and makes the pipeline testable with mock reference data.

### Effect Shape

The `ResolvedEffect` type represents an effect after lookup and resolution:

```typescript
interface ResolvedEffect {
  source: EffectSource;         // 'ability' | 'spell' | 'equipment' | 'temporary'
  sourceId: string;             // e.g., "iron-body", "longsword"
  target: EffectTarget;         // Typed target — see ADR-011
  modifier: ResolvedModifier;   // { phase, value }
  condition?: EffectCondition;  // Optional — for future Tier B conditional evaluation
}

interface ResolvedModifier {
  phase: EffectPhase;
  value: number | string | boolean;  // number for numeric mods, string for setBase attribute name, boolean for flags
}
```

### Migration Path

This is not a rewrite-everything-at-once change. The migration follows the
existing Phase 6 roadmap steps:

1. **Phase 6 Gate (architecture assessment):** Adopt this ADR. Define the vocabulary (what targets exist, what flags exist).
2. **Phase 6 Step 3 (applicator alignment):** Rewrite `applicator.mts` with typed state and phase-based processing. This is the core change.
3. **Phase 6 Step 4 (effect resolution):** Implement `collectAllEffects` and `lookupEffects` in `effects.mts` / `registry.mts`.
4. **Phase 6 Step 5 (combat derivation):** Rewrite `deriveCombat` as a separate pipeline stage operating on typed `Character`.

The `SECONDARY_FORMULAS` pattern in `attributes.mts` is retained — it's a good pattern. The formulas just receive typed inputs instead of`Record<string, unknown>`.

## Consequences

### Positive

- **Compiler safety.** Schema changes in `rpg-types.mts` surface as compile errors in the rules engine, not runtime surprises.
- **Guaranteed ordering.** `setBase` → formulas → `addFlat` → `multiply` → `cap` is enforced by code structure. No way to accidentally misorder.
- **Single effect collection point.** "Why does my defense say 15?" becomes answerable by inspecting the output of `collectAllEffects`.
- **Testable stages.** Each phase function can be unit-tested with typed inputs: "given these PrimaryAttributes and these BASE_OVERRIDE effects, assert these secondary values."
- **Extensible.** New effect sources (boon effects, sin effects) just add a line to `collectAllEffects`. New phases (if ever needed) add to the enum and a step in the pipeline.
- **Eliminates magic conventions.** No more `"rules."` prefix parsing. Phase membership is explicit on every effect.

### Negative

- **Requires rewriting existing rules engine files.** `derived.mts`, `applicator.mts`, `attributes.mts` all change. ~300 lines of existing code are replaced.
- **Reference data dependency.** The pipeline now needs reference data passed in. Callers (route handlers, storage hooks) must provide it. This is a design improvement but adds a parameter.
- **Phase enum is rigid.** If a future effect type needs to run "between `FLAT_BONUS` and `MULTIPLIER`", the enum must be extended. This is unlikely for tabletop RPG math but not impossible.

### Risks

- **Effect normalization dependency.** The pipeline can be built and tested with synthetic effects, but won't do real work until reference data effects are normalized (Phase 6 Step 2). This is already planned and not a new risk.
- **Condition evaluation deferred.** Conditional effects (Tier B) remain read-only flags until a condition evaluator is built. The pipeline architecture supports this (the `FLAG` phase and `condition` field exist) but the evaluator is out of scope for this ADR.
