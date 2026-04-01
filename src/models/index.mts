import { generateId, generateBackupCode } from "../lib/utils.mts";
import { generateDefaultCharacter } from "./schema-utils.mts";
import { validateCharacterCreation } from "./validation.mts";
import * as storage from "./storage.mts";
import { validateDmToken } from "#auth";

async function createCharacter(playerId, characterData) {
  // validateCharacterCreation(characterData);

  // const defaultCharacter = generateDefaultCharacter(
  //   playerId,
  //   characterData.characterName,
  //   characterData.player || "Unknown",
  // );

  const character = {
    ...characterData,
    id: generateId(),
    backupCode: generateBackupCode(),
  };

  return await storage.saveCharacter(character);
}

async function getCharacter(id) {
  return await storage.getCharacter(id);
}

async function getPlayerCharacters(playerId) {
  return await storage.getCharactersByPlayer(playerId);
}

async function recoverCharacter(characterName, backupCode) {
  return await storage.findCharacterByNameAndCode(characterName, backupCode);
}

async function getAllCharacters() {
  return await storage.getAllCharacters();
}

async function updateCharacter(id, updates) {
  const existing = await storage.getCharacter(id);
  if (!existing) throw new Error("Character not found");

  const updated = deepMerge(existing, updates);
  updated.lastModified = new Date().toISOString();

  return await storage.saveCharacter(updated);
}

async function deleteCharacterAsPlayer(characterId, playerId) {
  const character = await storage.getCharacter(characterId);

  if (!character) {
    return { success: false, error: "Character not found", statusCode: 404 };
  }

  if (character.playerId !== playerId) {
    return {
      success: false,
      error: "Unathorized: You don't own this character",
      statusCode: 403,
    };
  }

  const updatedCharacter = {
    ...character,
    deleted: true,
    deleteAt: new Date().toISOString(),
    deletedBy: "player",
    lastModified: new Date().toISOString(),
  };

  await storage.saveCharacter(updatedCharacter);

  await storage.markCharacterAsDeleted(characterId);

  return {
    success: true,
    type: "soft",
    message: "Character marked as deleted",
  };
}

async function deleteCharacterAsDM(characterId, dmToken) {
  if (!validateDmToken(dmToken)) {
    return { success: false, error: "Invalid DM token", statusCode: 401 };
  }

  const character = await storage.getCharacter(characterId);
  if (!character) {
    return { success: false, error: "Character not found", status: 404 };
  }

  await storage.hardDeleteCharacter(characterId);

  return {
    success: true,
    type: "hard",
    message: "Character permanently deleted",
  };
}

function deepMerge(target, source) {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }

  return output;
}

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

export {
  createCharacter,
  getCharacter,
  getPlayerCharacters,
  recoverCharacter,
  getAllCharacters,
  updateCharacter,
  deleteCharacterAsPlayer,
  deleteCharacterAsDM,
};
