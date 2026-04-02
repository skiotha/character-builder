import { setNestedValue, getNestedValue } from "#models/traversal";

interface Modifier {
  type: string;
  value: unknown;
}

interface EquipmentEffect {
  target: string;
  modifier: Modifier;
}

export function applyEffect(
  character: Record<string, unknown>,
  targetPath: string,
  modifier: Modifier,
): void {
  const currentValue = (getNestedValue(character, targetPath) as number) ?? 0;
  let newValue: number;

  switch (modifier.type) {
    case "add":
      newValue = currentValue + (modifier.value as number);
      break;
    case "mul":
      newValue = currentValue * (modifier.value as number);
      break;
    case "set":
      newValue = modifier.value as number;
      break;
    case "advantage":
      setNestedValue(character, targetPath + ".advantage", true);
      return;
    default:
      newValue = currentValue;
  }

  setNestedValue(character, targetPath, newValue);
}

export function applyEquipmentBonuses(
  character: Record<string, unknown>,
): void {
  const equipment = character.equipment as Record<string, unknown> | undefined;
  const weapons = (equipment?.weapons || []) as Array<Record<string, unknown>>;

  weapons.forEach((weapon) => {
    const effects = weapon.effects as EquipmentEffect[] | undefined;
    effects?.forEach((effect) =>
      applyEffect(character, effect.target, effect.modifier),
    );
  });
}
