/**
 * Hand-coded character fixtures for testing.
 *
 * ADR-013 carve-out: tests may bypass the domain layer (`#models`) and write
 * fixtures directly via `#models/storage` to set up arbitrary states without
 * triggering recalc/broadcast side effects.
 *
 * Shapes are intentionally hard-coded (not generated from CHARACTER_SCHEMA)
 * so tests break explicitly when the schema changes, rather than silently
 * adapting via generateDefaultCharacter().
 */

import type { Character } from "../../src/rpg-types.mts";

function simpleMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const existing = output[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      output[key] = simpleMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      output[key] = value;
    }
  }

  return output;
}

function makePrimaryAttributes(
  overrides?: Partial<Record<string, number>>,
): Record<string, number> {
  return {
    accurate: 10,
    cunning: 10,
    discreet: 10,
    alluring: 10,
    quick: 10,
    resolute: 10,
    vigilant: 10,
    strong: 10,
    ...overrides,
  };
}

/**
 * Schema-conformant fixture for storage / API / validation / sanitization
 * tests. Mirrors the on-disk shape declared by `CHARACTER_SCHEMA` (i.e. the
 * pre-Chunk-D legacy combat shape, no `flags` / `specialAttacks` /
 * `reactions`). Engine-facing tests should use `makeTypedCharacter` instead.
 */
function makeCharacter(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: "test-id-0000-0000-000000000000",
    backupCode: "Iron-Wolf-123",
    schemaVersion: 1,
    characterName: "Testara",
    playerId: "player-1",
    player: "Test Player",
    created: "2025-01-01T00:00:00.000Z",
    lastModified: "2025-01-01T00:00:00.000Z",
    attributes: {
      primary: makePrimaryAttributes(),
      secondary: {
        toughness: { max: 10, current: 10 },
        defense: 10,
        armor: 0,
        painThreshold: 5,
        corruptionThreshold: 5,
        corruptionMax: 10,
      },
    },
    experience: { total: 50, unspent: 50 },
    corruption: { permanent: 0, temporary: 0 },
    background: {
      age: 30,
      race: "Human",
      shadow: "",
      profession: "",
      journal: { open: [], done: [], rumours: [] },
      notes: [],
      kinkList: [],
    },
    equipment: {
      money: 5,
      weapons: [],
      ammunition: [],
      armor: { body: null, plug: null },
      runes: [],
      assassin: [],
      tools: [],
      inventory: { carried: [], home: [] },
      artifacts: [],
    },
    combat: {
      weapons: [],
      attackAttribute: "accurate",
      baseDamage: 0,
      bonusDamage: [],
    },
    traits: [],
    rituals: [],
    talents: [],
    traditions: [],
    effects: [],
    affiliations: [],
    location: "",
    portrait: {
      path: "",
      crop: { x: 0, y: 0, scale: 1, rotation: 0 },
      dimensions: { width: 0, height: 0 },
      status: "none",
    },
  };

  if (!overrides) return base;
  return simpleMerge(base, overrides);
}

/**
 * Engine-facing fixture: returns the typed `Character` shape introduced in
 * Phase 6 Chunk C — new `combat.carried` tuple with synthetic
 * `natural_weapon` slot 2, plus `flags` / `specialAttacks` / `reactions`
 * arrays. Use this for rules / applicator / derived tests. Schema-validated
 * tests should use `makeCharacter` instead until Chunk D updates the schema.
 */
function makeTypedCharacter(overrides?: Record<string, unknown>): Character {
  const base: Record<string, unknown> = {
    id: "test-id-0000-0000-000000000000",
    backupCode: "Iron-Wolf-123",
    schemaVersion: 1,
    characterName: "Testara",
    playerId: "player-1",
    player: "Test Player",
    created: "2025-01-01T00:00:00.000Z",
    lastModified: "2025-01-01T00:00:00.000Z",
    attributes: {
      primary: makePrimaryAttributes(),
      secondary: {
        toughness: { max: 10, current: 10 },
        defense: 10,
        armor: 0,
        painThreshold: 5,
        corruptionThreshold: 5,
        corruptionMax: 10,
      },
    },
    experience: { total: 50, unspent: 50 },
    corruption: { permanent: 0, temporary: 0 },
    background: {
      age: 30,
      race: "Human",
      shadow: "",
      profession: "",
      journal: { open: [], done: [], rumours: [] },
      notes: [],
      kinkList: [],
    },
    equipment: {
      money: 5,
      weapons: [
        // Slot 2 anchor: synthetic natural_weapon (own quality, ADR-014).
        {
          name: "natural_weapon",
          type: "natural",
          damage: 0,
          qualities: ["own"],
        },
      ],
      ammunition: [],
      armor: { body: null, plug: null },
      runes: [],
      assassin: [],
      tools: [],
      inventory: { carried: [], home: [] },
      artifacts: [],
    },
    combat: {
      carried: [
        null,
        null,
        {
          weaponIndex: 0,
          attackAttribute: "accurate",
          baseDamage: 0,
          bonusDamage: 0,
          qualities: ["own"],
          flags: [],
        },
      ],
    },
    traits: [],
    rituals: [],
    talents: [],
    traditions: [],
    effects: [],
    affiliations: [],
    flags: [],
    specialAttacks: [],
    reactions: [],
    location: "",
    portrait: {
      path: "",
      crop: { x: 0, y: 0, scale: 1, rotation: 0 },
      dimensions: { width: 0, height: 0 },
      status: "none",
    },
  };

  const merged = overrides ? simpleMerge(base, overrides) : base;
  return merged as unknown as Character;
}

export { makeCharacter, makeTypedCharacter, makePrimaryAttributes };
