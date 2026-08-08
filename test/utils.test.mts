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
  it("matches Word-Word-NNNN pattern (4-digit zero-padded number)", () => {
    for (let i = 0; i < 100; i++) {
      assert.match(generateBackupCode(), /^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
    }
  });

  it("uses a number between 0000 and 9999", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateBackupCode();
      const numStr = code.split("-")[2]!;
      assert.equal(numStr.length, 4, `"${numStr}" not 4 digits in "${code}"`);
      const num = Number(numStr);
      assert.ok(num >= 0 && num <= 9999, `${num} out of range in "${code}"`);
    }
  });

  it("draws from an expanded keyspace (≥15 distinct adjectives and nouns over 1000 samples)", () => {
    const adjectives = new Set<string>();
    const nouns = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const parts = generateBackupCode().split("-");
      adjectives.add(parts[0]!);
      nouns.add(parts[1]!);
    }
    assert.ok(
      adjectives.size >= 15,
      `only ${adjectives.size} distinct adjectives observed`,
    );
    assert.ok(nouns.size >= 15, `only ${nouns.size} distinct nouns observed`);
  });
});

// ── validateCharacter ─────────────────────────────────────────────

describe("validateCharacter", () => {
  it("throws when characterName is missing", () => {
    assert.throws(() => validateCharacter({}), /at least 2 characters/);
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

  it("strips attributes.primaryEffective and derived secondaries (server-controlled engine output)", () => {
    const input = {
      characterName: "Hero",
      attributes: {
        primary: { strong: 10 },
        primaryEffective: { strong: 18 },
        secondary: { defense: 12, toughness: { max: 15, current: 9 } },
      },
    };
    const result = filterServerControlledFields(input);
    const attrs = result.attributes as Record<string, unknown>;
    assert.equal(attrs.primaryEffective, undefined);
    assert.deepStrictEqual(attrs.primary, { strong: 10 });
    // Derived secondaries (defense, toughness.max, …) are recalc output
    // and stripped; toughness.current is real state and survives.
    assert.deepStrictEqual(attrs.secondary, {
      toughness: { current: 9 },
    });
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
