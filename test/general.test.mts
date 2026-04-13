import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { scaleCropForContainer } from "../src/lib/general.mts";

// ── scaleCropForContainer ─────────────────────────────────────────

describe("scaleCropForContainer", () => {
  it("returns identical crop when dimensions are the same", () => {
    const crop = { x: 10, y: 20, scale: 1.5, rotation: 45 };
    const size = { width: 100, height: 100 };
    const result = scaleCropForContainer(crop, size, size);

    assert.deepStrictEqual(result, crop);
  });

  it("scales proportionally when both dimensions double", () => {
    const crop = { x: 10, y: 20, scale: 1, rotation: 0 };
    const from = { width: 100, height: 100 };
    const to = { width: 200, height: 200 };
    const result = scaleCropForContainer(crop, from, to);

    assert.equal(result.x, 20);
    assert.equal(result.y, 40);
    assert.equal(result.scale, 2);
  });

  it("uses Math.min of width/height ratios for non-proportional scaling", () => {
    const crop = { x: 10, y: 10, scale: 1, rotation: 0 };
    const from = { width: 100, height: 100 };
    const to = { width: 200, height: 300 };
    const result = scaleCropForContainer(crop, from, to);

    // widthRatio = 2, heightRatio = 3, min = 2
    assert.equal(result.x, 20); // 10 * 2
    assert.equal(result.y, 30); // 10 * 3
    assert.equal(result.scale, 2); // 1 * min(2, 3)
  });

  it("passes rotation through unchanged", () => {
    const crop = { x: 0, y: 0, scale: 1, rotation: 90 };
    const from = { width: 50, height: 50 };
    const to = { width: 100, height: 200 };
    const result = scaleCropForContainer(crop, from, to);

    assert.equal(result.rotation, 90);
  });

  it("produces Infinity for x when fromSize.width is zero", () => {
    const crop = { x: 10, y: 10, scale: 1, rotation: 0 };
    const from = { width: 0, height: 100 };
    const to = { width: 200, height: 200 };
    const result = scaleCropForContainer(crop, from, to);

    assert.equal(result.x, Infinity);
    // scale = min(Infinity, 2) = 2
    assert.equal(result.scale, 2);
  });

  it("produces Infinity for y when fromSize.height is zero", () => {
    const crop = { x: 10, y: 10, scale: 1, rotation: 0 };
    const from = { width: 100, height: 0 };
    const to = { width: 200, height: 200 };
    const result = scaleCropForContainer(crop, from, to);

    assert.equal(result.y, Infinity);
    // scale = min(2, Infinity) = 2
    assert.equal(result.scale, 2);
  });
});
