import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveSetBase } from "../../src/rules/setbase.mts";

import { makePrimaryAttributes } from "../helpers/fixtures.mts";

import type {
  PrimaryAttributeName,
  PrimaryAttributes,
} from "../../src/rpg-types.mts";

const prim = (overrides?: Partial<Record<string, number>>): PrimaryAttributes =>
  makePrimaryAttributes(overrides) as unknown as PrimaryAttributes;

// ── resolveSetBase ─────────────────────────────────────────────
//
// Universal max-by-primary picker shared by:
//   * the secondary-attribute formula phase (defense/toughness/etc.)
//   * the per-slot combat.attackAttribute resolver
//   * deriveMagicAttribute / deriveInitiativeAttribute
//
// Algorithm: default-inclusive max. The default is prepended to the
// candidate pool, the comparison uses strict `>` so the default wins
// ties — an unfavourable override can never lower the chosen attribute
// below the default.

describe("resolveSetBase", () => {
  it("returns the default when there are no candidates", () => {
    const primary = prim();
    assert.equal(resolveSetBase("resolute", [], primary), "resolute");
  });

  it("returns undefined when default is null and no candidates", () => {
    const primary = prim();
    assert.equal(resolveSetBase(null, [], primary), undefined);
  });

  it("picks the sole candidate over the default when it is strictly greater", () => {
    const primary = prim({ resolute: 10, appealing: 13 });
    assert.equal(
      resolveSetBase("resolute", ["appealing"], primary),
      "appealing",
    );
  });

  it("keeps the default on a tie with a single candidate", () => {
    // Both at 10 → default wins because comparison is strict `>`.
    const primary = prim({ resolute: 10, appealing: 10 });
    assert.equal(
      resolveSetBase("resolute", ["appealing"], primary),
      "resolute",
    );
  });

  it("keeps the default when the only candidate is lower", () => {
    const primary = prim({ resolute: 14, appealing: 9 });
    assert.equal(
      resolveSetBase("resolute", ["appealing"], primary),
      "resolute",
    );
  });

  it("picks the highest of multiple candidates over the default", () => {
    const primary = prim({
      resolute: 10,
      appealing: 12,
      cunning: 15,
    });
    assert.equal(
      resolveSetBase("resolute", ["appealing", "cunning"], primary),
      "cunning",
    );
  });

  it("breaks ties between candidates by first-wins (stable)", () => {
    // Two candidates tied at 13, default at 10 → first candidate wins.
    const primary = prim({
      resolute: 10,
      appealing: 13,
      cunning: 13,
    });
    assert.equal(
      resolveSetBase("resolute", ["appealing", "cunning"], primary),
      "appealing",
    );
  });

  it("treats default null as 'no floor' (best candidate wins outright)", () => {
    const primary = prim({ appealing: 8, cunning: 12 });
    assert.equal(
      resolveSetBase(null, ["appealing", "cunning"], primary),
      "cunning",
    );
  });

  it("uses 0 for missing primary entries (defensive)", () => {
    // Build a deliberately partial primary record.
    const partial = { resolute: 10 } as unknown as PrimaryAttributes;
    const candidates: PrimaryAttributeName[] = ["appealing"];
    assert.equal(resolveSetBase("resolute", candidates, partial), "resolute");
  });

  it("returns the default when every candidate is strictly lower", () => {
    const primary = prim({
      resolute: 18,
      appealing: 10,
      cunning: 12,
    });
    assert.equal(
      resolveSetBase("resolute", ["appealing", "cunning"], primary),
      "resolute",
    );
  });
});
