import fs from "node:fs/promises";
import path from "node:path";

import {
  ensureBackupDirs,
  LIVE_DATA_DIR,
  BACKUP_CHAR_DIR,
  BACKUP_INDEX,
} from "#models/storage";

import { ENCODING } from "#config";

import type { BackupRecord } from "#types";

async function createCharacterBackup(
  characterId: string,
  note: string = "",
): Promise<BackupRecord> {
  await ensureBackupDirs();

  const liveFilePath = path.join(LIVE_DATA_DIR, `${characterId}.json`);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${characterId}_snapshot_${timestamp}.json`;
  const backupFilePath = path.join(BACKUP_CHAR_DIR, backupFileName);

  const characterData = await fs.readFile(liveFilePath, ENCODING);
  await fs.writeFile(backupFilePath, characterData);

  const backupRecord: BackupRecord = {
    id: `backup_${timestamp}`,
    characterId: characterId,
    timestamp: new Date().toISOString(),
    trigger: "manual",
    note: note,
    file: backupFileName,
  };

  let index: BackupRecord[] = [];
  try {
    const indexData = await fs.readFile(BACKUP_INDEX, ENCODING);
    index = JSON.parse(indexData) as BackupRecord[];
  } catch {
    // doesn't exist
  }
  index.push(backupRecord);
  await fs.writeFile(BACKUP_INDEX, JSON.stringify(index, null, 2));

  return backupRecord;
}

async function restoreCharacterBackup(
  backupId: string,
): Promise<{ message: string; restoredTo: string }> {
  const indexData = await fs.readFile(BACKUP_INDEX, ENCODING);
  const index = JSON.parse(indexData) as BackupRecord[];
  const backupRecord = index.find((record) => record.id === backupId);

  if (!backupRecord) {
    throw new Error(`Backup with ID ${backupId} not found.`);
  }

  const backupFilePath = path.join(BACKUP_CHAR_DIR, backupRecord.file);
  const liveFilePath = path.join(
    LIVE_DATA_DIR,
    `${backupRecord.characterId}.json`,
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

async function listCharacterBackups(
  characterId: string | null = null,
): Promise<BackupRecord[]> {
  const indexData = await fs.readFile(BACKUP_INDEX, ENCODING);
  let index = JSON.parse(indexData) as BackupRecord[];

  if (characterId) {
    index = index.filter((record) => record.characterId === characterId);
  }
  return index;
}

export { createCharacterBackup, restoreCharacterBackup, listCharacterBackups };
