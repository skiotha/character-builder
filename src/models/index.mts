import { generateId, generateBackupCode } from "../lib/utils.mts";
import * as storage from "./storage.mts";
import { validateDmToken } from "#auth";

import type { DeleteResult } from "#types";
import type { Character } from "#rpg-types";

// ── Service binding (ADR-013) ───────────────────────────────────────
//
// The domain layer is the single mutation gate. Cross-cutting invariants
// (recalculating derived fields, broadcasting SSE updates) live here, but
// `models/` must not import from `#sse` or `#rules` directly — that would
// invert the layering. Instead, `app.mts` calls `initCharacterService(...)`
// once at startup with the real implementations.
//
// Mutations call `requireService()` and throw a clear error if init was
// forgotten — this catches both production wiring mistakes and tests that
// exercise mutations without setting up stubs.

type RecalcFn = (character: Character) => Character;

type BroadcastFn = (
  characterId: string,
  character: Record<string, unknown>,
) => void;

type DeletedBroadcastFn = (characterId: string) => void;

interface CharacterServiceDeps {
  recalc: RecalcFn;
  broadcast: BroadcastFn;
  broadcastDeleted: DeletedBroadcastFn;
}

let serviceDeps: CharacterServiceDeps | null = null;

function initCharacterService(deps: CharacterServiceDeps): void {
  serviceDeps = deps;
}

function requireService(): CharacterServiceDeps {
  if (!serviceDeps) {
    throw new Error(
      "Character service not initialised. Call initCharacterService() at app startup.",
    );
  }
  return serviceDeps;
}

// ── Mutations ───────────────────────────────────────────────────────

async function createCharacter(
  playerId: string,
  characterData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { recalc } = requireService();

  const stamped: Record<string, unknown> = {
    ...characterData,
    id: generateId(),
    backupCode: generateBackupCode(),
    schemaVersion: 2,
  };

  const recalculated = recalc(
    stamped as unknown as Character,
  ) as unknown as Record<string, unknown>;

  // No broadcast on create — there can be no subscribers for a brand-new id.
  return await storage.saveCharacter(recalculated);
}

async function updateCharacter(
  id: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { recalc, broadcast } = requireService();

  const updated = await storage.updateCharacter(
    id,
    updates,
    (c) =>
      recalc(c as unknown as Character) as unknown as Record<string, unknown>,
  );

  broadcast(id, updated);

  return updated;
}

async function deleteCharacterAsPlayer(
  characterId: string,
  playerId: string,
): Promise<DeleteResult> {
  const { broadcast } = requireService();

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

  // Soft delete: no recalc (the deleted flag has no derived consequence),
  // but broadcast so subscribers see the deletion.
  const updated = await storage.updateCharacter(characterId, {
    deleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: "player",
  });

  broadcast(characterId, updated);

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
  const { broadcastDeleted } = requireService();

  if (!validateDmToken(dmToken)) {
    return { success: false, error: "Invalid DM token", statusCode: 401 };
  }

  const character = await storage.getCharacter(characterId);
  if (!character) {
    return { success: false, error: "Character not found", statusCode: 404 };
  }

  await storage.hardDeleteCharacter(characterId);

  // Final SSE event so subscribers can drop their connection cleanly.
  broadcastDeleted(characterId);

  return {
    success: true,
    type: "hard",
    message: "Character permanently deleted",
  };
}

// ── Reads (pass-through to storage) ─────────────────────────────────

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

export type { DeleteResult } from "#types";
export type { CharacterServiceDeps };

// Startup-injected default seeds (NB-45) — wired alongside
// `initCharacterService` in `app.mts`.
export { initDefaultSeeds } from "./schema-utils.mts";

export {
  initCharacterService,
  createCharacter,
  getCharacter,
  getPlayerCharacters,
  recoverCharacter,
  getAllCharacters,
  updateCharacter,
  deleteCharacterAsPlayer,
  deleteCharacterAsDM,
};
