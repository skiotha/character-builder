import { SECONDARY_FORMULAS, clampValues } from "./attributes.mts";
import { applyEffect, applyEquipmentBonuses } from "./applicator.mts";

export function recalculateDerivedFields(character) {
  const result = structuredClone(character);

  const allEffects = [
    ...(result.traits || []).filter((t) => t.effects).flatMap((t) => t.effects),
    ...(result.effects || []),
  ].filter((effect) => !isExpired(effect));

  allEffects.sort((a, b) => (a.priority || 10) - (b.priority || 10));

  const overrides = {};

  for (const effect of allEffects) {
    if (
      effect.target?.startsWith("rules.") &&
      effect.modifier.type === "setBase"
    ) {
      const stat = effect.target.split(".")[1];
      overrides[stat] = effect.modifier.value;
    }
  }

  for (const [stat, rule] of Object.entries(SECONDARY_FORMULAS)) {
    const baseValue = rule.base(result, overrides[stat]);
    const calculated = rule.formula(baseValue);

    if (typeof result.attributes.secondary[stat] === "object") {
      result.attributes.secondary[stat] = {
        ...result.attributes.secondary[stat],
        max: calculated,
      };
    } else {
      result.attributes.secondary[stat] = calculated;
    }
  }

  for (const effect of allEffects) {
    if (!effect.target?.startsWith("rules.")) {
      applyEffect(result, effect.target, effect.modifier);
    }
  }

  applyEquipmentBonuses(result);

  clampValues(result);

  enforceConsistency(result);

  return result;
}

function isExpired(effect) {
  return effect.duration && new Date(effect.duration) < new Date();
}

function enforceConsistency(character) {
  if (character.attributes?.secondary?.toughness) {
    const t = character.attributes.secondary.toughness;
    t.current = Math.max(0, Math.min(t.current, t.max));
  }

  if (character.experience?.unspent < 0) {
    console.warn(`Negative XP for ${character.id}, resetting to 0`);
    character.experience.unspent = 0;
  }

  if (Array.isArray(character.effects)) {
    character.effects = character.effects.filter(
      (effect) => !isExpired(effect),
    );
  }

  character.equipment = character.equipment || {};
  character.equipment.weapons = character.equipment.weapons || [];
  character.equipment.armor = character.equipment.armor || {
    body: null,
    plug: [],
  };

  if (Array.isArray(character.traits)) {
    const seen = new Set();

    character.traits = character.traits.filter((trait) => {
      const key = `${trait.name}_${trait.type}`;

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return character;
}
