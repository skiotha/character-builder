import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitizeCharacterForRole } from "#models/sanitization";

// ── sanitizeCharacterForRole ──────────────────────────────────────

describe("sanitizeCharacterForRole", () => {
  function makeData(): Record<string, unknown> {
    return {
      id: "test-id",
      characterName: "Testara",
      backupCode: "Iron-Wolf-123",
      playerId: "player-1",
      player: "Test Player",
    };
  }

  it("preserves backupCode and playerId for dm role", () => {
    const data = makeData();
    sanitizeCharacterForRole(data, "dm");
    assert.equal(data.backupCode, "Iron-Wolf-123");
    assert.equal(data.playerId, "player-1");
  });

  it("preserves backupCode and playerId for owner role", () => {
    const data = makeData();
    sanitizeCharacterForRole(data, "owner");
    assert.equal(data.backupCode, "Iron-Wolf-123");
    assert.equal(data.playerId, "player-1");
  });

  it("deletes backupCode and playerId for public role", () => {
    const data = makeData();
    sanitizeCharacterForRole(data, "public");
    assert.equal("backupCode" in data, false);
    assert.equal("playerId" in data, false);
    // Other fields preserved
    assert.equal(data.characterName, "Testara");
    assert.equal(data.player, "Test Player");
  });

  it("does not crash when backupCode and playerId are missing", () => {
    const data = { id: "test-id", characterName: "Testara" };
    assert.doesNotThrow(() => sanitizeCharacterForRole(data, "public"));
  });

  it("mutates and returns the same object reference", () => {
    const data = makeData();
    const result = sanitizeCharacterForRole(data, "public");
    assert.equal(result, data);
  });
});
