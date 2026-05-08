// ── Effect application (Phase 6 / Chunk E) ─────────────────────────
//
// Phase-keyed handlers consuming typed `ResolvedEffect`s. Each handler is
// total over the relevant target kinds for its phase; cross-phase calls
// are a programmer error and trigger an exhaustive `never` check.
//
// Combat-target effects are applied per-slot by `deriveCombatSlots` in
// `derived.mts`, not here. The global handlers below skip them.

import type {
  Character,
  PrimaryAttributeName,
  ResolvedEffect,
  SecondaryAttributeName,
  Weapon,
  WeaponPredicate,
} from "#rpg-types";

// ── Weapon predicate matcher ───────────────────────────────────────
//
// Multiple predicates AND-compose; `values[]` within a single predicate
// OR-composes. `undefined` / `[]` / `[{ kind: "any" }]` all mean
// match-all.

export function matchesPredicates(
  weapon: Weapon,
  predicates: WeaponPredicate[] | undefined,
): boolean {
  if (!predicates || predicates.length === 0) return true;
  for (const predicate of predicates) {
    if (!matchesOne(weapon, predicate)) return false;
  }
  return true;
}

function matchesOne(weapon: Weapon, predicate: WeaponPredicate): boolean {
  switch (predicate.kind) {
    case "any":
      return true;
    case "id":
      return predicate.values.includes(weapon.id);
    case "type":
      return predicate.values.includes(weapon.type);
    case "quality":
      return predicate.values.some((q) => weapon.qualities.includes(q));
    default:
      assertNever(predicate);
  }
}

// ── setBase phase ──────────────────────────────────────────────────
// Returns a candidate map consumed by the formula phase. The formula
// phase resolves the winning candidate per stat via `resolveSetBase`
// (ADR-015 §4): default-inclusive max-by-primary. We collect
// raw candidates here so the resolution policy stays in one place
// (`src/rules/setbase.mts`) and the phase boundary stays pure.

export function applySetBase(
  effects: ResolvedEffect[],
): Map<SecondaryAttributeName, PrimaryAttributeName[]> {
  const candidates = new Map<SecondaryAttributeName, PrimaryAttributeName[]>();
  for (const effect of effects) {
    if (effect.modifier.type !== "setBase") continue;
    if (effect.target.kind === "secondary") {
      const list = candidates.get(effect.target.stat);
      if (list) list.push(effect.modifier.value);
      else candidates.set(effect.target.stat, [effect.modifier.value]);
    }
    // combat: per-slot setBase on `attackAttribute` is resolved by
    // `applySlotPhases` (also via `resolveSetBase`). Other combat
    // fields reject setBase at parse time.
  }
  return candidates;
}

// ── addFlat phase ──────────────────────────────────────────────────

export function applyAddFlat(
  character: Character,
  effects: ResolvedEffect[],
): void {
  for (const effect of effects) {
    if (effect.modifier.type !== "addFlat") continue;
    switch (effect.target.kind) {
      case "secondary": {
        const stat = effect.target.stat;
        const secondary = character.attributes.secondary as Record<
          SecondaryAttributeName,
          unknown
        >;
        if (stat === "toughness") {
          character.attributes.secondary.toughness.max += effect.modifier.value;
        } else {
          secondary[stat] =
            ((secondary[stat] as number) ?? 0) + effect.modifier.value;
        }
        break;
      }
      case "combat":
        // Per-slot — handled by `deriveCombatSlots`.
        break;
      case "primary":
        // Bucketed into `primary` phase by groupByPhase, applied by
        // `derivePrimaryAttributes` in derived.mts (Item 10).
        break;
      case "magicAttribute":
      case "initiativeAttribute":
        // Setbase-only; addFlat is parser-rejected. Unreachable.
        break;
      case "weaponQuality":
      case "armorQuality":
      case "flag":
        // Unreachable — bucketed into `flag` phase by groupByPhase.
        break;
      default:
        assertNever(effect.target);
    }
  }
}

// ── multiply phase ─────────────────────────────────────────────────

