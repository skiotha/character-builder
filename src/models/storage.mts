import fs from "node:fs/promises";
import path from "node:path";

import { deletePortrait } from "../lib/uploads.mts";
import { deepMerge } from "./traversal.mts";

import { ENCODING, DATA_DIR } from "#config";

import type { CharacterIndex, CharacterIndexEntry } from "#types";

const LIVE_DATA_DIR = path.join(DATA_DIR, "characters");
const INDEX_FILE = path.join(DATA_DIR, "index.json");
const BACKUP_ROOT_DIR = path.join(DATA_DIR, "backups");
const BACKUP_CHAR_DIR = path.join(BACKUP_ROOT_DIR, "characters");
const BACKUP_INDEX = path.join(BACKUP_ROOT_DIR, "index.json");

async function ensureBackupDirs(): Promise<void> {
  const fs = await import("fs/promises");
  await fs.mkdir(BACKUP_CHAR_DIR, { recursive: true });
}

await fs.mkdir(LIVE_DATA_DIR, { recursive: true });

let characterIndex: CharacterIndex = {} as CharacterIndex;

try {
  const indexData = await fs.readFile(INDEX_FILE, ENCODING);
  characterIndex = JSON.parse(indexData) as CharacterIndex;
} catch {
  characterIndex = {
    byId: {},
    byBackupCode: {},
    byPlayer: {},
    all: [],
  };

  await saveIndex();
}

async function writeCharacterFile(
  character: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const filename = path.join(LIVE_DATA_DIR, `${character.id as string}.json`);
  await fs.writeFile(filename, JSON.stringify(character, null, 2));
  return character;
}

async function updateIndexMetadata(
  character: Record<string, unknown>,
): Promise<void> {
  characterIndex.byId[character.id as string] = buildIndexEntry(character);

  await saveIndex();
}

function buildIndexEntry(
  character: Record<string, unknown>,
): CharacterIndexEntry {
  return {
    name: character.characterName as string,
    playerId: character.playerId as string,
    backupCode: character.backupCode as string,
    created: character.created as string,
    deleted: (character.deleted as boolean) || false,
    deletedAt: character.deletedAt as string | undefined,
  };
}

async function saveIndex(): Promise<void> {
  await fs.writeFile(INDEX_FILE, JSON.stringify(characterIndex, null, 2));
}

// ── Per-character write serialization ───────────────────────────
//
// Defense-in-depth against concurrent writes to the same character file.
// Lives in storage so the lock is acquired regardless of caller (the
// no-storage-imports convention from ADR-013 is enforced by review, not
// by the runtime — this lock keeps us correct even if someone slips).
//
// Each entry chains a new write onto the previous promise. Map entries are
// removed when their chain settles, but only if the slot still points at
// the same promise (a fresher enqueue wins the slot).

const writeLocks = new Map<string, Promise<unknown>>();

async function withWriteLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeLocks.get(id) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  writeLocks.set(id, next);

  // Schedule cleanup without holding onto the rejection — the caller's
  // `await next` is the only place the error should surface.
  next.then(
    () => {
      if (writeLocks.get(id) === next) writeLocks.delete(id);
    },
    () => {
      if (writeLocks.get(id) === next) writeLocks.delete(id);
    },
  );

  return next;
}

async function saveCharacter(
  character: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return withWriteLock(character.id as string, () =>
    _saveCharacterUnlocked(character),
  );
}

async function _saveCharacterUnlocked(
  character: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const filename = path.join(LIVE_DATA_DIR, `${character.id as string}.json`);

  characterIndex.byId[character.id as string] = buildIndexEntry(character);

  characterIndex.byBackupCode[character.backupCode as string] =
    character.id as string;

  if (!characterIndex.byPlayer[character.playerId as string]) {
    characterIndex.byPlayer[character.playerId as string] = [];
  }
  if (
    !characterIndex.byPlayer[character.playerId as string]!.includes(
      character.id as string,
    )
  ) {
    characterIndex.byPlayer[character.playerId as string]!.push(
      character.id as string,
    );
  }

  if (!characterIndex.all.includes(character.id as string)) {
    characterIndex.all.push(character.id as string);
  }

  await fs.writeFile(filename, JSON.stringify(character, null, 2));
  await saveIndex();

  return character;
}

