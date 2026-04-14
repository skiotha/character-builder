import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import { recalculateDerivedFields } from "../../src/rules/derived.mts";

import { makeCharacter, makePrimaryAttributes } from "../helpers/fixtures.mts";

// Tests document current (pre-ADR-010/011) behavior as a regression baseline.
// The rules engine will be rewritten in Phase 6.

// ── recalculateDerivedFields ─────────────────────────────────────

describe("recalculateDerivedFields", () => {
  it("returns a deep clone (input is not mutated)", () => {
    const input = makeCharacter();
    const result = recalculateDerivedFields(input);
    assert.notEqual(result, input);
    assert.deepStrictEqual(input, makeCharacter());
  });

  // ── secondaries from primaries (no effects) ──────────────────

  describe("no effects — secondaries derived from primaries", () => {
    it("computes all secondary attributes from default primaries (all 10)", () => {
      const result = recalculateDerivedFields(makeCharacter());
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;

      // toughness: max(strong=10, 10) = 10
      assert.deepStrictEqual(secondary.toughness, { max: 10, current: 10 });
      // defense: quick = 10
      assert.equal(secondary.defense, 10);
      // armor: equipment.armor.body.defense = 0 (null body)
      assert.equal(secondary.armor, 0);
      // painThreshold: ceil(strong=10 / 2) = 5
      assert.equal(secondary.painThreshold, 5);
      // corruptionThreshold: ceil(resolute=10 / 2) = 5
      assert.equal(secondary.corruptionThreshold, 5);
      // corruptionMax: resolute = 10
      assert.equal(secondary.corruptionMax, 10);
    });

    it("uses custom primary attributes", () => {
      const char = makeCharacter({
        attributes: {
          primary: makePrimaryAttributes({ strong: 15, quick: 13, resolute: 12 }),
        },
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;

      assert.deepStrictEqual(secondary.toughness, { max: 15, current: 10 });
      assert.equal(secondary.defense, 13);
      assert.equal(secondary.painThreshold, 8); // ceil(15/2)
      assert.equal(secondary.corruptionThreshold, 6); // ceil(12/2)
      assert.equal(secondary.corruptionMax, 12);
    });
  });

  // ── effect expiry ────────────────────────────────────────────

  describe("effect expiry", () => {
    it("filters out expired effects (past duration)", () => {
      const char = makeCharacter({
        effects: [
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 5 },
            duration: "2000-01-01T00:00:00.000Z",
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      // defense should be unaffected (effect expired)
      assert.equal(secondary.defense, 10);
    });

    it("applies effect with null duration (permanent)", () => {
      const char = makeCharacter({
        effects: [
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 3 },
            duration: null,
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      assert.equal(secondary.defense, 13);
    });

    it("applies effect with no duration field (treated as permanent)", () => {
      const char = makeCharacter({
        effects: [
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 2 },
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      assert.equal(secondary.defense, 12);
    });

    it("applies effect with future duration", () => {
      const char = makeCharacter({
        effects: [
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 4 },
            duration: "2099-01-01T00:00:00.000Z",
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      assert.equal(secondary.defense, 14);
    });
  });

  // ── rules. prefix setBase overrides ──────────────────────────

  describe("rules. prefix with setBase", () => {
    it("overrides base attribute for a secondary stat", () => {
      // Defense normally uses quick (10). Override to use discreet (14).
      const char = makeCharacter({
        attributes: {
          primary: makePrimaryAttributes({ quick: 10, discreet: 14 }),
        },
        effects: [
          {
            target: "rules.defense",
            modifier: { type: "setBase", value: "discreet" },
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      assert.equal(secondary.defense, 14);
    });

    it("overrides toughness base attribute", () => {
      // Toughness normally uses strong (10). Override to use resolute (15).
      const char = makeCharacter({
        attributes: {
          primary: makePrimaryAttributes({ strong: 10, resolute: 15 }),
        },
        effects: [
          {
            target: "rules.toughness",
            modifier: { type: "setBase", value: "resolute" },
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const toughness = ((result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>).toughness as { max: number };
      assert.equal(toughness.max, 15);
    });
  });

  // ── priority ordering ────────────────────────────────────────

  describe("priority ordering", () => {
    it("processes lower priority number first", () => {
      // Two effects on same target: set to 20 (priority 1), then add 5 (priority 5)
      // Correct order: set 20 → add 5 = 25
      // Wrong order: add 5 (to base 10 = 15) → set 20 = 20
      const char = makeCharacter({
        effects: [
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 5 },
            priority: 5,
          },
          {
            target: "attributes.secondary.defense",
            modifier: { type: "set", value: 20 },
            priority: 1,
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      assert.equal(secondary.defense, 25);
    });

    it("defaults to priority 10 when not specified", () => {
      // Effect with explicit priority 5 runs before one with no priority (default 10)
      const char = makeCharacter({
        effects: [
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 100 },
            // no priority → defaults to 10
          },
          {
            target: "attributes.secondary.defense",
            modifier: { type: "set", value: 0 },
            priority: 5,
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      // set 0 (pri 5) → add 100 (pri 10) = 100
      assert.equal(secondary.defense, 100);
    });
  });

  // ── missing attributes.secondary → early return ──────────────

  describe("missing attributes.secondary", () => {
    it("returns early without crashing", () => {
      const char = makeCharacter({
        attributes: { primary: makePrimaryAttributes() },
      });
      // Remove secondary by replacing attributes with only primary
      (char.attributes as Record<string, unknown>).secondary = undefined;
      const result = recalculateDerivedFields(char);
      assert.ok(result);
    });
  });

  // ── enforceConsistency (tested via recalculateDerivedFields output) ──

  describe("enforceConsistency", () => {
    it("clamps toughness.current to [0, max] after effects", () => {
      // Set strong to 5: toughness.max = max(5, 10) = 10
      // Start with current = 15 → should be clamped to 10
      const char = makeCharacter({
        attributes: {
          primary: makePrimaryAttributes({ strong: 5 }),
          secondary: { toughness: { max: 999, current: 15 } },
        },
      });
      const result = recalculateDerivedFields(char);
      const toughness = ((result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>).toughness as {
        max: number;
        current: number;
      };
      assert.equal(toughness.max, 10);
      assert.equal(toughness.current, 10);
    });

    it("clamps negative toughness.current to 0", () => {
      const char = makeCharacter({
        attributes: {
          primary: makePrimaryAttributes(),
          secondary: { toughness: { max: 10, current: -5 } },
        },
      });
      const result = recalculateDerivedFields(char);
      const toughness = ((result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>).toughness as { current: number };
      assert.equal(toughness.current, 0);
    });

    it("resets negative XP to 0", () => {
      const warnMock = mock.method(console, "warn", () => {});
      try {
        const char = makeCharacter({
          experience: { total: 50, unspent: -10 },
        });
        const result = recalculateDerivedFields(char);
        const exp = result.experience as { unspent: number };
        assert.equal(exp.unspent, 0);
        assert.equal(warnMock.mock.callCount(), 1);
      } finally {
        warnMock.mock.restore();
      }
    });

    it("prunes expired effects from the result", () => {
      const char = makeCharacter({
        effects: [
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 1 },
            duration: "2000-01-01T00:00:00.000Z", // expired
          },
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 2 },
            duration: null, // permanent
          },
        ],
      });
      const result = recalculateDerivedFields(char);
      const effects = result.effects as unknown[];
      // Only the permanent effect remains
      assert.equal(effects.length, 1);
    });

    it("creates default equipment when missing", () => {
      const char = makeCharacter();
      delete (char as Record<string, unknown>).equipment;
      const result = recalculateDerivedFields(char);
      const eq = result.equipment as Record<string, unknown>;
      assert.ok(Array.isArray(eq.weapons));
      assert.deepStrictEqual(eq.armor, { body: null, plug: null });
    });
  });

  // ── deriveCombat (tested via recalculateDerivedFields output) ──

  describe("deriveCombat", () => {
    it("reads baseDamage from primary weapon via combat.weapons slot", () => {
      const char = makeCharacter({
        equipment: {
          weapons: [{ name: "Longsword", damage: 8 }],
          armor: { body: null, plug: null },
        },
        combat: {
          weapons: [0],
          attackAttribute: "accurate",
          baseDamage: 0,
          bonusDamage: [],
        },
      });
      const result = recalculateDerivedFields(char);
      const combat = result.combat as Record<string, unknown>;
      assert.equal(combat.baseDamage, 8);
    });

    it("returns baseDamage = 0 when no primary weapon", () => {
      const char = makeCharacter({
        combat: {
          weapons: [],
          attackAttribute: "accurate",
          baseDamage: 0,
          bonusDamage: [],
        },
      });
      const result = recalculateDerivedFields(char);
      const combat = result.combat as Record<string, unknown>;
      assert.equal(combat.baseDamage, 0);
    });

    it("defaults attackAttribute to 'accurate'", () => {
      const char = makeCharacter();
      // Remove attackAttribute to test default
      const combat = char.combat as Record<string, unknown>;
      delete combat.attackAttribute;
      const result = recalculateDerivedFields(char);
      const resultCombat = result.combat as Record<string, unknown>;
      assert.equal(resultCombat.attackAttribute, "accurate");
    });

    it("preserves existing attackAttribute (bug: prevents effect overrides)", () => {
      // BUG DOCUMENTED: || operator preserves any truthy existing value,
      // preventing the effect pipeline from overriding it.
      // Tracked in engine-weak-points #C6.
      const char = makeCharacter({
        combat: {
          weapons: [],
          attackAttribute: "strong",
          baseDamage: 0,
          bonusDamage: [],
        },
      });
      const result = recalculateDerivedFields(char);
      const combat = result.combat as Record<string, unknown>;
      assert.equal(combat.attackAttribute, "strong");
    });

    it("defaults bonusDamage to empty array", () => {
      const char = makeCharacter();
      const combat = char.combat as Record<string, unknown>;
      delete combat.bonusDamage;
      const result = recalculateDerivedFields(char);
      const resultCombat = result.combat as Record<string, unknown>;
      assert.deepStrictEqual(resultCombat.bonusDamage, []);
    });
  });

  // ── full pipeline round-trip ─────────────────────────────────

  describe("full pipeline round-trip", () => {
    it("primaries → formulas → effects → equipment → clamp → consistency", () => {
      const char = makeCharacter({
        attributes: {
          primary: makePrimaryAttributes({ strong: 15, quick: 12, resolute: 14 }),
          secondary: { toughness: { max: 99, current: 20 } },
        },
        effects: [
          // Override defense to use discreet(10) instead of quick(12)
          {
            target: "rules.defense",
            modifier: { type: "setBase", value: "discreet" },
            priority: 1,
          },
          // Flat bonus to defense after formula
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 2 },
            priority: 5,
          },
          // Expired effect — should be ignored
          {
            target: "attributes.secondary.defense",
            modifier: { type: "add", value: 100 },
            duration: "2000-01-01T00:00:00.000Z",
          },
        ],
        equipment: {
          weapons: [
            {
              name: "Enchanted Blade",
              damage: 8,
              effects: [
                {
                  target: "attributes.secondary.armor",
                  modifier: { type: "add", value: 1 },
                },
              ],
            },
          ],
          armor: { body: { defense: 3 }, plug: null },
        },
        combat: {
          weapons: [0],
          attackAttribute: "accurate",
          baseDamage: 0,
          bonusDamage: [],
        },
      });

      const result = recalculateDerivedFields(char);
      const secondary = (result.attributes as Record<string, unknown>)
        .secondary as Record<string, unknown>;
      const combat = result.combat as Record<string, unknown>;
      const toughness = secondary.toughness as {
        max: number;
        current: number;
      };

      // toughness: max(strong=15, 10) = 15, current clamped from 20 → 15
      assert.equal(toughness.max, 15);
      assert.equal(toughness.current, 15);

      // defense: discreet=10 (overridden by setBase) + 2 (addFlat) = 12
      assert.equal(secondary.defense, 12);

      // armor: body.defense=3 (formula=identity) + 1 (weapon effect) = 4
      assert.equal(secondary.armor, 4);

      // painThreshold: ceil(strong=15 / 2) = 8
      assert.equal(secondary.painThreshold, 8);

      // corruptionThreshold: ceil(resolute=14 / 2) = 7
      assert.equal(secondary.corruptionThreshold, 7);

      // corruptionMax: resolute=14
      assert.equal(secondary.corruptionMax, 14);

      // combat: baseDamage from weapon[0]
      assert.equal(combat.baseDamage, 8);

      // Expired effect pruned from output
      const effects = result.effects as unknown[];
      assert.equal(effects.length, 2);
    });
  });
});
