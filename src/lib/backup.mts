import {
  ensureBackupDirs,
  LIVE_DATA_DIR,
  BACKUP_CHAR_DIR,
  BACKUP_INDEX,
} from "../models/storage.mts";
import { ENCODING } from "#config";
import fs from "node:fs/promises";
import path from "node:path";

async function createCharacterBackup(characterId, note = "") {
  await ensureBackupDirs();

  const liveFilePath = path.join(LIVE_DATA_DIR, `${characterId}.json`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${characterId}_snapshot_${timestamp}.json`;
  const backupFilePath = path.join(BACKUP_CHAR_DIR, backupFileName);

  const characterData = await fs.readFile(liveFilePath, ENCODING);
  await fs.writeFile(backupFilePath, characterData);

  const backupRecord = {
    id: `backup_${timestamp}`,
    characterId: characterId,
    timestamp: new Date().toISOString(),
    trigger: "manual",
    note: note,
    file: backupFileName,
  };

  let index = [];
  try {
    const indexData = await fs.readFile(BACKUP_INDEX, ENCODING);
    index = JSON.parse(indexData);
  } catch (error) {
    // doesn't exist
  }
  index.push(backupRecord);
  await fs.writeFile(BACKUP_INDEX, JSON.stringify(index, null, 2));

  return backupRecord;
}

async function restoreCharacterBackup(backupId) {
  const indexData = await fs.readFile(BACKUP_INDEX, ENCODING);
  const index = JSON.parse(indexData);
  const backupRecord = index.find((record) => record.id === backupId);

  if (!backupRecord) {
    throw new Error(`Backup with ID ${backupId} not found.`);
  }

  const backupFilePath = path.join(BACKUP_CHAR_DIR, backupRecord.file);
  const liveFilePath = path.join(
    LIVE_DATA_DIR,
    `${backupRecord.characterId}.json`
  );

  const backupData = await fs.readFile(backupFilePath, ENCODING);
  await fs.writeFile(liveFilePath, backupData);

  // rollback guard
  // await createCharacterBackup(backupRecord.characterId, `Pre-restore guard for ${backupId}`);

  return {
    message: `Character ${backupRecord.characterId} restored from backup ${backupId}`,
    restoredTo: backupRecord.timestamp,
  };
}

async function listCharacterBackups(characterId = null) {
  const indexData = await fs.readFile(BACKUP_INDEX, ENCODING);
  let index = JSON.parse(indexData);

  if (characterId) {
    index = index.filter((record) => record.characterId === characterId);
  }
  return index;
}

export { createCharacterBackup, restoreCharacterBackup, listCharacterBackups };
