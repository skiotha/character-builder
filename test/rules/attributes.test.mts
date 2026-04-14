import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SECONDARY_FORMULAS,
  clampValues,
} from "../../src/rules/attributes.mts";

import { makeCharacter, makePrimaryAttributes } from "../helpers/fixtures.mts";

// ── SECONDARY_FORMULAS ───────────────────────────────────────────

describe("SECONDARY_FORMULAS", () => {
  // ── toughness ────────────────────────────────────────────────

  describe("toughness", () => {
    const rule = SECONDARY_FORMULAS["toughness"]!;

    describe("formula", () => {
      it("returns 10 when base is below 10 (floor)", () => {
        assert.equal(rule.formula(5), 10);
      });

      it("returns 10 at boundary", () => {
        assert.equal(rule.formula(10), 10);
      });

      it("returns base when above 10", () => {
        assert.equal(rule.formula(15), 15);
      });

      it("returns 10 when base is 0", () => {
        assert.equal(rule.formula(0), 10);
      });
    });

    describe("base", () => {
      it("reads strong by default", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ strong: 13 }) },
        });
        assert.equal(rule.base(char), 13);
      });

      it("reads overridden attribute via statOverride", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ resolute: 14 }) },
        });
        assert.equal(rule.base(char, "resolute"), 14);
      });

      it("returns 0 when attributes.primary is missing", () => {
        assert.equal(rule.base({ attributes: {} }), 0);
      });

      it("returns 0 when attributes is missing entirely", () => {
        assert.equal(rule.base({}), 0);
      });
    });
  });

  // ── painThreshold ────────────────────────────────────────────

  describe("painThreshold", () => {
    const rule = SECONDARY_FORMULAS["painThreshold"]!;

    describe("formula", () => {
      it("ceil(7/2) = 4", () => {
        assert.equal(rule.formula(7), 4);
      });

      it("ceil(1/2) = 1", () => {
        assert.equal(rule.formula(1), 1);
      });

      it("returns 0 when base is 0", () => {
        assert.equal(rule.formula(0), 0);
      });

      it("ceil(10/2) = 5", () => {
        assert.equal(rule.formula(10), 5);
      });
    });

    describe("base", () => {
      it("reads strong by default", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ strong: 8 }) },
        });
        assert.equal(rule.base(char), 8);
      });

      it("reads overridden attribute", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ cunning: 12 }) },
        });
        assert.equal(rule.base(char, "cunning"), 12);
      });
    });
  });

  // ── corruptionThreshold ──────────────────────────────────────

  describe("corruptionThreshold", () => {
    const rule = SECONDARY_FORMULAS["corruptionThreshold"]!;

    describe("formula", () => {
      it("ceil(7/2) = 4", () => {
        assert.equal(rule.formula(7), 4);
      });

      it("ceil(1/2) = 1", () => {
        assert.equal(rule.formula(1), 1);
      });

      it("returns 0 when base is 0", () => {
        assert.equal(rule.formula(0), 0);
      });

      it("ceil(10/2) = 5", () => {
        assert.equal(rule.formula(10), 5);
      });
    });

    describe("base", () => {
      it("reads resolute by default", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ resolute: 11 }) },
        });
        assert.equal(rule.base(char), 11);
      });

      it("reads overridden attribute", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ strong: 9 }) },
        });
        assert.equal(rule.base(char, "strong"), 9);
      });
    });
  });

  // ── defense ──────────────────────────────────────────────────

  describe("defense", () => {
    const rule = SECONDARY_FORMULAS["defense"]!;

    describe("formula", () => {
      it("identity: returns base unchanged", () => {
        assert.equal(rule.formula(10), 10);
        assert.equal(rule.formula(0), 0);
        assert.equal(rule.formula(15), 15);
      });
    });

    describe("base", () => {
      it("reads quick by default", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ quick: 12 }) },
        });
        assert.equal(rule.base(char), 12);
      });

      it("reads overridden attribute", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ discreet: 14 }) },
        });
        assert.equal(rule.base(char, "discreet"), 14);
      });
    });
  });

  // ── armor ────────────────────────────────────────────────────

  describe("armor", () => {
    const rule = SECONDARY_FORMULAS["armor"]!;

    describe("formula", () => {
      it("identity: returns base unchanged", () => {
        assert.equal(rule.formula(4), 4);
        assert.equal(rule.formula(0), 0);
      });
    });

    describe("base", () => {
      it("reads equipment.armor.body.defense", () => {
        const char = makeCharacter({
          equipment: { armor: { body: { defense: 3 }, plug: null } },
        });
        assert.equal(rule.base(char), 3);
      });

      it("returns 0 when armor body is null", () => {
        const char = makeCharacter({
          equipment: { armor: { body: null, plug: null } },
        });
        assert.equal(rule.base(char), 0);
      });

      it("returns 0 when equipment is missing", () => {
        assert.equal(rule.base({}), 0);
      });

      it("ignores statOverride (armor reads equipment, not a primary)", () => {
        const char = makeCharacter({
          equipment: { armor: { body: { defense: 5 }, plug: null } },
        });
        assert.equal(rule.base(char, "strong"), 5);
      });
    });
  });

  // ── corruptionMax ────────────────────────────────────────────

  describe("corruptionMax", () => {
    const rule = SECONDARY_FORMULAS["corruptionMax"]!;

    describe("formula", () => {
      it("identity: returns base unchanged", () => {
        assert.equal(rule.formula(10), 10);
        assert.equal(rule.formula(0), 0);
      });
    });

    describe("base", () => {
      it("reads resolute by default", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ resolute: 13 }) },
        });
        assert.equal(rule.base(char), 13);
      });

      it("reads overridden attribute", () => {
        const char = makeCharacter({
          attributes: { primary: makePrimaryAttributes({ cunning: 7 }) },
        });
        assert.equal(rule.base(char, "cunning"), 7);
      });
    });
  });
});

