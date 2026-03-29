import { SERVER_CONTROLLED_FIELDS } from "./schema/validation.mjs";

function generateId() {
  return (
    crypto.randomUUID?.() ||
    Date.now().toString(36) + Math.random().toString(36).substring(2)
  );
}

function generateBackupCode() {
  const adjectives = ["Iris", "Crystal", "Shadow", "Iron", "Golden", "Silent"];
  const nouns = ["Wolf", "Dragon", "Phoenix", "Tiger", "Hawk", "Serpent"];
  const numbers = Math.floor(100 + Math.random() * 900);

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj}-${noun}-${numbers}`;
}

function validateCharacter(data) {
  if (!data.characterName || data.characterName.trim().length < 2) {
    throw new Error("Character name must be at least 2 characters");
  }

  return true;
}

function generateHumanReadableId() {
  const prefixes = ["iris", "wolf", "dragon", "shadow", "crystal"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const numbers = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${numbers}`;
}

function filterServerControlledFields(data) {
  const filtered = { ...data };

  for (const fieldPath of SERVER_CONTROLLED_FIELDS) {
    const keys = fieldPath.split(".");
    let current = filtered;

    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]]) {
        current = current[keys[i]];
      } else {
        current = null;
        break;
      }
    }

    if (current && current[keys[keys.length - 1]] !== undefined) {
      delete current[keys[keys.length - 1]];
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
