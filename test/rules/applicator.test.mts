import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyAddFlat,
  applyCap,
  applyFlag,
  applyMultiply,
  applySetBase,
} from "../../src/rules/applicator.mts";
import type { Character, ResolvedEffect } from "../../src/rpg-types.mts";
import { makeTypedCharacter } from "../helpers/fixtures.mts";

function asChar(): Character {
  return makeTypedCharacter();
}

// ── applySetBase ─────────────────────────────────────────────────

describe("applySetBase", () => {
  it("returns candidate map keyed by secondary stat", () => {
    const effects: ResolvedEffect[] = [
      {
        source: "test",
        target: { kind: "secondary", stat: "toughness" },
        modifier: { type: "setBase", value: "vigilant" },
      },
    ];
    const candidates = applySetBase(effects);
    assert.deepEqual(candidates.get("toughness"), ["vigilant"]);
  });

  it("ignores non-setBase modifiers", () => {
    const effects: ResolvedEffect[] = [
      {
        source: "test",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "addFlat", value: 5 },
      },
    ];
    const candidates = applySetBase(effects);
    assert.equal(candidates.size, 0);
  });

  it("collects every candidate per stat for resolveSetBase to pick from", () => {
    // G2.A: applySetBase no longer picks a winner. The formula phase
    // calls resolveSetBase against the post-effect primary snapshot to
    // resolve max-by-primary with the default included.
    const effects: ResolvedEffect[] = [
      {
        source: "a",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "setBase", value: "quick" },
      },
      {
        source: "b",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "setBase", value: "vigilant" },
      },
    ];
    const candidates = applySetBase(effects);
    assert.deepEqual(candidates.get("defense"), ["quick", "vigilant"]);
  });
});

// ── applyAddFlat ─────────────────────────────────────────────────

describe("applyAddFlat", () => {
  it("adds to scalar secondary stat", () => {
    const char = asChar();
    char.attributes.secondary.defense = 10;
    applyAddFlat(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "addFlat", value: 3 },
      },
    ]);
    assert.equal(char.attributes.secondary.defense, 13);
  });

  it("adds to toughness.max", () => {
    const char = asChar();
    char.attributes.secondary.toughness.max = 10;
    applyAddFlat(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "toughness" },
        modifier: { type: "addFlat", value: 5 },
      },
    ]);
    assert.equal(char.attributes.secondary.toughness.max, 15);
  });

  it("addFlat on toughness leaves `.current` untouched (Item 11)", () => {
    const char = asChar();
    char.attributes.secondary.toughness.max = 10;
    char.attributes.secondary.toughness.current = 7;
    applyAddFlat(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "toughness" },
        modifier: { type: "addFlat", value: 5 },
      },
    ]);
    assert.equal(char.attributes.secondary.toughness.max, 15);
    assert.equal(char.attributes.secondary.toughness.current, 7);
  });

  it("ignores non-addFlat modifiers", () => {
    const char = asChar();
    char.attributes.secondary.defense = 10;
    applyAddFlat(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "multiply", value: 2 },
      },
    ]);
    assert.equal(char.attributes.secondary.defense, 10);
  });
});

// ── applyMultiply ────────────────────────────────────────────────

describe("applyMultiply", () => {
  it("multiplies and rounds scalar secondary stat", () => {
    const char = asChar();
    char.attributes.secondary.defense = 10;
    applyMultiply(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "multiply", value: 1.5 },
      },
    ]);
    assert.equal(char.attributes.secondary.defense, 15);
  });

  it("multiplies toughness.max", () => {
    const char = asChar();
    char.attributes.secondary.toughness.max = 10;
    applyMultiply(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "toughness" },
        modifier: { type: "multiply", value: 2 },
      },
    ]);
    assert.equal(char.attributes.secondary.toughness.max, 20);
  });

  it("multiply on toughness leaves `.current` untouched (Item 11)", () => {
    const char = asChar();
    char.attributes.secondary.toughness.max = 10;
    char.attributes.secondary.toughness.current = 4;
    applyMultiply(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "toughness" },
        modifier: { type: "multiply", value: 2 },
      },
    ]);
    assert.equal(char.attributes.secondary.toughness.max, 20);
    assert.equal(char.attributes.secondary.toughness.current, 4);
  });
});

