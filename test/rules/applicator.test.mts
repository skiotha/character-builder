import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyEffect,
  applyEquipmentBonuses,
} from "../../src/rules/applicator.mts";

// NOTE: The current applicator uses pre-canonical modifier verbs:
//   add / mul / set / advantage
// Phase 6 will rename these to:
//   setBase / addFlat / multiply / cap
// These tests document current (pre-ADR-010) behavior as a regression baseline.

// ── applyEffect ──────────────────────────────────────────────────

describe("applyEffect", () => {
  // ── add ──────────────────────────────────────────────────────

  describe("add modifier", () => {
    it("adds value to existing number", () => {
      const char: Record<string, unknown> = { stats: { hp: 10 } };
      applyEffect(char, "stats.hp", { type: "add", value: 5 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 15);
    });

    it("treats missing target as 0", () => {
      const char: Record<string, unknown> = {};
      applyEffect(char, "stats.hp", { type: "add", value: 7 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 7);
    });
  });

  // ── mul ──────────────────────────────────────────────────────

  describe("mul modifier", () => {
    it("multiplies existing value", () => {
      const char: Record<string, unknown> = { stats: { hp: 10 } };
      applyEffect(char, "stats.hp", { type: "mul", value: 2 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 20);
    });

    it("missing target → 0 × value = 0", () => {
      const char: Record<string, unknown> = {};
      applyEffect(char, "stats.hp", { type: "mul", value: 3 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 0);
    });
  });

  // ── set ──────────────────────────────────────────────────────

  describe("set modifier", () => {
    it("replaces current value regardless", () => {
      const char: Record<string, unknown> = { stats: { hp: 10 } };
      applyEffect(char, "stats.hp", { type: "set", value: 99 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 99);
    });

    it("sets value on missing target", () => {
      const char: Record<string, unknown> = {};
      applyEffect(char, "stats.hp", { type: "set", value: 42 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 42);
    });
  });

  // ── advantage ────────────────────────────────────────────────

  describe("advantage modifier", () => {
    it("sets path.advantage = true", () => {
      const char: Record<string, unknown> = {};
      applyEffect(char, "checks.attack", { type: "advantage", value: true });
      const checks = char.checks as Record<string, unknown>;
      const attack = checks.attack as Record<string, unknown>;
      assert.equal(attack.advantage, true);
    });
  });

  // ── unknown modifier ────────────────────────────────────────

  describe("unknown modifier type", () => {
    it("preserves current value (no-op)", () => {
      const char: Record<string, unknown> = { stats: { hp: 10 } };
      applyEffect(char, "stats.hp", { type: "unknown_modifier", value: 5 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 10);
    });

    it("writes 0 when target is missing (currentValue defaults to 0)", () => {
      const char: Record<string, unknown> = {};
      applyEffect(char, "stats.hp", { type: "bogus", value: 5 });
      assert.equal((char.stats as Record<string, unknown>).hp as number, 0);
    });
  });

  // ── deep paths ───────────────────────────────────────────────

  describe("deep paths", () => {
    it("handles deeply nested target path", () => {
      const char: Record<string, unknown> = {
        a: { b: { c: { d: 1 } } },
      };
      applyEffect(char, "a.b.c.d", { type: "add", value: 9 });
      const a = char.a as Record<string, unknown>;
      const b = a.b as Record<string, unknown>;
      const c = b.c as Record<string, unknown>;
      assert.equal(c.d, 10);
    });

    it("creates intermediate objects for missing path segments", () => {
      const char: Record<string, unknown> = {};
      applyEffect(char, "x.y.z", { type: "set", value: 7 });
      const x = char.x as Record<string, unknown>;
      const y = x.y as Record<string, unknown>;
      assert.equal(y.z, 7);
    });
  });
});

// ── applyEquipmentBonuses ────────────────────────────────────────

describe("applyEquipmentBonuses", () => {
  it("applies weapon effects to character", () => {
    const char: Record<string, unknown> = {
      equipment: {
        weapons: [
          {
            name: "Enchanted Sword",
            effects: [
              { target: "stats.damage", modifier: { type: "add", value: 3 } },
            ],
          },
        ],
      },
    };
    applyEquipmentBonuses(char);
    assert.equal((char.stats as Record<string, unknown>).damage as number, 3);
  });

  it("no crash when weapon has no effects", () => {
    const char: Record<string, unknown> = {
      equipment: { weapons: [{ name: "Plain Sword" }] },
    };
    assert.doesNotThrow(() => applyEquipmentBonuses(char));
  });

  it("no-op when weapons array is empty", () => {
    const char: Record<string, unknown> = {
      equipment: { weapons: [] },
    };
    assert.doesNotThrow(() => applyEquipmentBonuses(char));
  });

  it("no crash when equipment key is missing", () => {
    const char: Record<string, unknown> = {};
    assert.doesNotThrow(() => applyEquipmentBonuses(char));
  });

  it("applies multiple effects from multiple weapons in order", () => {
    const char: Record<string, unknown> = {
      stats: { damage: 0 },
      equipment: {
        weapons: [
          {
            name: "Sword",
            effects: [
              { target: "stats.damage", modifier: { type: "add", value: 2 } },
              { target: "stats.armor", modifier: { type: "set", value: 1 } },
            ],
          },
          {
            name: "Dagger",
            effects: [
              { target: "stats.damage", modifier: { type: "add", value: 3 } },
            ],
          },
        ],
      },
    };
    applyEquipmentBonuses(char);
    assert.equal((char.stats as Record<string, unknown>).damage as number, 5);
    assert.equal((char.stats as Record<string, unknown>).armor as number, 1);
  });
});