export function applyMultiply(
  character: Character,
  effects: ResolvedEffect[],
): void {
  for (const effect of effects) {
    if (effect.modifier.type !== "multiply") continue;
    switch (effect.target.kind) {
      case "secondary": {
        const stat = effect.target.stat;
        const secondary = character.attributes.secondary as Record<
          SecondaryAttributeName,
          unknown
        >;
        if (stat === "toughness") {
          character.attributes.secondary.toughness.max = Math.round(
            character.attributes.secondary.toughness.max *
              effect.modifier.value,
          );
        } else {
          secondary[stat] = Math.round(
            ((secondary[stat] as number) ?? 0) * effect.modifier.value,
          );
        }
        break;
      }
      case "combat":
        // Per-slot — handled by `deriveCombatSlots`.
        break;
      case "primary":
        // Bucketed into `primary` phase (Item 10); also `multiply` is
        // parser-rejected for primary targets so this is doubly unreachable.
        break;
      case "magicAttribute":
      case "initiativeAttribute":
        // setBase-only; multiply is parser-rejected. Unreachable.
        break;
      case "weaponQuality":
      case "armorQuality":
      case "flag":
        break;
      default:
        assertNever(effect.target);
    }
  }
}

// ── cap phase ──────────────────────────────────────────────────────
// Caps are applied to non-combat targets only. Combat caps are
// per-slot — handled by `deriveCombatSlots`.

export function applyCap(
  character: Character,
  effects: ResolvedEffect[],
): void {
  for (const effect of effects) {
    if (effect.modifier.type !== "cap") continue;
    switch (effect.target.kind) {
      case "secondary": {
        const stat = effect.target.stat;
        const secondary = character.attributes.secondary as Record<
          SecondaryAttributeName,
          unknown
        >;
        if (stat === "toughness") {
          character.attributes.secondary.toughness.max = Math.min(
            character.attributes.secondary.toughness.max,
            effect.modifier.value,
          );
        } else {
          secondary[stat] = Math.min(
            (secondary[stat] as number) ?? 0,
            effect.modifier.value,
          );
        }
        break;
      }
      case "combat":
        // Per-slot — handled by `deriveCombatSlots`.
        break;
      case "primary":
        // Bucketed into `primary` phase (Item 10).
        break;
      case "magicAttribute":
      case "initiativeAttribute":
        // setBase-only; cap is parser-rejected. Unreachable.
        break;
      case "weaponQuality":
      case "armorQuality":
      case "flag":
        break;
      default:
        assertNever(effect.target);
    }
  }
}

// ── flag phase ─────────────────────────────────────────────────────
// Mutates character-level set membership: `character.flags` and armor
// qualities (body + plug). `weaponQuality` is per-slot and handled by
// `deriveCombatSlots`, not here.

export function applyFlag(
  character: Character,
  effects: ResolvedEffect[],
): void {
  for (const effect of effects) {
    switch (effect.target.kind) {
      case "flag":
        applyFlagSet(character, effect);
        break;
      case "armorQuality":
        applyArmorQuality(character, effect);
        break;
      case "weaponQuality":
        // Per-slot — handled by `deriveCombatSlots`.
        break;
      case "primary":
      case "secondary":
      case "combat":
      case "magicAttribute":
      case "initiativeAttribute":
        // Numeric targets bucketed into flag only via `remove`; no-op.
        // (`primary` is also bucketed into its own `primary` phase;
        // `magicAttribute` / `initiativeAttribute` are setBase-only and
        // route to the `setBase` phase, consumed in derived.mts.)
        break;
      default:
        assertNever(effect.target);
    }
  }
}

function applyFlagSet(character: Character, effect: ResolvedEffect): void {
  if (effect.target.kind !== "flag") return;
  const name = effect.target.name;
  if (effect.modifier.type === "remove") {
    character.flags = character.flags.filter((f) => f !== name);
  } else {
    if (!character.flags.includes(name)) character.flags.push(name);
  }
}

function applyArmorQuality(character: Character, effect: ResolvedEffect): void {
  if (effect.target.kind !== "armorQuality") return;
  const quality = effect.target.quality;
  for (const slot of ["body", "plug"] as const) {
    const piece = character.equipment?.armor?.[slot];
    if (!piece) continue;
    const qualities = piece.qualities ?? [];
    if (effect.modifier.type === "remove") {
      piece.qualities = qualities.filter((q) => q !== quality);
    } else if (!qualities.includes(quality)) {
      piece.qualities = [...qualities, quality];
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled effect target kind: ${JSON.stringify(value)}`);
}
