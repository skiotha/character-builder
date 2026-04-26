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
// Returns the override map consumed by the formula phase; secondary
// attributes are computed from the override before addFlat/multiply/cap.

export function applySetBase(
  effects: ResolvedEffect[],
): Map<SecondaryAttributeName, PrimaryAttributeName> {
  const overrides = new Map<SecondaryAttributeName, PrimaryAttributeName>();
  for (const effect of effects) {
    if (effect.modifier.type !== "setBase") continue;
    if (effect.target.kind === "secondary") {
      // Last write wins — phase ordering replaces priority (ADR-015 §4).
      overrides.set(effect.target.stat, effect.modifier.value);
    } else if (effect.target.kind === "combat") {
      // Per-slot setBase on `attackAttribute` is handled in
      // `deriveCombatSlots`. Other combat fields reject setBase at parse
      // time.
    }
  }
  return overrides;
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
      case "secondary":
      case "combat":
        // Numeric targets bucketed into flag only via `remove`; no-op.
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