// ── applyCap ─────────────────────────────────────────────────────

describe("applyCap", () => {
  it("caps scalar secondary stat", () => {
    const char = asChar();
    char.attributes.secondary.defense = 100;
    applyCap(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "cap", value: 50 },
      },
    ]);
    assert.equal(char.attributes.secondary.defense, 50);
  });

  it("does not raise value below cap", () => {
    const char = asChar();
    char.attributes.secondary.defense = 5;
    applyCap(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "cap", value: 20 },
      },
    ]);
    assert.equal(char.attributes.secondary.defense, 5);
  });

  it("caps toughness.max and leaves `.current` untouched (Item 11)", () => {
    const char = asChar();
    char.attributes.secondary.toughness.max = 100;
    char.attributes.secondary.toughness.current = 60;
    applyCap(char, [
      {
        source: "test",
        target: { kind: "secondary", stat: "toughness" },
        modifier: { type: "cap", value: 50 },
      },
    ]);
    assert.equal(char.attributes.secondary.toughness.max, 50);
    assert.equal(char.attributes.secondary.toughness.current, 60);
  });
});

// ── applyFlag ────────────────────────────────────────────────────

describe("applyFlag", () => {
  it("adds a flag", () => {
    const char = asChar();
    applyFlag(char, [
      {
        source: "test",
        target: { kind: "flag", name: "darkvision" },
        modifier: { type: "addFlat", value: 1 },
      },
    ]);
    assert.deepEqual(char.flags, ["darkvision"]);
  });

  it("removes a flag", () => {
    const char = asChar();
    char.flags = ["darkvision", "flight"];
    applyFlag(char, [
      {
        source: "test",
        target: { kind: "flag", name: "darkvision" },
        modifier: { type: "remove" },
      },
    ]);
    assert.deepEqual(char.flags, ["flight"]);
  });

  it("does not duplicate flags", () => {
    const char = asChar();
    char.flags = ["darkvision"];
    applyFlag(char, [
      {
        source: "test",
        target: { kind: "flag", name: "darkvision" },
        modifier: { type: "addFlat", value: 1 },
      },
    ]);
    assert.deepEqual(char.flags, ["darkvision"]);
  });

  it("adds armor quality when body armor present", () => {
    const char = asChar();
    char.equipment.armor.body = {
      id: "leather",
      name: "Leather",
      armor: 1,
      qualities: [],
    };
    applyFlag(char, [
      {
        source: "test",
        target: { kind: "armorQuality", quality: "reinforced" },
        modifier: { type: "addFlat", value: 1 },
      },
    ]);
    assert.deepEqual(char.equipment.armor.body!.qualities, ["reinforced"]);
  });

  it("removes armor quality", () => {
    const char = asChar();
    char.equipment.armor.body = {
      id: "leather",
      name: "Leather",
      armor: 1,
      qualities: ["reinforced", "padded"],
    };
    applyFlag(char, [
      {
        source: "test",
        target: { kind: "armorQuality", quality: "reinforced" },
        modifier: { type: "remove" },
      },
    ]);
    assert.deepEqual(char.equipment.armor.body!.qualities, ["padded"]);
  });

  it("no-op when armor body is null", () => {
    const char = asChar();
    char.equipment.armor.body = null;
    assert.doesNotThrow(() =>
      applyFlag(char, [
        {
          source: "test",
          target: { kind: "armorQuality", quality: "reinforced" },
          modifier: { type: "addFlat", value: 1 },
        },
      ]),
    );
  });
});
