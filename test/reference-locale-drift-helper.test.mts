// Unit tests for the `assertEqualNonLocalized` traversal helper used by
// `reference-locale-drift.test.mts`. The full corpus drift test exercises
// the happy paths via real reference files; this file pins down the
// failure-mode branches and the localized-fields allowlist behaviour
// using small in-memory inputs.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { assertEqualNonLocalized } from "./reference-locale-drift.test.mts";

describe("assertEqualNonLocalized: localized-fields allowlist", () => {
  it("ignores `name` differences (different strings)", () => {
    assert.doesNotThrow(() =>
      assertEqualNonLocalized(
        { id: "x", name: "Sword" },
        { id: "x", name: "Меч" },
        "$",
      ),
    );
  });

  it("ignores `description` present in en but absent in ru", () => {
    assert.doesNotThrow(() =>
      assertEqualNonLocalized(
        { id: "x", description: "long" },
        { id: "x" },
        "$",
      ),
    );
  });

  it("ignores `tags` present in ru but absent in en", () => {
    assert.doesNotThrow(() =>
      assertEqualNonLocalized({ id: "x" }, { id: "x", tags: ["melee"] }, "$"),
    );
  });

  it("ignores localized differences in nested values too", () => {
    assert.doesNotThrow(() =>
      assertEqualNonLocalized(
        { id: "x", inner: { name: "EN", value: 1 } },
        { id: "x", inner: { name: "RU", value: 1 } },
        "$",
      ),
    );
  });
});

describe("assertEqualNonLocalized: array mismatches", () => {
  it("throws on length mismatch", () => {
    assert.throws(
      () => assertEqualNonLocalized([1, 2, 3], [1, 2], "$"),
      /array length differs.*en=3.*ru=2/,
    );
  });

  it("throws when one side is array and other is not", () => {
    assert.throws(
      () => assertEqualNonLocalized([1, 2], { 0: 1, 1: 2 }, "$"),
      /array vs non-array/,
    );
  });

  it("recurses into elements with index in the path", () => {
    assert.throws(
      () => assertEqualNonLocalized([1, 2, 3], [1, 9, 3], "$"),
      /Drift at \$\[1\]/,
    );
  });
});

describe("assertEqualNonLocalized: object key set divergence", () => {
  it("throws when en has a non-localized key ru lacks", () => {
    assert.throws(
      () => assertEqualNonLocalized({ id: "x", damage: 4 }, { id: "x" }, "$"),
      /key 'damage' present in en but not ru/,
    );
  });

  it("throws when ru has a non-localized key en lacks", () => {
    assert.throws(
      () => assertEqualNonLocalized({ id: "x" }, { id: "x", damage: 4 }, "$"),
      /key 'damage' present in ru but not en/,
    );
  });

  it("throws when one side is object and other is not", () => {
    assert.throws(
      () => assertEqualNonLocalized({ id: "x" }, "x", "$"),
      /object vs non-object/,
    );
  });
});

describe("assertEqualNonLocalized: primitive equality", () => {
  it("accepts equal numbers", () => {
    assert.doesNotThrow(() => assertEqualNonLocalized(4, 4, "$.damage"));
  });

  it("accepts equal strings", () => {
    assert.doesNotThrow(() =>
      assertEqualNonLocalized("polearm", "polearm", "$.type"),
    );
  });

  it("accepts equal booleans and null", () => {
    assert.doesNotThrow(() => assertEqualNonLocalized(true, true, "$"));
    assert.doesNotThrow(() => assertEqualNonLocalized(null, null, "$"));
  });

  it("throws on differing primitives with both values shown", () => {
    assert.throws(
      () => assertEqualNonLocalized(4, 6, "$.damage"),
      /Drift at \$\.damage: en=4, ru=6/,
    );
  });

  it("throws on differing types treated as primitives", () => {
    // Neither side is array or plain object → primitive branch with !==.
    assert.throws(() => assertEqualNonLocalized(0, "0", "$"), /Drift at \$/);
  });
});
