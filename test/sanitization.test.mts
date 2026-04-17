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
    const result = sanitizeCharacterForRole(data, "dm");
    assert.equal(result.backupCode, "Iron-Wolf-123");
    assert.equal(result.playerId, "player-1");
  });

  it("preserves backupCode and playerId for owner role", () => {
    const data = makeData();
    const result = sanitizeCharacterForRole(data, "owner");
    assert.equal(result.backupCode, "Iron-Wolf-123");
    assert.equal(result.playerId, "player-1");
  });

  it("deletes backupCode and playerId for public role", () => {
    const data = makeData();
    const result = sanitizeCharacterForRole(data, "public");
    assert.equal("backupCode" in result, false);
    assert.equal("playerId" in result, false);
    // Other fields preserved
    assert.equal(result.characterName, "Testara");
    assert.equal(result.player, "Test Player");
  });

  it("does not crash when backupCode and playerId are missing", () => {
    const data = { id: "test-id", characterName: "Testara" };
    assert.doesNotThrow(() => sanitizeCharacterForRole(data, "public"));
  });

  it("does not mutate the input object", () => {
    const data = makeData();
    const result = sanitizeCharacterForRole(data, "public");
    // Input is untouched
    assert.equal(data.backupCode, "Iron-Wolf-123");
    assert.equal(data.playerId, "player-1");
    // Result is a distinct object
    assert.notEqual(result, data);
  });
});
