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
    appealing: 10,
    quick: 10,
    resolute: 10,
    vigilant: 10,
    strong: 10,
    ...overrides,
  };
}

/**
 * Schema-conformant fixture in the **input/PATCH-body shape**.
 *
 * Returns the shape a client posts or PATCHes — i.e. what survives
 * `validateCharacterCreation` / sanitiser denylist before recalc runs.
 * Derived collections (`flags`, `specialAttacks`, `reactions`) and the
 * derived per-slot fields on `combat.carried[*]` are deliberately omitted
 * because they are pure recalc output and would be rejected as
 * `UNKNOWN_FIELD` if a client tried to send them.
 *
 * Use this in: validation / sanitization / API / storage round-trip /
 * character-service tests where the fixture stands in for incoming data.
 *
 * Use `makeTypedCharacter` instead when the test needs the post-recalc
 * `Character` shape (rules engine unit tests).
 *
 * Hard-coded so tests break explicitly when the schema changes, rather
 * than silently adapting via `generateDefaultCharacter()`.
 */
function makeCharacter(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: "test-id-0000-0000-000000000000",
    backupCode: "Iron-Wolf-123",
    schemaVersion: 2,
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
          id: "natural_weapon",
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
      carried: [null, null, { weaponIndex: 0 }],
    },
    magicAttribute: "resolute",
    initiativeAttribute: "quick",
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

  return overrides ? simpleMerge(base, overrides) : base;
}

/**
 * Schema-conformant fixture in the **post-recalc, in-memory shape**.
 *
 * Returns a fully-typed `Character` with the derived collections and
 * per-slot inner fields that `recalculateDerivedFields` would normally
 * produce. Use this in rules-engine unit tests that bypass the recalc
 * pipeline and call individual rule functions directly (which expect a
 * complete `Character`).
 *
 * Builds on `makeCharacter` and only enriches the recalc-output bits.
 */
function makeTypedCharacter(overrides?: Record<string, unknown>): Character {
  const stored = makeCharacter(overrides);
  // Layer on derived collections that recalc would normally produce.
  const carried = (stored as { combat: { carried: unknown[] } }).combat.carried;
  const slot2 = carried[2] as { weaponIndex: number };
  const storedAttrs = (
    stored as { attributes: { primary: Record<string, number> } }
  ).attributes;
  const enriched: Record<string, unknown> = {
    ...stored,
    flags: [],
    specialAttacks: [],
    reactions: [],
    magicAttribute: "resolute",
    initiativeAttribute: "quick",
    attributes: {
      ...storedAttrs,
      primaryEffective: { ...storedAttrs.primary },
    },
    combat: {
      carried: [
        carried[0],
        carried[1],
        {
          weaponIndex: slot2.weaponIndex,
          attackAttribute: "accurate",
          baseDamage: 0,
          bonusDamage: 0,
          qualities: ["own"],
          flags: [],
        },
      ],
    },
  };
  return enriched as unknown as Character;
}

export { makeCharacter, makeTypedCharacter, makePrimaryAttributes };
