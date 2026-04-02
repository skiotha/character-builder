import { SECONDARY_FORMULAS, clampValues } from "./attributes.mts";
import { applyEffect, applyEquipmentBonuses } from "./applicator.mts";

interface RuleEffect {
  target?: string;
  modifier: { type: string; value: unknown };
  priority?: number;
  duration?: string;
  effects?: RuleEffect[];
}

export function recalculateDerivedFields(
  character: Record<string, unknown>,
): Record<string, unknown> {
  const result = structuredClone(character);

  const traits = (result.traits || []) as Array<Record<string, unknown>>;
  const directEffects = (result.effects || []) as RuleEffect[];

  const allEffects: RuleEffect[] = [
    ...traits
      .filter((t) => t.effects)
      .flatMap((t) => t.effects as RuleEffect[]),
    ...directEffects,
  ].filter((effect) => !isExpired(effect));

  allEffects.sort((a, b) => (a.priority || 10) - (b.priority || 10));

  const overrides: Record<string, string> = {};

  for (const effect of allEffects) {
    if (
      effect.target?.startsWith("rules.") &&
      effect.modifier.type === "setBase"
    ) {
      const stat = effect.target.split(".")[1]!;
      overrides[stat] = effect.modifier.value as string;
    }
  }

  const attrs = result.attributes as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (!attrs?.secondary) return result;

  for (const [stat, rule] of Object.entries(SECONDARY_FORMULAS)) {
    const baseValue = rule.base(result, overrides[stat]);
    const calculated = rule.formula(baseValue);

    if (typeof attrs.secondary[stat] === "object") {
      attrs.secondary[stat] = {
        ...(attrs.secondary[stat] as Record<string, unknown>),
        max: calculated,
      };
    } else {
      attrs.secondary[stat] = calculated;
    }
  }

  for (const effect of allEffects) {
    if (!effect.target?.startsWith("rules.")) {
      applyEffect(result, effect.target!, effect.modifier);
    }
  }

  applyEquipmentBonuses(result);

  clampValues(result);

  enforceConsistency(result);

  return result;
}

function isExpired(effect: RuleEffect): boolean {
  return !!effect.duration && new Date(effect.duration) < new Date();
}

function enforceConsistency(
  character: Record<string, unknown>,
): Record<string, unknown> {
  const attrs = character.attributes as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (attrs?.secondary?.toughness) {
    const t = attrs.secondary.toughness as { current: number; max: number };
    t.current = Math.max(0, Math.min(t.current, t.max));
  }

  const experience = character.experience as Record<string, number> | undefined;
  if (
    experience &&
    experience.unspent !== undefined &&
    experience.unspent < 0
  ) {
    console.warn(`Negative XP for ${character.id as string}, resetting to 0`);
    experience.unspent = 0;
  }

  if (Array.isArray(character.effects)) {
    character.effects = (character.effects as RuleEffect[]).filter(
      (effect) => !isExpired(effect),
    );
  }

  const equipment = (character.equipment || {}) as Record<string, unknown>;
  character.equipment = equipment;
  equipment.weapons = equipment.weapons || [];
  equipment.armor = equipment.armor || {
    body: null,
    plug: [],
  };

  if (Array.isArray(character.traits)) {
    const seen = new Set<string>();

    character.traits = (
      character.traits as Array<Record<string, unknown>>
    ).filter((trait) => {
      const key = `${trait.name as string}_${trait.type as string}`;

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return character;
}
