/**
 * Hand-coded character fixtures for testing.
 *
 * Shapes are intentionally hard-coded (not generated from CHARACTER_SCHEMA)
 * so tests break explicitly when the schema changes, rather than silently
 * adapting via generateDefaultCharacter().
 */

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
    background: { age: 30, race: "Human" },
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
    combat: { attackAttribute: "accurate", baseDamage: 0, bonusDamage: [] },
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

export { makeCharacter, makePrimaryAttributes };