/**
 * Merge `updates` into the stored character, optionally pass the result
 * through `transform` (e.g. derived-field recalc) before persisting,
 * and write to disk under the per-character write lock.
 *
 * Index metadata is rewritten only when one of the indexed fields
 * actually changes.
 */
async function updateCharacter(
  id: string,
  updates: Record<string, unknown>,
  transform?: (character: Record<string, unknown>) => Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return withWriteLock(id, async () => {
    const existing = await getCharacter(id);
    if (!existing) throw new Error("Character not found");

    let updated = deepMerge(existing, updates, { skipUndefined: true });
    updated.lastModified = new Date().toISOString();

    if (transform) {
      updated = transform(updated);
    }

    await writeCharacterFile(updated);

    const metadataFields = [
      "characterName",
      "playerId",
      "backupCode",
      "deleted",
      "deletedAt",
    ];
    const metadataChanged = metadataFields.some(
      (field) =>
        JSON.stringify((existing as Record<string, unknown>)[field]) !==
        JSON.stringify((updated as Record<string, unknown>)[field]),
    );

    if (metadataChanged) {
      await updateIndexMetadata(updated);
    }

    return updated;
  });
}

async function getCharacter(
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const filename = path.join(LIVE_DATA_DIR, `${id}.json`);
    const data = await fs.readFile(filename, ENCODING);
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function getCharactersByPlayer(
  playerId: string,
): Promise<Record<string, unknown>[]> {
  const charIds = characterIndex.byPlayer[playerId] || [];
  const characters: Record<string, unknown>[] = [];

  for (const id of charIds) {
    const char = await getCharacter(id);
    if (char && !(char as Record<string, unknown>).deleted)
      characters.push(char);
  }

  return characters;
}

async function findCharacterByNameAndCode(
  name: string,
  backupCode: string,
): Promise<Record<string, unknown> | null> {
  const charId = characterIndex.byBackupCode[backupCode];
  if (!charId) return null;

  const char = await getCharacter(charId);
  if (
    char &&
    (char.characterName as string).toLowerCase() === name.toLowerCase()
  ) {
    return char;
  }
  return null;
}

async function getAllCharacters(): Promise<Record<string, unknown>[]> {
  const characters: Record<string, unknown>[] = [];
  for (const id of characterIndex.all) {
    const char = await getCharacter(id);
    if (char) characters.push(char);
  }
  return characters;
}

async function hardDeleteCharacter(characterId: string): Promise<boolean> {
  return withWriteLock(characterId, () =>
    _hardDeleteCharacterUnlocked(characterId),
  );
}

async function _hardDeleteCharacterUnlocked(
  characterId: string,
): Promise<boolean> {
  try {
    const charInfo = characterIndex.byId[characterId];

    try {
      await deletePortrait(characterId);
    } catch (portraitError) {
      console.warn(
        `Portrait deletion failed for ${characterId}:`,
        (portraitError as Error).message,
      );
    }

    const filename = path.join(LIVE_DATA_DIR, `${characterId}.json`);
    await fs.unlink(filename);

    if (charInfo) {
      delete characterIndex.byId[characterId];

      delete characterIndex.byBackupCode[charInfo.backupCode];

      if (characterIndex.byPlayer[charInfo.playerId]) {
        characterIndex.byPlayer[charInfo.playerId] = characterIndex.byPlayer[
          charInfo.playerId
        ]!.filter((id: string) => id !== characterId);

        if (characterIndex.byPlayer[charInfo.playerId]!.length === 0) {
          delete characterIndex.byPlayer[charInfo.playerId];
        }
      }

      characterIndex.all = characterIndex.all.filter(
        (id) => id !== characterId,
      );

      await saveIndex();
    }

    return true;
  } catch (error) {
    console.log("Hard delete failed:", error);
    throw new Error("Failed to delete character");
  }
}

export {
  saveCharacter,
  getCharacter,
  updateCharacter,
  getCharactersByPlayer,
  findCharacterByNameAndCode,
  getAllCharacters,
  ensureBackupDirs,
  LIVE_DATA_DIR,
  BACKUP_CHAR_DIR,
  BACKUP_INDEX,
  hardDeleteCharacter,
};
