// ── Effect application ────────────────────────────────────────────
//
// Phase-keyed handlers consuming typed `ResolvedEffect`s. Each handler is
// total over the relevant target kinds for its phase; cross-phase calls
// are a programmer error and trigger an exhaustive `never` check.
//
// Combat-target effects are applied per-slot by `deriveCombatSlots` in
// `derived.mts`, not here. The global handlers below skip them.

import type {
  ArmorCondition,
  ArmorPiece,
  Character,
  PrimaryAttributeName,
  ResolvedEffect,
  SecondaryAttributeName,
  Weapon,
  WeaponPredicate,
} from "#rpg-types";

// ── Armor condition matcher ────────────────────────────────────────
//
// Character-level effect gate (ADR-015 §3f). Independent of
// `appliesTo`, which narrows per-slot weapon fanout. AND-list across
// `conditions[]`; OR-within `values[]`.
//
// Two evaluation modes:
//   * Character-level (no `slot` arg): used for `secondary`-targeted
//     effects. armorSlot/armorQuality/armorId pass if ANY equipped
//     piece satisfies; noArmor passes when both slots are empty.
//   * Per-piece (`slot` provided): used inside `applyArmorQuality` so
//     the effect mutates only the matching piece. armorSlot checks the
//     piece's slot, armorQuality/armorId check that piece's data,
//     noArmor is always false (you can't apply an armor quality to
//     no armor).

export function matchesArmorConditions(
  character: Character,
  conditions: ArmorCondition[] | undefined,
  slot?: "body" | "plug",
): boolean {
  if (!conditions || conditions.length === 0) return true;
  for (const condition of conditions) {
    if (!matchesOneCondition(character, condition, slot)) return false;
  }
  return true;
}

function matchesOneCondition(
  character: Character,
  condition: ArmorCondition,
  slot?: "body" | "plug",
): boolean {
  const armor = character.equipment?.armor;
  const body = armor?.body ?? null;
  const plug = armor?.plug ?? null;
  switch (condition.kind) {
    case "noArmor":
      // Per-piece evaluation: a piece exists, so noArmor is false.
      if (slot) return false;
      return body === null && plug === null;
    case "armorSlot":
      if (slot) return condition.values.includes(slot);
      // Character-level: at least one listed slot is non-empty.
      return condition.values.some((s) =>
        s === "body" ? body !== null : plug !== null,
      );
    case "armorQuality":
      if (slot) {
        const piece = slot === "body" ? body : plug;
        return pieceHasAnyQuality(piece, condition.values);
      }
      return (
        pieceHasAnyQuality(body, condition.values) ||
        pieceHasAnyQuality(plug, condition.values)
      );
    case "armorId":
      if (slot) {
        const piece = slot === "body" ? body : plug;
        return piece !== null && condition.values.includes(piece.id);
      }
      return (
        (body !== null && condition.values.includes(body.id)) ||
        (plug !== null && condition.values.includes(plug.id))
      );
    default:
      assertNever(condition);
  }
}

function pieceHasAnyQuality(
  piece: ArmorPiece | null,
  values: string[],
): boolean {
  if (!piece) return false;
  // Read through `qualitiesEffective` (post-recalc snapshot), falling
  // back to authored `qualities` for pre-recalc fixtures. Mirrors
  // `readPrimary` (effective with base fallback).
  const qualities = piece.qualitiesEffective ?? piece.qualities ?? [];
  return values.some((v) => qualities.includes(v));
}

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
        if (!matchesArmorConditions(character, effect.condition)) break;
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
        // `derivePrimaryAttributes` in derived.mts (ADR-015 §primary-bucketing).
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
        if (!matchesArmorConditions(character, effect.condition)) break;
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
        // Bucketed into `primary` phase (ADR-015 §primary-bucketing); also `multiply` is
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
        if (!matchesArmorConditions(character, effect.condition)) break;
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
        // Bucketed into `primary` phase (ADR-015 §primary-bucketing).
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
    // Per-piece gate: condition must match against this slot. For
    // registry-synthesized effects this carries the implicit
    // `armorSlot` stamp (effect only fires on the carrying piece). For
    // authored effects (e.g. Soldier) without a slot condition, every
    // matching piece is mutated, which is the authoring intent.
    if (!matchesArmorConditions(character, effect.condition, slot)) continue;
    // Engine writes the overlay to `qualitiesEffective`, never to the
    // authored `qualities` array. `recalculate()` resets
    // `qualitiesEffective` from `qualities` at the top of each pass
    // (NB-31), so removals/additions don't accumulate across recalcs.
    const current = piece.qualitiesEffective ?? piece.qualities ?? [];
    if (effect.modifier.type === "remove") {
      piece.qualitiesEffective = current.filter((q) => q !== quality);
    } else if (!current.includes(quality)) {
      piece.qualitiesEffective = [...current, quality];
    } else {
      piece.qualitiesEffective = current;
    }
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled effect target kind: ${JSON.stringify(value)}`);
}
