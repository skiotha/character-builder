import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import { recalculate } from "../../src/rules/derived.mts";

import { createInMemoryRegistry, emptyRegistry } from "../helpers/registry.mts";
import {
  makePrimaryAttributes,
  makeTypedCharacter,
} from "../helpers/fixtures.mts";

// Dropped when the typed pipeline replaced the legacy
// `recalculateDerivedFields` suite (see git history):
//   * "effect expiry" — engine has no lifecycle; `duration` is dropped.
//   * "rules. prefix" — typed `EffectTarget` replaces dotted-path strings.
//   * "priority ordering" — phase ordering replaces `priority`.
//   * "prunes expired effects" — engine never mutates `character.effects`.
//
// Combat tests here are stubbed-shape only; full per-slot fanout is
// covered in `combat.test.mts`.

// ── recalculate ─────────────────────────────────────────────────

describe("recalculate", () => {
  it("returns a deep clone (input is not mutated)", () => {
    const input = makeTypedCharacter();
    const before = JSON.stringify(input);
    const result = recalculate(input, emptyRegistry);
    assert.notEqual(result, input);
    assert.equal(JSON.stringify(input), before);
  });

  // ── secondaries from primaries (no effects) ──────────────────

  describe("no effects — secondaries derived from primaries", () => {
    it("computes all secondary attributes from default primaries (all 10)", () => {
      const result = recalculate(makeTypedCharacter(), emptyRegistry);
      const s = result.attributes.secondary;
      assert.deepStrictEqual(s.toughness, { max: 10, current: 10 });
      assert.equal(s.defense, 10);
      assert.equal(s.armor, 0);
      assert.equal(s.painThreshold, 5);
      assert.equal(s.corruptionThreshold, 5);
      assert.equal(s.corruptionMax, 10);
    });

    it("uses custom primary attributes", () => {
      const char = makeTypedCharacter({
        attributes: {
          primary: makePrimaryAttributes({
            strong: 15,
            quick: 13,
            resolute: 12,
          }),
        },
      });
      const result = recalculate(char, emptyRegistry);
      const s = result.attributes.secondary;
      assert.deepStrictEqual(s.toughness, { max: 15, current: 10 });
      assert.equal(s.defense, 13);
      assert.equal(s.painThreshold, 8); // ceil(15/2)
      assert.equal(s.corruptionThreshold, 6); // ceil(12/2)
      assert.equal(s.corruptionMax, 12);
    });
  });

  // ── typed setBase override ───────────────────────────────────

  describe("setBase override (typed)", () => {
    it("overrides the primary feeding a secondary formula", () => {
      const char = makeTypedCharacter({
        attributes: {
          primary: makePrimaryAttributes({ quick: 10, discreet: 14 }),
        },
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "setBase", value: "discreet" },
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.attributes.secondary.defense, 14);
    });

    it("overrides toughness base attribute", () => {
      const char = makeTypedCharacter({
        attributes: {
          primary: makePrimaryAttributes({ strong: 10, resolute: 15 }),
        },
        effects: [
          {
            target: { kind: "secondary", stat: "toughness" },
            modifier: { type: "setBase", value: "resolute" },
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.attributes.secondary.toughness.max, 15);
    });
  });

  // ── phase ordering: setBase → formula → addFlat → multiply → cap ──

  describe("phase ordering", () => {
    it("addFlat runs after the formula", () => {
      const char = makeTypedCharacter({
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 5 },
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.attributes.secondary.defense, 15);
    });

    it("multiply runs after addFlat", () => {
      // base = quick(10), addFlat 5 = 15, *2 = 30
      const char = makeTypedCharacter({
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 5 },
          },
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "multiply", value: 2 },
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.attributes.secondary.defense, 30);
    });

    it("cap runs last among numeric phases", () => {
      const char = makeTypedCharacter({
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 50 },
          },
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "cap", value: 25 },
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.attributes.secondary.defense, 25);
    });
  });

  // ── flag phase ───────────────────────────────────────────────

  describe("flag phase", () => {
    it("adds flags from typed effects", () => {
      const char = makeTypedCharacter({
        effects: [
          {
            target: { kind: "flag", name: "darkvision" },
            modifier: { type: "addFlat", value: 1 },
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      assert.deepEqual(result.flags, ["darkvision"]);
    });
  });

  // ── registry integration ─────────────────────────────────────

  describe("registry integration", () => {
    it("applies trait effects from the registry", () => {
      const registry = createInMemoryRegistry({
        traits: {
          "stoneskin:novice": {
            effects: [
              {
                source: "stoneskin",
                target: { kind: "secondary", stat: "armor" },
                modifier: { type: "addFlat", value: 2 },
              },
            ],
          },
        },
      });
      const char = makeTypedCharacter({
        traits: [{ id: "stoneskin", tier: "novice", source: "ability" }],
      });
      const result = recalculate(char, registry);
      assert.equal(result.attributes.secondary.armor, 2);
    });

    it("warns and skips unknown trait", () => {
      const warnMock = mock.method(console, "warn", () => {});
      try {
        const char = makeTypedCharacter({
          traits: [{ id: "no-such", tier: "novice", source: "ability" }],
        });
        const result = recalculate(char, emptyRegistry);
        assert.equal(result.attributes.secondary.armor, 0);
        assert.ok(warnMock.mock.callCount() >= 1);
      } finally {
        warnMock.mock.restore();
      }
    });
  });

  // ── lifecycle removal ────────────────────────────────────────

  describe("lifecycle removal", () => {
    it("ignores `duration` field on RawEffect (engine has no lifecycle)", () => {
      const char = makeTypedCharacter({
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 5 },
            duration: "2000-01-01T00:00:00.000Z",
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      // The expired effect is still applied — sibling apps own lifecycle.
      assert.equal(result.attributes.secondary.defense, 15);
    });

    it("does not prune effects from the result", () => {
      const char = makeTypedCharacter({
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 1 },
            duration: "2000-01-01T00:00:00.000Z",
          },
        ],
      });
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.effects.length, 1);
    });

    it("ignores `priority` (phase ordering replaces it)", () => {
      const char = makeTypedCharacter({
        effects: [
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 5 },
            priority: 999,
          },
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "multiply", value: 2 },
            priority: 1,
          },
        ],
      });
      // multiply still runs after addFlat regardless of priority numbers.
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.attributes.secondary.defense, 30);
    });
  });

  // ── legacy vocabulary rejection ──────────────────────────────

  describe("legacy vocabulary rejection", () => {
    it("warns and drops legacy `add`/`mul`/`set` modifier verbs", () => {
      const warnMock = mock.method(console, "warn", () => {});
      try {
        const char = makeTypedCharacter({
          effects: [
            {
              target: { kind: "secondary", stat: "defense" },
              modifier: { type: "add", value: 5 },
            },
          ],
        });
        const result = recalculate(char, emptyRegistry);
        assert.equal(result.attributes.secondary.defense, 10);
        assert.ok(warnMock.mock.callCount() >= 1);
      } finally {
        warnMock.mock.restore();
      }
    });

    it("warns and drops dotted-path string targets", () => {
      const warnMock = mock.method(console, "warn", () => {});
      try {
        const char = makeTypedCharacter({
          effects: [
            {
              target: "attributes.secondary.defense",
              modifier: { type: "addFlat", value: 5 },
            },
          ],
        });
        const result = recalculate(char, emptyRegistry);
        assert.equal(result.attributes.secondary.defense, 10);
        assert.ok(warnMock.mock.callCount() >= 1);
      } finally {
        warnMock.mock.restore();
      }
    });
  });

  // ── boundary vs engine responsibilities ─────────────────────

  describe("input passthrough (boundary owns validation)", () => {
    it("does not clamp out-of-range experience (NB-36)", () => {
      const char = makeTypedCharacter({
        experience: { total: 50, unspent: -10 },
      });
      const result = recalculate(char, emptyRegistry);
      // Recalc is a pure derivation: XP validity is enforced at the
      // schema boundary (`min: 0`), never silently "fixed" mid-recalc.
      assert.equal(result.experience.unspent, -10);
    });
  });

  // ── clamp phase ──────────────────────────────────────────────

  describe("clamp phase", () => {
    it("clamps toughness.current to max via clampValues", () => {
      const char = makeTypedCharacter({
        attributes: {
          primary: makePrimaryAttributes({ strong: 5 }),
          secondary: { toughness: { max: 999, current: 15 } },
        },
      });
      const result = recalculate(char, emptyRegistry);
      assert.equal(result.attributes.secondary.toughness.max, 10);
      assert.equal(result.attributes.secondary.toughness.current, 10);
    });
  });

  // ── deriveCombat (stubbed shape) ─────────────────────────────

  describe("deriveCombat (stubbed shape)", () => {
    it("produces a 3-slot carried tuple", () => {
      const result = recalculate(makeTypedCharacter(), emptyRegistry);
      assert.ok(Array.isArray(result.combat.carried));
      assert.equal(result.combat.carried.length, 3);
    });

    it("synthesizes a natural_weapon when no `own` weapon present", () => {
      const char = makeTypedCharacter({
        equipment: {
          money: 0,
          weapons: [],
          ammunition: [],
          armor: { body: null, plug: null },
          runes: [],
          assassin: [],
          tools: [],
          inventory: { carried: [], home: [] },
          artifacts: [],
        },
      });
      const result = recalculate(char, emptyRegistry);
      const ownSlot = result.combat.carried[2];
      assert.ok(ownSlot.qualities.includes("own"));
      const ownWeapon = result.equipment.weapons[ownSlot.weaponIndex];
      assert.ok(ownWeapon);
      assert.ok(ownWeapon.qualities?.includes("own"));
    });

    it("uses an existing `own` weapon when present", () => {
      const char = makeTypedCharacter({
        equipment: {
          weapons: [{ name: "Claws", qualities: ["own"], damage: 3 }],
          armor: { body: null, plug: null },
        },
      });
      const result = recalculate(char, emptyRegistry);
      const ownSlot = result.combat.carried[2];
      assert.equal(ownSlot.weaponIndex, 0);
      assert.equal(ownSlot.baseDamage, 3);
    });

    it("seeds empty specialAttacks and reactions arrays", () => {
      const result = recalculate(makeTypedCharacter(), emptyRegistry);
      assert.deepEqual(result.specialAttacks, []);
      assert.deepEqual(result.reactions, []);
    });
  });

  // ── full pipeline round-trip ─────────────────────────────────

  describe("full pipeline round-trip", () => {
    it("primaries → setBase → formula → addFlat → multiply → cap → flag → clamp", () => {
      const char = makeTypedCharacter({
        attributes: {
          primary: makePrimaryAttributes({
            strong: 15,
            quick: 10,
            discreet: 12,
            resolute: 14,
          }),
          secondary: { toughness: { max: 99, current: 20 } },
        },
        effects: [
          // setBase: defense uses discreet (12) instead of quick (10).
          // resolveSetBase picks max-by-primary with the default
          // included, so discreet must outscore quick to win.
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "setBase", value: "discreet" },
          },
          // addFlat after formula → 12 + 2 = 14
          {
            target: { kind: "secondary", stat: "defense" },
            modifier: { type: "addFlat", value: 2 },
          },
          // flag
          {
            target: { kind: "flag", name: "darkvision" },
            modifier: { type: "addFlat", value: 1 },
          },
        ],
        equipment: {
          weapons: [{ name: "Claws", qualities: ["own"], damage: 3 }],
          armor: { body: { armor: 3 }, plug: null },
        },
      });

      const result = recalculate(char, emptyRegistry);
      const s = result.attributes.secondary;

      // toughness: max(strong=15, 10) = 15, current clamped from 20 → 15
      assert.equal(s.toughness.max, 15);
      assert.equal(s.toughness.current, 15);
      // defense: discreet=12 + 2 = 14
      assert.equal(s.defense, 14);
      // armor: body.armor=3
      assert.equal(s.armor, 3);
      // painThreshold: ceil(15/2) = 8
      assert.equal(s.painThreshold, 8);
      // corruptionThreshold: ceil(14/2) = 7
      assert.equal(s.corruptionThreshold, 7);
      // corruptionMax: 14
      assert.equal(s.corruptionMax, 14);
      // flag set
      assert.deepEqual(result.flags, ["darkvision"]);
      // combat shape preserved
      assert.equal(result.combat.carried.length, 3);
    });
  });
});
