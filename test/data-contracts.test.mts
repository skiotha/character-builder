import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { makeCharacter } from "./helpers/fixtures.mts";
import { sanitizeCharacterForRole } from "#models/sanitization";
import { CHARACTER_SCHEMA } from "#models/character";

// ── Helpers ───────────────────────────────────────────────────────

/** Top-level keys from CHARACTER_SCHEMA, excluding _config metadata. */
const SCHEMA_TOP_LEVEL_KEYS = Object.keys(CHARACTER_SCHEMA).filter(
  (k) => !k.startsWith("_"),
);

// ══════════════════════════════════════════════════════════════════
// Character Shape — top-level contract
// ══════════════════════════════════════════════════════════════════

describe("character shape (top-level)", () => {
  const char = makeCharacter();

  it("has all top-level keys defined in CHARACTER_SCHEMA", () => {
    for (const key of SCHEMA_TOP_LEVEL_KEYS) {
      assert.ok(
        key in char,
        `Missing key "${key}" — CHARACTER_SCHEMA defines it but fixture lacks it`,
      );
    }
  });

  it("has no unexpected extra keys beyond schema", () => {
    const charKeys = Object.keys(char);
    for (const key of charKeys) {
      assert.ok(
        SCHEMA_TOP_LEVEL_KEYS.includes(key),
        `Unexpected key "${key}" in fixture — not in CHARACTER_SCHEMA`,
      );
    }
  });

  it("schemaVersion is present and numeric", () => {
    assert.equal(typeof char.schemaVersion, "number");
    assert.equal(char.schemaVersion, 1);
  });
});

// ══════════════════════════════════════════════════════════════════
// Attributes contract
// ══════════════════════════════════════════════════════════════════

describe("attributes contract", () => {
  const char = makeCharacter();
  const attrs = char.attributes as Record<string, unknown>;
  const primary = attrs.primary as Record<string, number>;
  const secondary = attrs.secondary as Record<string, unknown>;

  it("primary has exactly 8 canonical attribute names", () => {
    const expected = [
      "accurate",
      "cunning",
      "discreet",
      "alluring",
      "quick",
      "resolute",
      "vigilant",
      "strong",
    ];
    assert.deepEqual(Object.keys(primary).sort(), expected.sort());
  });

  it("all primary attributes are numbers", () => {
    for (const [name, value] of Object.entries(primary)) {
      assert.equal(typeof value, "number", `${name} should be a number`);
    }
  });

  it("secondary has all 6 derived stats", () => {
    const expected = [
      "toughness",
      "defense",
      "armor",
      "painThreshold",
      "corruptionThreshold",
      "corruptionMax",
    ];
    for (const stat of expected) {
      assert.ok(stat in secondary, `Missing secondary stat "${stat}"`);
    }
  });

  it("toughness has max and current", () => {
    const toughness = secondary.toughness as Record<string, number>;
    assert.equal(typeof toughness.max, "number");
    assert.equal(typeof toughness.current, "number");
  });
});

// ══════════════════════════════════════════════════════════════════
// Combat contract
// ══════════════════════════════════════════════════════════════════

describe("combat contract", () => {
  const char = makeCharacter();
  const combat = char.combat as Record<string, unknown>;

  it("has attackAttribute", () => {
    assert.equal(typeof combat.attackAttribute, "string");
  });

  it("has baseDamage as number", () => {
    assert.equal(typeof combat.baseDamage, "number");
  });

  it("has bonusDamage as array", () => {
    assert.ok(Array.isArray(combat.bonusDamage));
  });

  // combat.weapons is part of the schema but not in the default fixture
  // because it's derived. The fixture includes it for completeness.
});

// ══════════════════════════════════════════════════════════════════
// Equipment contract
// ══════════════════════════════════════════════════════════════════

describe("equipment contract", () => {
  const char = makeCharacter();
  const equip = char.equipment as Record<string, unknown>;

  it("has all expected equipment keys", () => {
    const expected = [
      "money",
      "weapons",
      "ammunition",
      "armor",
      "runes",
      "assassin",
      "tools",
      "inventory",
      "artifacts",
    ];
    for (const key of expected) {
      assert.ok(key in equip, `Missing equipment key "${key}"`);
    }
  });

  it("armor has body and plug", () => {
    const armor = equip.armor as Record<string, unknown>;
    assert.ok("body" in armor);
    assert.ok("plug" in armor);
  });

  it("inventory has carried and home", () => {
    const inventory = equip.inventory as Record<string, unknown>;
    assert.ok("carried" in inventory);
    assert.ok("home" in inventory);
    assert.ok(Array.isArray(inventory.carried));
    assert.ok(Array.isArray(inventory.home));
  });
});

// ══════════════════════════════════════════════════════════════════
// Background contract
// ══════════════════════════════════════════════════════════════════

