import { describe, it, mock, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { createTempDir } from "./helpers/temp-dir.mts";
import { makeCharacter } from "./helpers/fixtures.mts";

import type { TempDir } from "./helpers/temp-dir.mts";

// ── Setup: mock #config before importing storage modules ──────────

let tempDir: TempDir;
const TEST_DM_TOKEN = "test-dm-token-storage";

// Create temp dir synchronously before mock.module (needs a real path)
tempDir = await createTempDir();

mock.module("#config", {
  namedExports: {
    DATA_DIR: tempDir.dir,
    ENCODING: "utf8" as BufferEncoding,
    DM_TOKEN: TEST_DM_TOKEN,
  },
});

// Import after mock — storage.mts and uploads.mts top-level awaits
// resolve paths from the mocked DATA_DIR.
const storage = await import("#models/storage");
const service = await import("#models");

// ── Helpers ───────────────────────────────────────────────────────

async function readIndex(): Promise<Record<string, unknown>> {
  const indexPath = path.join(tempDir.dir, "index.json");
  const data = await fs.readFile(indexPath, "utf8");
  return JSON.parse(data);
}

async function readCharacterFile(id: string): Promise<Record<string, unknown>> {
  const filePath = path.join(tempDir.dir, "characters", `${id}.json`);
  const data = await fs.readFile(filePath, "utf8");
  return JSON.parse(data);
}

async function characterFileExists(id: string): Promise<boolean> {
  try {
    await fs.access(path.join(tempDir.dir, "characters", `${id}.json`));
    return true;
  } catch {
    return false;
  }
}

// ── Cleanup ───────────────────────────────────────────────────────

after(async () => {
  await tempDir.cleanup();
});

// ══════════════════════════════════════════════════════════════════
// storage.mts — low-level storage functions
// ══════════════════════════════════════════════════════════════════

describe("saveCharacter", () => {
  it("writes character file to characters/{id}.json", async () => {
    const char = makeCharacter({ id: "save-file-01" });
    await storage.saveCharacter(char);

    const saved = await readCharacterFile("save-file-01");
    assert.equal(saved.characterName, "Testara");
    assert.equal(saved.id, "save-file-01");
  });

  it("updates byId index map", async () => {
    const char = makeCharacter({ id: "save-idx-01", characterName: "Aldara" });
    await storage.saveCharacter(char);

    const index = await readIndex();
    const byId = index.byId as Record<string, Record<string, unknown>>;
    assert.ok(byId["save-idx-01"]);
    assert.equal(byId["save-idx-01"]!.name, "Aldara");
  });

  it("includes deleted and deletedAt in index entry", async () => {
    const char = makeCharacter({ id: "save-del-01" });
    await storage.saveCharacter(char);

    const index = await readIndex();
    const byId = index.byId as Record<string, Record<string, unknown>>;
    assert.equal(byId["save-del-01"]!.deleted, false);
    assert.equal(byId["save-del-01"]!.deletedAt, undefined);
  });

  it("updates byBackupCode index map", async () => {
    const char = makeCharacter({
      id: "save-bc-01",
      backupCode: "Test-Code-100",
    });
    await storage.saveCharacter(char);

    const index = await readIndex();
    const byBackupCode = index.byBackupCode as Record<string, string>;
    assert.equal(byBackupCode["Test-Code-100"], "save-bc-01");
  });

  it("updates byPlayer index map", async () => {
    const char = makeCharacter({ id: "save-bp-01", playerId: "player-bp" });
    await storage.saveCharacter(char);

    const index = await readIndex();
    const byPlayer = index.byPlayer as Record<string, string[]>;
    assert.ok(byPlayer["player-bp"]!.includes("save-bp-01"));
  });

  it("updates all index array", async () => {
    const char = makeCharacter({ id: "save-all-01" });
    await storage.saveCharacter(char);

    const index = await readIndex();
    const all = index.all as string[];
    assert.ok(all.includes("save-all-01"));
  });

  it("does not duplicate in all or byPlayer on re-save", async () => {
    const char = makeCharacter({ id: "save-dedup-01", playerId: "player-dd" });
    await storage.saveCharacter(char);
    await storage.saveCharacter(char);

    const index = await readIndex();
    const all = index.all as string[];
    const byPlayer = index.byPlayer as Record<string, string[]>;

    const allCount = all.filter((id) => id === "save-dedup-01").length;
    const playerCount = byPlayer["player-dd"]!.filter(
      (id) => id === "save-dedup-01",
    ).length;

    assert.equal(allCount, 1);
    assert.equal(playerCount, 1);
  });

  it("creates separate byPlayer entries for different players", async () => {
    const char1 = makeCharacter({
      id: "save-mp-01",
      playerId: "player-alpha",
    });
    const char2 = makeCharacter({
      id: "save-mp-02",
      playerId: "player-beta",
    });
    await storage.saveCharacter(char1);
    await storage.saveCharacter(char2);

    const index = await readIndex();
    const byPlayer = index.byPlayer as Record<string, string[]>;
    assert.ok(byPlayer["player-alpha"]!.includes("save-mp-01"));
    assert.ok(byPlayer["player-beta"]!.includes("save-mp-02"));
    assert.ok(!byPlayer["player-alpha"]!.includes("save-mp-02"));
  });
});

describe("getCharacter", () => {
  it("returns parsed JSON for existing character", async () => {
    const char = makeCharacter({
      id: "get-exist-01",
      characterName: "Fetched",
    });
    await storage.saveCharacter(char);

    const result = await storage.getCharacter("get-exist-01");
    assert.ok(result);
    assert.equal(result.characterName, "Fetched");
  });

  it("returns null for non-existent ID", async () => {
    const result = await storage.getCharacter("non-existent-id");
    assert.equal(result, null);
  });
});

describe("updateCharacter", () => {
  it("merges updates into existing character", async () => {
    const char = makeCharacter({
      id: "upd-merge-01",
      characterName: "Before",
    });
    await storage.saveCharacter(char);

    const updated = await storage.updateCharacter("upd-merge-01", {
      characterName: "After",
    });
    assert.equal(updated.characterName, "After");

    const fromDisk = await readCharacterFile("upd-merge-01");
    assert.equal(fromDisk.characterName, "After");
  });

  it("sets lastModified to current ISO string", async () => {
    const char = makeCharacter({
      id: "upd-time-01",
      lastModified: "2020-01-01T00:00:00.000Z",
    });
    await storage.saveCharacter(char);

    const updated = await storage.updateCharacter("upd-time-01", {
      location: "Tavern",
    });
    assert.notEqual(updated.lastModified, "2020-01-01T00:00:00.000Z");
    assert.ok(
      typeof updated.lastModified === "string" &&
        updated.lastModified.includes("T"),
    );
  });

  it("updates index metadata when characterName changes", async () => {
    const char = makeCharacter({
      id: "upd-meta-01",
      characterName: "OldName",
    });
    await storage.saveCharacter(char);

    await storage.updateCharacter("upd-meta-01", {
      characterName: "NewName",
    });

    const index = await readIndex();
    const byId = index.byId as Record<string, Record<string, unknown>>;
    assert.equal(byId["upd-meta-01"]!.name, "NewName");
  });

  it("does not rewrite index when non-metadata field changes", async () => {
    const char = makeCharacter({ id: "upd-nometa-01" });
    await storage.saveCharacter(char);

    // Read index file content before non-metadata update
    const indexBefore = await fs.readFile(
      path.join(tempDir.dir, "index.json"),
      "utf8",
    );

    await storage.updateCharacter("upd-nometa-01", {
      location: "Forest",
    });

    // Index content should be unchanged (location is not tracked in index)
    const indexAfter = await fs.readFile(
      path.join(tempDir.dir, "index.json"),
      "utf8",
    );
    assert.equal(indexBefore, indexAfter);
  });

  it("throws 'Character not found' for non-existent ID", async () => {
    await assert.rejects(
      () => storage.updateCharacter("upd-ghost-01", { location: "X" }),
      { message: "Character not found" },
    );
  });
});

describe("getCharactersByPlayer", () => {
  it("returns non-deleted characters for player", async () => {
    const char = makeCharacter({
      id: "gbp-ok-01",
      playerId: "player-gbp",
      characterName: "Alive",
    });
    await storage.saveCharacter(char);

    const results = await storage.getCharactersByPlayer("player-gbp");
    assert.ok(results.some((c) => c.id === "gbp-ok-01"));
  });

  it("returns empty array for unknown player", async () => {
    const results = await storage.getCharactersByPlayer("player-unknown-xyz");
    assert.deepEqual(results, []);
  });

  it("excludes deleted characters", async () => {
    const char = makeCharacter({
      id: "gbp-del-01",
      playerId: "player-gbp-del",
      deleted: true,
    });
    await storage.saveCharacter(char);

    const results = await storage.getCharactersByPlayer("player-gbp-del");
    assert.ok(!results.some((c) => c.id === "gbp-del-01"));
  });
});

describe("findCharacterByNameAndCode", () => {
  before(async () => {
    const char = makeCharacter({
      id: "find-01",
      characterName: "Searcha",
      backupCode: "Find-Code-999",
    });
    await storage.saveCharacter(char);
  });

  it("returns character for correct name and code", async () => {
    const result = await storage.findCharacterByNameAndCode(
      "Searcha",
      "Find-Code-999",
    );
    assert.ok(result);
    assert.equal(result.id, "find-01");
  });

  it("matches name case-insensitively", async () => {
    const result = await storage.findCharacterByNameAndCode(
      "sEaRcHa",
      "Find-Code-999",
    );
    assert.ok(result);
    assert.equal(result.id, "find-01");
  });

  it("returns null for wrong code", async () => {
    const result = await storage.findCharacterByNameAndCode(
      "Searcha",
      "Wrong-Code-000",
    );
    assert.equal(result, null);
  });

  it("returns null for wrong name with correct code", async () => {
    const result = await storage.findCharacterByNameAndCode(
      "WrongName",
      "Find-Code-999",
    );
    assert.equal(result, null);
  });
});

describe("getAllCharacters", () => {
  it("returns all saved characters", async () => {
    const results = await storage.getAllCharacters();
    // Previous tests saved several characters — at least one should exist
    assert.ok(results.length > 0);
    assert.ok(results.every((c) => typeof c.id === "string"));
  });
});

describe("hardDeleteCharacter", () => {
  it("removes character file from disk", async () => {
    const char = makeCharacter({ id: "hard-del-01" });
    await storage.saveCharacter(char);

    assert.ok(await characterFileExists("hard-del-01"));
    await storage.hardDeleteCharacter("hard-del-01");
    assert.ok(!(await characterFileExists("hard-del-01")));
  });

  it("removes from all 4 index maps", async () => {
    const char = makeCharacter({
      id: "hard-del-02",
      playerId: "player-hd",
      backupCode: "Hard-Del-222",
    });
    await storage.saveCharacter(char);
    await storage.hardDeleteCharacter("hard-del-02");

    const index = await readIndex();
    const byId = index.byId as Record<string, unknown>;
    const byBackupCode = index.byBackupCode as Record<string, unknown>;
    const byPlayer = index.byPlayer as Record<string, string[]>;
    const all = index.all as string[];

    assert.equal(byId["hard-del-02"], undefined);
    assert.equal(byBackupCode["Hard-Del-222"], undefined);
    assert.ok(!all.includes("hard-del-02"));
    // byPlayer may still have the key with empty array, or key removed
    if (byPlayer["player-hd"]) {
      assert.ok(!byPlayer["player-hd"]!.includes("hard-del-02"));
    }
  });

  it("removes player key from byPlayer when last character deleted", async () => {
    const uniquePlayer = "player-hd-last";
    const char = makeCharacter({
      id: "hard-del-03",
      playerId: uniquePlayer,
      backupCode: "Hard-Del-333",
    });
    await storage.saveCharacter(char);

    // Verify the player exists in byPlayer
    let index = await readIndex();
    let byPlayer = index.byPlayer as Record<string, string[]>;
    assert.ok(byPlayer[uniquePlayer]);

    await storage.hardDeleteCharacter("hard-del-03");

    index = await readIndex();
    byPlayer = index.byPlayer as Record<string, string[]>;
    assert.equal(byPlayer[uniquePlayer], undefined);
  });

  it("deletes portrait directory", async () => {
    const charId = "hard-del-04";
    const char = makeCharacter({
      id: charId,
      backupCode: "Hard-Del-444",
    });
    await storage.saveCharacter(char);

    // Create a fake portrait directory with a file
    const portraitDir = path.join(tempDir.dir, "uploads", "portraits", charId);
    await fs.mkdir(portraitDir, { recursive: true });
    await fs.writeFile(path.join(portraitDir, "portrait.jpg"), "fake-image");

    await storage.hardDeleteCharacter(charId);

    // Portrait directory should be gone
    try {
      await fs.access(portraitDir);
      assert.fail("Portrait directory should have been deleted");
    } catch {
      // Expected — directory does not exist
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// index.mts — service layer
// ══════════════════════════════════════════════════════════════════

describe("createCharacter", () => {
  it("generates id and backupCode", async () => {
    const charData = makeCharacter();
    const result = await service.createCharacter("player-create", charData);

    assert.ok(typeof result.id === "string" && result.id.length > 0);
    assert.ok(
      typeof result.backupCode === "string" && result.backupCode.length > 0,
    );
    // Generated values override fixture values
    assert.notEqual(result.id, "test-id-0000-0000-000000000000");
  });

  it("persists character to disk via storage", async () => {
    const charData = makeCharacter({ characterName: "Created" });
    const result = await service.createCharacter("player-create2", charData);

    const fromDisk = await storage.getCharacter(result.id as string);
    assert.ok(fromDisk);
    assert.equal(fromDisk.characterName, "Created");
  });
});

describe("deleteCharacterAsPlayer", () => {
  it("soft-deletes when player owns character", async () => {
    const char = makeCharacter({
      id: "svc-del-01",
      playerId: "owner-player",
    });
    await storage.saveCharacter(char);

    const result = await service.deleteCharacterAsPlayer(
      "svc-del-01",
      "owner-player",
    );
    assert.equal(result.success, true);
    assert.equal(result.type, "soft");

    // Character file should have deleted: true
    const fromDisk = await readCharacterFile("svc-del-01");
    assert.equal(fromDisk.deleted, true);
    assert.ok(typeof fromDisk.deletedAt === "string");

    // Index should also reflect deletion (fix A1 — single write)
    const index = await readIndex();
    const byId = index.byId as Record<string, Record<string, unknown>>;
    assert.equal(byId["svc-del-01"]!.deleted, true);
  });

  it("returns 403 for wrong player", async () => {
    const char = makeCharacter({
      id: "svc-del-02",
      playerId: "real-owner",
    });
    await storage.saveCharacter(char);

    const result = await service.deleteCharacterAsPlayer(
      "svc-del-02",
      "impostor",
    );
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 403);
  });

  it("returns 404 for non-existent character", async () => {
    const result = await service.deleteCharacterAsPlayer(
      "svc-del-ghost",
      "anyone",
    );
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 404);
  });
});

describe("deleteCharacterAsDM", () => {
  it("hard-deletes with valid DM token", async () => {
    const char = makeCharacter({
      id: "svc-dm-01",
      backupCode: "DM-Del-111",
    });
    await storage.saveCharacter(char);

    const result = await service.deleteCharacterAsDM(
      "svc-dm-01",
      TEST_DM_TOKEN,
    );
    assert.equal(result.success, true);
    assert.equal(result.type, "hard");

    // Character should be gone from disk
    assert.ok(!(await characterFileExists("svc-dm-01")));
  });

  it("returns 401 for invalid DM token", async () => {
    const result = await service.deleteCharacterAsDM(
      "svc-dm-02",
      "wrong-token",
    );
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 401);
  });

  it("returns 404 for non-existent character", async () => {
    const result = await service.deleteCharacterAsDM(
      "svc-dm-ghost",
      TEST_DM_TOKEN,
    );
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 404);
  });
});

describe("recoverCharacter", () => {
  it("delegates to findCharacterByNameAndCode", async () => {
    const char = makeCharacter({
      id: "svc-recover-01",
      characterName: "Recovera",
      backupCode: "Recover-Code-777",
    });
    await storage.saveCharacter(char);

    const result = await service.recoverCharacter(
      "Recovera",
      "Recover-Code-777",
    );
    assert.ok(result);
    assert.equal(result.id, "svc-recover-01");
  });

  it("returns null when name or code do not match", async () => {
    const result = await service.recoverCharacter("Nobody", "Fake-Code-000");
    assert.equal(result, null);
  });
});
