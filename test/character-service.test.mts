import { describe, it, mock, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createTempDir } from "./helpers/temp-dir.mts";
import { makeCharacter } from "./helpers/fixtures.mts";

import type { TempDir } from "./helpers/temp-dir.mts";

// ── Setup: mock #config before importing models ───────────────────

const TEST_DM_TOKEN = "test-dm-token-svc";
let tempDir: TempDir;
tempDir = await createTempDir();

mock.module("#config", {
  namedExports: {
    DATA_DIR: tempDir.dir,
    REFERENCE_DIR: tempDir.referenceDir,
    LOCALES: ["en", "ru"] as const,
    DEFAULT_LOCALE: "en" as const,
    ENCODING: "utf8" as BufferEncoding,
    DM_TOKEN: TEST_DM_TOKEN,
  },
});

const service = await import("#models");
const storage = await import("#models/storage");

// ── Cleanup ───────────────────────────────────────────────────────

after(async () => {
  await tempDir.cleanup();
});

// ══════════════════════════════════════════════════════════════════
// Pre-init guard
// ══════════════════════════════════════════════════════════════════

// We can't easily reset the module-level binding once set by another
// test, so the pre-init test runs FIRST in this file (before init) and
// guards by calling a fresh service module that wouldn't have init yet.
// The simplest assertion: explicitly clearing init via re-init with stubs
// proves wiring works; the un-init throw is exercised by the message
// surfacing in storage.test.mts when run without init (covered there).

describe("initCharacterService", () => {
  it("createCharacter throws clearly without init", async () => {
    // This file's module instance hasn't been initialised yet at the very
    // top of the suite. Calling a mutation before init must throw.
    await assert.rejects(
      () => service.createCharacter("p", makeCharacter()),
      /Character service not initialised/,
    );
  });

  it("updateCharacter throws clearly without init", async () => {
    await assert.rejects(
      () => service.updateCharacter("nope", { location: "x" }),
      /Character service not initialised/,
    );
  });
});

// ══════════════════════════════════════════════════════════════════
// Service behavior with stubs
// ══════════════════════════════════════════════════════════════════

interface Spies {
  recalcCalls: Record<string, unknown>[];
  broadcastCalls: { id: string; character: Record<string, unknown> }[];
  broadcastDeletedCalls: string[];
}

let spies: Spies;

function wireStubs(): void {
  spies = { recalcCalls: [], broadcastCalls: [], broadcastDeletedCalls: [] };
  service.initCharacterService({
    recalc: (c) => {
      spies.recalcCalls.push(c);
      // mark so callers can prove the recalculated form was returned
      return { ...c, __recalced: true };
    },
    broadcast: (id, character) => {
      spies.broadcastCalls.push({ id, character });
    },
    broadcastDeleted: (id) => {
      spies.broadcastDeletedCalls.push(id);
    },
  });
}

describe("service.createCharacter", () => {
  beforeEach(wireStubs);

  it("runs recalc and does NOT broadcast", async () => {
    const result = await service.createCharacter("player-svc-1", {
      ...makeCharacter({ characterName: "NewSvc" }),
      // Strip server-controlled — service will re-stamp them.
      id: undefined,
      backupCode: undefined,
    });

    assert.equal(spies.recalcCalls.length, 1);
    assert.equal(spies.broadcastCalls.length, 0);
    assert.equal(spies.broadcastDeletedCalls.length, 0);
    // Returned character was the recalculated one.
    assert.equal((result as Record<string, unknown>).__recalced, true);
  });

  it("stamps id, backupCode, schemaVersion before recalc", async () => {
    const result = await service.createCharacter("player-svc-2", {
      characterName: "Stamped",
    });

    assert.ok(typeof result.id === "string" && result.id.length > 0);
    assert.ok(typeof result.backupCode === "string");
    assert.equal(result.schemaVersion, 1);
  });
});

describe("service.updateCharacter", () => {
  beforeEach(wireStubs);

  it("calls recalc once then broadcast once and returns recalculated character", async () => {
    const id = "svc-upd-01";
    await storage.saveCharacter(makeCharacter({ id, location: "Origin" }));

    spies.recalcCalls.length = 0; // disregard any setup recalc
    spies.broadcastCalls.length = 0;

    const result = await service.updateCharacter(id, { location: "Updated" });

    assert.equal(spies.recalcCalls.length, 1);
    assert.equal(spies.broadcastCalls.length, 1);
    assert.equal(spies.broadcastCalls[0]!.id, id);
    assert.equal((result as Record<string, unknown>).__recalced, true);
    assert.equal(result.location, "Updated");
  });

  it("uses skipUndefined merge — does not clobber existing fields with undefined", async () => {
    const id = "svc-upd-02";
    await storage.saveCharacter(
      makeCharacter({ id, location: "KeepMe", characterName: "Original" }),
    );

    // Simulate a portrait-style payload where one field is undefined.
    await service.updateCharacter(id, {
      location: undefined,
      characterName: "Renamed",
    });

    const fromDisk = await storage.getCharacter(id);
    assert.ok(fromDisk);
    assert.equal(fromDisk.location, "KeepMe");
    assert.equal(fromDisk.characterName, "Renamed");
  });
});

describe("service.deleteCharacterAsPlayer", () => {
  beforeEach(wireStubs);

  it("broadcasts the soft-deleted state and does NOT recalc", async () => {
    const id = "svc-del-01";
    await storage.saveCharacter(
      makeCharacter({ id, playerId: "owner-del-01" }),
    );

    spies.recalcCalls.length = 0;
    spies.broadcastCalls.length = 0;

    const result = await service.deleteCharacterAsPlayer(id, "owner-del-01");

    assert.equal(result.success, true);
    assert.equal(spies.recalcCalls.length, 0);
    assert.equal(spies.broadcastCalls.length, 1);
    assert.equal(spies.broadcastCalls[0]!.character.deleted, true);
  });

  it("does not broadcast on auth failure", async () => {
    const id = "svc-del-02";
    await storage.saveCharacter(
      makeCharacter({ id, playerId: "owner-del-02" }),
    );

    spies.broadcastCalls.length = 0;

    const result = await service.deleteCharacterAsPlayer(id, "wrong-player");

    assert.equal(result.success, false);
    assert.equal(spies.broadcastCalls.length, 0);
  });
});

describe("service.deleteCharacterAsDM", () => {
  beforeEach(wireStubs);

  it("broadcasts a final deletion event after hard delete", async () => {
    const id = "svc-hd-01";
    await storage.saveCharacter(makeCharacter({ id }));

    spies.broadcastDeletedCalls.length = 0;

    const result = await service.deleteCharacterAsDM(id, TEST_DM_TOKEN);

    assert.equal(result.success, true);
    assert.deepEqual(spies.broadcastDeletedCalls, [id]);
  });

  it("does not broadcast on invalid DM token", async () => {
    spies.broadcastDeletedCalls.length = 0;
    const result = await service.deleteCharacterAsDM("any-id", "bad-token");
    assert.equal(result.success, false);
    assert.equal(spies.broadcastDeletedCalls.length, 0);
  });
});
