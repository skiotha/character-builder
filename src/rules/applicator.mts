// ── Effect application (Phase 6 / Chunk C) ─────────────────────────
//
// Phase-keyed handlers consuming typed `ResolvedEffect`s. Each handler is
// total over the relevant target kinds for its phase; cross-phase calls
// are a programmer error and trigger an exhaustive `never` check.
//
// Combat handlers are STUBS in Chunk C — per-slot fanout lands in
// Chunk E. Equipment-effect collection is also deferred (see
// `effects.collectAllEffects`).

import type {
  Character,
  PrimaryAttributeName,
  ResolvedEffect,
  SecondaryAttributeName,
} from "#rpg-types";

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
      // TODO(phase6-chunk-E): per-slot setBase on attackAttribute.
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
        // TODO(phase6-chunk-E): per-slot baseDamage / bonusDamage addFlat.
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
        // TODO(phase6-chunk-E).
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
// Caps are applied to non-combat targets only. Combat caps land in E.

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
        // TODO(phase6-chunk-E).
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
// Mutates set membership: character.flags, armor qualities, weapon
// qualities. `remove` modifier removes; everything else adds.

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
        applyWeaponQuality(character, effect);
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
  const body = character.equipment?.armor?.body;
  if (!body) return;
  const qualities = (body.qualities ?? []) as string[];
  const quality = effect.target.quality;
  if (effect.modifier.type === "remove") {
    body.qualities = qualities.filter((q) => q !== quality);
  } else if (!qualities.includes(quality)) {
    body.qualities = [...qualities, quality];
  }
}

function applyWeaponQuality(
  _character: Character,
  _effect: ResolvedEffect,
): void {
  // TODO(phase6-chunk-E): walk derived combat slots and add/remove the
  // quality on every slot whose weapon matches the effect's appliesTo
  // predicate. Stubbed in Chunk C.
}

function assertNever(value: never): never {
  throw new Error(`Unhandled effect target kind: ${JSON.stringify(value)}`);
}