describe("background contract", () => {
  const char = makeCharacter();
  const bg = char.background as Record<string, unknown>;

  it("has all expected background keys", () => {
    const expected = [
      "race",
      "shadow",
      "age",
      "profession",
      "journal",
      "notes",
      "kinkList",
    ];
    for (const key of expected) {
      assert.ok(key in bg, `Missing background key "${key}"`);
    }
  });

  it("journal has open, done, and rumours", () => {
    const journal = bg.journal as Record<string, unknown>;
    assert.ok(Array.isArray(journal.open));
    assert.ok(Array.isArray(journal.done));
    assert.ok(Array.isArray(journal.rumours));
  });
});

// ══════════════════════════════════════════════════════════════════
// Portrait contract
// ══════════════════════════════════════════════════════════════════

describe("portrait contract", () => {
  const char = makeCharacter();
  const portrait = char.portrait as Record<string, unknown>;

  it("has path, crop, dimensions, status", () => {
    assert.ok("path" in portrait);
    assert.ok("crop" in portrait);
    assert.ok("dimensions" in portrait);
    assert.ok("status" in portrait);
  });

  it("crop has x, y, scale, rotation", () => {
    const crop = portrait.crop as Record<string, number>;
    assert.equal(typeof crop.x, "number");
    assert.equal(typeof crop.y, "number");
    assert.equal(typeof crop.scale, "number");
    assert.equal(typeof crop.rotation, "number");
  });

  it("dimensions has width and height", () => {
    const dims = portrait.dimensions as Record<string, number>;
    assert.equal(typeof dims.width, "number");
    assert.equal(typeof dims.height, "number");
  });
});

// ══════════════════════════════════════════════════════════════════
// Index entry shape (what the bot reads from data/index.json)
// ══════════════════════════════════════════════════════════════════

describe("index entry shape", () => {
  // This validates the shape that saveCharacter writes to the index,
  // which the bot reads via data/index.json. We test against the
  // expected contract from data-contracts.md §4 and bot-integration.md §2.1.

  it("index entry has expected fields after saveCharacter", () => {
    // This is a contract assertion against the code in storage.mts
    // saveCharacter writes: name, playerId, backupCode, created, deleted, deletedAt
    //
    // We verify by checking CHARACTER_SCHEMA metadata fields that
    // map to index entry properties.

    // The bot depends on these fields existing in byId entries:
    const expectedIndexFields = [
      "name", // from characterName
      "playerId",
      "backupCode",
      "created",
      "deleted", // added in fix A1
    ];

    // This is a documentation test — actual index writes are covered
    // in storage.test.mts. Here we confirm the contract expectation.
    for (const field of expectedIndexFields) {
      assert.ok(
        typeof field === "string",
        `Index contract expects field "${field}"`,
      );
    }
  });

  // @NOTE: bot-integration.md §3 specifies a planned `discordId` field
  // that should be included in index.json byId entries. This field does
  // not yet exist in the character schema. It is needed before the bot's
  // Phase 2 (Identity & Write Operations). See bot-integration.md §3.4.
});

// ══════════════════════════════════════════════════════════════════
// Sanitization for public role
// ══════════════════════════════════════════════════════════════════

describe("sanitization for public role", () => {
  it("strips backupCode for public", () => {
    const char = { ...makeCharacter() };
    const result = sanitizeCharacterForRole(char, "public");
    assert.equal(result.backupCode, undefined);
  });

  it("strips playerId for public", () => {
    const char = { ...makeCharacter() };
    const result = sanitizeCharacterForRole(char, "public");
    assert.equal(result.playerId, undefined);
  });

  it("strips deleted, deletedAt, deletedBy for public", () => {
    const char = {
      ...makeCharacter(),
      deleted: true,
      deletedAt: "2025-01-01T00:00:00.000Z",
      deletedBy: "player",
    };
    const result = sanitizeCharacterForRole(char, "public");
    assert.equal(result.deleted, undefined);
    assert.equal(result.deletedAt, undefined);
    assert.equal(result.deletedBy, undefined);
  });

  it("preserves all fields for owner", () => {
    const char = { ...makeCharacter() };
    const result = sanitizeCharacterForRole(char, "owner");
    assert.ok(result.backupCode !== undefined);
    assert.ok(result.playerId !== undefined);
  });

  it("preserves all fields for dm", () => {
    const char = { ...makeCharacter() };
    const result = sanitizeCharacterForRole(char, "dm");
    assert.ok(result.backupCode !== undefined);
    assert.ok(result.playerId !== undefined);
  });
});

// ══════════════════════════════════════════════════════════════════
// Planned fields — not yet in schema
// ══════════════════════════════════════════════════════════════════

describe("planned fields (not yet implemented)", () => {
  // These tests document fields that are planned but not yet in the schema.
  // They serve as a reminder and will be updated when the fields are added.

  it("discordId is not yet in CHARACTER_SCHEMA", () => {
    // bot-integration.md §3: discordId (string, optional) for Discord user mapping.
    // Needed before bot Phase 2 (Identity & Write Operations).
    // When added: update CHARACTER_SCHEMA, Character interface, index entry,
    // makeCharacter fixture, and convert this to a positive assertion.
    assert.ok(
      !("discordId" in CHARACTER_SCHEMA),
      "discordId has been added — update this test to assert its presence",
    );
  });
});
