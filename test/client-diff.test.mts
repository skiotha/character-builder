import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { changedPaths, deepEqual } from "../public/utils/diff.mjs";

// ── deepEqual ─────────────────────────────────────────────────────

describe("deepEqual", () => {
  it("compares primitives with ===", () => {
    assert.equal(deepEqual(1, 1), true);
    assert.equal(deepEqual("a", "a"), true);
    assert.equal(deepEqual(1, "1"), false);
    assert.equal(deepEqual(null, null), true);
    assert.equal(deepEqual(null, undefined), false);
    assert.equal(deepEqual(0, false), false);
  });

  it("compares arrays element-wise", () => {
    assert.equal(deepEqual([1, 2], [1, 2]), true);
    assert.equal(deepEqual([1, 2], [2, 1]), false);
    assert.equal(deepEqual([1, 2], [1, 2, 3]), false);
    assert.equal(deepEqual([{ a: 1 }], [{ a: 1 }]), true);
  });

  it("compares objects by key set and values", () => {
    assert.equal(deepEqual({ a: 1, b: [2] }, { b: [2], a: 1 }), true);
    assert.equal(deepEqual({ a: 1 }, { a: 1, b: undefined }), false);
    assert.equal(deepEqual({ a: { b: 1 } }, { a: { b: 2 } }), false);
  });

  it("distinguishes arrays from objects and null from objects", () => {
    assert.equal(deepEqual([], {}), false);
    assert.equal(deepEqual(null, {}), false);
    assert.equal(deepEqual({}, null), false);
  });
});

// ── changedPaths ──────────────────────────────────────────────────

interface Fixture {
  id: string;
  characterName: string;
  background: { race: string; age: number; location?: string; height?: number };
  attributes: {
    primary: { strength: number; agility: number };
    secondary: { toughness: { max: number; current: number }; defense: number };
  };
  traits: { id: string; tier: string }[];
  combat: { carried: ({ weaponIndex: number } | null)[] } | null;
}

function fixture(): Fixture {
  return {
    id: "c1",
    characterName: "Ada",
    background: { race: "human", age: 30, location: "Nagara" },
    attributes: {
      primary: { strength: 10, agility: 10 },
      secondary: { toughness: { max: 10, current: 10 }, defense: 10 },
    },
    traits: [{ id: "polearm", tier: "novice" }],
    combat: { carried: [null, null, { weaponIndex: 0 }] },
  };
}

describe("changedPaths", () => {
  it("returns an empty array for structurally identical characters", () => {
    assert.deepEqual(changedPaths(fixture(), fixture()), []);
  });

  it("treats an array with identical content but new identity as unchanged", () => {
    const a = fixture();
    const b = fixture();
    b.traits = [{ id: "polearm", tier: "novice" }];
    assert.deepEqual(changedPaths(a, b), []);
  });

  it("reports a top-level primitive change as leaf + root", () => {
    const b = fixture();
    b.characterName = "Bea";
    assert.deepEqual(changedPaths(fixture(), b), ["characterName", ""]);
  });

  it("reports a nested primitive change with every ancestor once, deepest first", () => {
    const b = fixture();
    b.attributes.secondary.toughness.current = 7;
    assert.deepEqual(changedPaths(fixture(), b), [
      "attributes.secondary.toughness.current",
      "attributes.secondary.toughness",
      "attributes.secondary",
      "attributes",
      "",
    ]);
  });

  it("reports an array content change at the array path, never an index path", () => {
    const b = fixture();
    b.combat!.carried[0] = { weaponIndex: 1 };
    assert.deepEqual(changedPaths(fixture(), b), [
      "combat.carried",
      "combat",
      "",
    ]);
  });

  it("de-duplicates shared ancestors across several changed leaves", () => {
    const b = fixture();
    b.attributes.primary.strength = 11;
    b.attributes.primary.agility = 9;
    const result = changedPaths(fixture(), b);
    assert.deepEqual(result, [
      "attributes.primary.strength",
      "attributes.primary.agility",
      "attributes.primary",
      "attributes",
      "",
    ]);
    assert.equal(new Set(result).size, result.length);
  });

  it("orders ancestors from different branches deepest first", () => {
    const b = fixture();
    b.attributes.secondary.toughness.max = 12;
    b.background.age = 31;
    const result = changedPaths(fixture(), b);
    const rootIndex = result.indexOf("");
    assert.equal(rootIndex, result.length - 1);
    assert.ok(
      result.indexOf("attributes.secondary.toughness") <
        result.indexOf("attributes.secondary"),
    );
    assert.ok(
      result.indexOf("attributes.secondary") < result.indexOf("attributes"),
    );
    assert.ok(result.indexOf("attributes.secondary") < result.indexOf("background"));
  });

  it("counts an added key as a change", () => {
    const b = fixture();
    b.background.height = 180;
    assert.deepEqual(changedPaths(fixture(), b), [
      "background.height",
      "background",
      "",
    ]);
  });

  it("counts a removed key as a change", () => {
    const a = fixture();
    const b = fixture();
    delete b.background.location;
    assert.deepEqual(changedPaths(a, b), ["background.location", "background", ""]);
  });

  it("reports the leaves of an object replaced by a primitive", () => {
    const b = fixture();
    b.combat = null;
    assert.deepEqual(changedPaths(fixture(), b), [
      "combat.carried",
      "combat",
      "",
    ]);
  });

  it("reports an empty object replaced by a primitive as one change", () => {
    assert.deepEqual(changedPaths({ a: {} }, { a: null }), ["a", ""]);
    assert.deepEqual(changedPaths({ a: {} }, { a: {} }), []);
  });

  it("ignores _-prefixed top-level keys present on one side only", () => {
    const a = { ...fixture(), _permissions: { role: "owner" } };
    assert.deepEqual(changedPaths(a, fixture()), []);
    assert.deepEqual(changedPaths(fixture(), a), []);
  });

  it("ignores changes inside _-prefixed top-level keys", () => {
    const a = { ...fixture(), _permissions: { role: "owner" } };
    const b = { ...fixture(), _permissions: { role: "public" } };
    assert.deepEqual(changedPaths(a, b), []);
  });

  it("does not ignore _-prefixed keys below the top level", () => {
    const a = { ...fixture(), background: { ...fixture().background, _x: 1 } };
    assert.deepEqual(changedPaths(fixture(), a), ["background._x", "background", ""]);
  });

  it("reports every leaf and ancestor when the old character is absent", () => {
    const result = changedPaths(null, {
      id: "c1",
      background: { race: "human" },
      traits: [],
    });
    assert.deepEqual(result, ["id", "background.race", "traits", "background", ""]);
    assert.deepEqual(changedPaths(undefined, { id: "c1" }), ["id", ""]);
  });

  it("reports the leaves of a subtree that appears or vanishes", () => {
    const withPortrait = { ...fixture(), portrait: { url: "/p.png", crop: { x: 1 } } };
    const expected = ["portrait.url", "portrait.crop.x", "portrait.crop", "portrait", ""];
    assert.deepEqual(changedPaths(fixture(), withPortrait), expected);
    assert.deepEqual(changedPaths(withPortrait, fixture()), expected);
  });
});
