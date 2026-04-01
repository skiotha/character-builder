import { setNestedValue, getNestedValue } from "../models/traversal.mts";

export function applyEffect(character, targetPath, modifier) {
  const currentValue = getNestedValue(character, targetPath) ?? 0;
  let newValue;

  switch (modifier.type) {
    case "add":
      newValue = currentValue + modifier.value;
      break;
    case "mul":
      newValue = currentValue * modifier.value;
      break;
    case "set":
      newValue = modifier.value;
      break;
    case "advantage":
      setNestedValue(character, targetPath + ".advantage", true);
      return;
    default:
      newValue = currentValue;
  }

  setNestedValue(character, targetPath, newValue);
}

/*
{
  name: "Longsword",
  damage: "1d8",
  effects: [
    { target: "combat.attackBonus", modifier: { type: "add", value: 2 } },
    { target: "combat.criticalRange", modifier: { type: "set", value: 19 } }
  ]
}
*/

export function applyEquipmentBonuses(character) {
  const weapons = character.equipment?.weapons || [];

  weapons.forEach((weapons) => {
    weapons.effects?.forEach((effect) =>
      applyEffect(character, effect.target, effect.modifier),
    );
  });
}
