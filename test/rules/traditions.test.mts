// Derived tradition membership (ES §traditions).
//
// `recalculate` rebuilds `character.traditions` on every pass from the
// learned traits: a trait contributes the tradition key its registry
// entry carries (tradition abilities only, any tier). Spells never
// contribute, and stale input values never survive.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { recalculate } from "../../src/rules/derived.mts";

import { createInMemoryRegistry } from "../helpers/registry.mts";
import { makeTypedCharacter } from "../helpers/fixtures.mts";

import type { LearnedTrait } from "../../src/rpg-types.mts";

const registry = createInMemoryRegistry({
  traits: {
    "mystical-tradition-order:novice": { tradition: "order" },
    "mystical-tradition-order:adept": { tradition: "order" },
    "mystical-tradition-order:master": { tradition: "order" },
    "mystical-tradition-witches-circle:novice": { tradition: "circle" },
    // A spell: resolves, but carries no tradition membership.
    "break-will:novice": {},
  },
});

function traditionsOf(traits: LearnedTrait[], stale: string[] = []): string[] {
  const char = makeTypedCharacter({ traits, traditions: stale });
  return recalculate(char, registry).traditions;
}

describe("deriveTraditions", () => {
  it("a tradition ability grants its key at novice", () => {
    assert.deepEqual(
      traditionsOf([
        { id: "mystical-tradition-order", tier: "novice", source: "ability" },
      ]),
      ["order"],
    );
  });

  it("a tradition ability grants its key at master", () => {
    assert.deepEqual(
      traditionsOf([
        { id: "mystical-tradition-order", tier: "master", source: "ability" },
      ]),
      ["order"],
    );
  });

  it("no tradition ability → empty", () => {
    assert.deepEqual(traditionsOf([]), []);
  });

  it("a spell alone grants nothing", () => {
    assert.deepEqual(
      traditionsOf([{ id: "break-will", tier: "novice", source: "spell" }]),
      [],
    );
  });

  it("two traditions are sorted by key", () => {
    assert.deepEqual(
      traditionsOf([
        { id: "mystical-tradition-order", tier: "adept", source: "ability" },
        {
          id: "mystical-tradition-witches-circle",
          tier: "novice",
          source: "ability",
        },
      ]),
      ["circle", "order"],
    );
  });

  it("overwrites stale input values (removing the ability clears the key)", () => {
    assert.deepEqual(traditionsOf([], ["order", "bogus"]), []);
  });

  it("skips unknown trait ids", (t) => {
    // `collectAllEffects` warns once for the miss; silence it here.
    t.mock.method(console, "warn", () => {});
    assert.deepEqual(
      traditionsOf([
        { id: "no-such-trait", tier: "novice", source: "ability" },
        { id: "mystical-tradition-order", tier: "novice", source: "ability" },
      ]),
      ["order"],
    );
  });
});