// ── clampValues ──────────────────────────────────────────────────

describe("clampValues", () => {
  it("clamps toughness.current to max when over", () => {
    const char = makeCharacter({
      attributes: {
        primary: makePrimaryAttributes(),
        secondary: { toughness: { max: 10, current: 15 } },
      },
    });
    clampValues(char);
    const t = (
      (char.attributes as Record<string, unknown>).secondary as Record<
        string,
        unknown
      >
    ).toughness as { current: number };
    assert.equal(t.current, 10);
  });

  it("clamps toughness.current to 0 when negative", () => {
    const char = makeCharacter({
      attributes: {
        primary: makePrimaryAttributes(),
        secondary: { toughness: { max: 10, current: -3 } },
      },
    });
    clampValues(char);
    const t = (
      (char.attributes as Record<string, unknown>).secondary as Record<
        string,
        unknown
      >
    ).toughness as { current: number };
    assert.equal(t.current, 0);
  });

  it("leaves toughness.current unchanged when within range", () => {
    const char = makeCharacter({
      attributes: {
        primary: makePrimaryAttributes(),
        secondary: { toughness: { max: 10, current: 7 } },
      },
    });
    clampValues(char);
    const t = (
      (char.attributes as Record<string, unknown>).secondary as Record<
        string,
        unknown
      >
    ).toughness as { current: number };
    assert.equal(t.current, 7);
  });

  it("no crash when toughness object is missing", () => {
    const char = makeCharacter({
      attributes: {
        primary: makePrimaryAttributes(),
        secondary: { defense: 10 },
      },
    });
    assert.doesNotThrow(() => clampValues(char));
  });

  it("no crash when attributes.secondary is missing", () => {
    const char = makeCharacter({
      attributes: { primary: makePrimaryAttributes() },
    });
    assert.doesNotThrow(() => clampValues(char));
  });
});
