import { SERVER_CONTROLLED_FIELDS } from "#models/validation";

function generateId(): string {
  return (
    crypto.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).substring(2)
  );
}

function generateBackupCode(): string {
  const adjectives = ["Iris", "Crystal", "Shadow", "Iron", "Golden", "Silent"];
  const nouns = ["Wolf", "Dragon", "Phoenix", "Tiger", "Hawk", "Serpent"];
  const numbers = Math.floor(100 + Math.random() * 900);

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]!;
  const noun = nouns[Math.floor(Math.random() * nouns.length)]!;

  return `${adj}-${noun}-${numbers}`;
}

function validateCharacter(data: Record<string, unknown>): boolean {
  if (
    !data.characterName ||
    (typeof data.characterName === "string" &&
      data.characterName.trim().length < 2)
  ) {
    throw new Error("Character name must be at least 2 characters");
  }

  return true;
}

function generateHumanReadableId(): string {
  const prefixes = ["iris", "wolf", "dragon", "shadow", "crystal"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]!;
  const numbers = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${numbers}`;
}

function filterServerControlledFields(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const filtered: Record<string, unknown> = { ...data };

  for (const fieldPath of SERVER_CONTROLLED_FIELDS) {
    const keys = fieldPath.split(".");
    let current: Record<string, unknown> | null = filtered;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      if (current[key] && typeof current[key] === "object") {
        current = current[key] as Record<string, unknown>;
      } else {
        current = null;
        break;
      }
    }

    const lastKey = keys[keys.length - 1]!;
    if (current && current[lastKey] !== undefined) {
      delete current[lastKey];
    }
  }

  return filtered;
}

export {
  generateId,
  generateBackupCode,
  validateCharacter,
  generateHumanReadableId,
  filterServerControlledFields,
};
