import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  generateId,
  generateBackupCode,
  validateCharacter,
  filterServerControlledFields,
} from "../src/lib/utils.mts";

// ── generateId ────────────────────────────────────────────────────

describe("generateId", () => {
  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("returns a string", () => {
    assert.equal(typeof generateId(), "string");
  });

  it("matches UUID v4 format", () => {
    assert.match(generateId(), UUID_V4);
  });
});

// ── generateBackupCode ────────────────────────────────────────────

describe("generateBackupCode", () => {
  const ADJECTIVES = ["Iris", "Crystal", "Shadow", "Iron", "Golden", "Silent"];
  const NOUNS = ["Wolf", "Dragon", "Phoenix", "Tiger", "Hawk", "Serpent"];

  it("matches Word-Word-NNN pattern", () => {
    assert.match(generateBackupCode(), /^[A-Z][a-z]+-[A-Z][a-z]+-\d{3}$/);
  });

  it("uses a number between 100 and 999", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateBackupCode();
      const num = Number(code.split("-")[2]);
      assert.ok(num >= 100 && num <= 999, `${num} out of range in "${code}"`);
    }
  });

  it("uses adjectives and nouns from the known lists", () => {
    for (let i = 0; i < 50; i++) {
      const parts = generateBackupCode().split("-");
      assert.ok(
        ADJECTIVES.includes(parts[0]!),
        `"${parts[0]}" not in adjective list`,
      );
      assert.ok(NOUNS.includes(parts[1]!), `"${parts[1]}" not in noun list`);
    }
  });
});

// ── validateCharacter ─────────────────────────────────────────────

describe("validateCharacter", () => {
  it("throws when characterName is missing", () => {
    assert.throws(
      () => validateCharacter({}),
      /at least 2 characters/,
    );
  });

  it("throws when characterName is 1 character", () => {
    assert.throws(
      () => validateCharacter({ characterName: "A" }),
      /at least 2 characters/,
    );
  });

  it("returns true for a valid 2-character name", () => {
    assert.equal(validateCharacter({ characterName: "Ab" }), true);
  });

  it("throws when characterName is falsy (0)", () => {
    assert.throws(
      () => validateCharacter({ characterName: 0 }),
      /at least 2 characters/,
    );
  });
});

// ── filterServerControlledFields ──────────────────────────────────

describe("filterServerControlledFields", () => {
  it("strips top-level server-controlled fields", () => {
    const input = {
      id: "abc",
      backupCode: "X-Y-999",
      created: "2025-01-01",
      lastModified: "2025-01-01",
      schemaVersion: 1,
      characterName: "Hero",
    };
    const result = filterServerControlledFields(input);

    assert.equal(result.id, undefined);
    assert.equal(result.backupCode, undefined);
    assert.equal(result.created, undefined);
    assert.equal(result.lastModified, undefined);
    assert.equal(result.schemaVersion, undefined);
  });

  it("strips nested server-controlled fields (portrait.path, portrait.status)", () => {
    const input = {
      characterName: "Hero",
      portrait: { path: "/img/x.png", status: "approved", crop: { x: 0 } },
    };
    const result = filterServerControlledFields(input);
    const portrait = result.portrait as Record<string, unknown>;

    assert.equal(portrait.path, undefined);
    assert.equal(portrait.status, undefined);
    assert.deepStrictEqual(portrait.crop, { x: 0 });
  });

  it("preserves user fields", () => {
    const input = {
      id: "abc",
      characterName: "Hero",
      attributes: { primary: { accurate: 10 } },
    };
    const result = filterServerControlledFields(input);
    assert.equal(result.characterName, "Hero");
    assert.deepStrictEqual(result.attributes, {
      primary: { accurate: 10 },
    });
  });

  it("does not crash when server-controlled fields are absent", () => {
    const input = { characterName: "Hero" };
    const result = filterServerControlledFields(input);
    assert.equal(result.characterName, "Hero");
  });

  it("returns a new top-level object (does not mutate top-level reference)", () => {
    const input = { id: "abc", characterName: "Hero" };
    const result = filterServerControlledFields(input);
    assert.notEqual(result, input);
    assert.equal(input.id, "abc"); // original untouched at top level
  });
});
