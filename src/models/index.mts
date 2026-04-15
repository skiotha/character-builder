import { generateId, generateBackupCode } from "../lib/utils.mts";
import { generateDefaultCharacter } from "./schema-utils.mts";
import { validateCharacterCreation } from "./validation.mts";
import * as storage from "./storage.mts";
import { validateDmToken } from "#auth";
import type { DeleteResult } from "#types";

async function createCharacter(
  playerId: string,
  characterData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
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

async function getCharacter(
  id: string,
): Promise<Record<string, unknown> | null> {
  return await storage.getCharacter(id);
}

async function getPlayerCharacters(
  playerId: string,
): Promise<Record<string, unknown>[]> {
  return await storage.getCharactersByPlayer(playerId);
}

async function recoverCharacter(
  characterName: string,
  backupCode: string,
): Promise<Record<string, unknown> | null> {
  return await storage.findCharacterByNameAndCode(characterName, backupCode);
}

async function getAllCharacters(): Promise<Record<string, unknown>[]> {
  return await storage.getAllCharacters();
}

async function updateCharacter(
  id: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existing = await storage.getCharacter(id);
  if (!existing) throw new Error("Character not found");

  const updated = deepMerge(existing, updates);
  updated.lastModified = new Date().toISOString();

  return await storage.saveCharacter(updated);
}

async function deleteCharacterAsPlayer(
  characterId: string,
  playerId: string,
): Promise<DeleteResult> {
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
    deletedAt: new Date().toISOString(),
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

async function deleteCharacterAsDM(
  characterId: string,
  dmToken: string | string[] | undefined,
): Promise<DeleteResult> {
  if (!validateDmToken(dmToken)) {
    return { success: false, error: "Invalid DM token", statusCode: 401 };
  }

  const character = await storage.getCharacter(characterId);
  if (!character) {
    return { success: false, error: "Character not found", statusCode: 404 };
  }

  await storage.hardDeleteCharacter(characterId);

  return {
    success: true,
    type: "hard",
    message: "Character permanently deleted",
  };
}

// @TODO Phase 5: remove duplicate — use deepMerge from #models/traversal
// This local copy lacks skipUndefined support, diverging from the canonical version.
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>,
          );
        }
      } else {
        output[key] = source[key];
      }
    });
  }

  return output;
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === "object" && !Array.isArray(item);
}

export type { DeleteResult } from "#types";

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
