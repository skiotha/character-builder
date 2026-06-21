// Same-id rewrite semantics for special attacks and reactions
// (ADR-014 §action-rewrite).
//
// The engine's `collectActions` step (in `src/rules/derived.mts`) walks
// `character.traits[]`, calls `registry.lookupTrait(id, tier)`, and
// dedupes the returned actions by `Action.id` with last-write-wins
// semantics. Because the registry returns actions in tier-ascending
// order (novice → adept → master, see `registry-types.mts`), a
// higher-tier action with a shared id naturally rewrites the lower-
// tier one. Different-id entries from any tier coexist.
//
// These tests use the in-memory registry stub directly to author
// tier-ascending arrays; the production trait/talent loader (when it
// ships) is expected to honour the same ordering contract.

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import { recalculate } from "../../src/rules/derived.mts";

import { createInMemoryRegistry, emptyRegistry } from "../helpers/registry.mts";
import { makeTypedCharacter } from "../helpers/fixtures.mts";

import type { Reaction, SpecialAttack } from "../../src/rpg-types.mts";

// ── helpers ─────────────────────────────────────────────────────

function sa(id: string, name: string, damage: number): SpecialAttack {
  return { id, name, trigger: "manual", damage };
}

function reaction(id: string, name: string, damage: number): Reaction {
  return { id, name, trigger: "onAttacked", damage };
}

// ── tests ───────────────────────────────────────────────────────

describe("collectActions — same-id rewrite", () => {
  it("master rewrites adept rewrites novice for special attacks (single survivor, master wins)", () => {
    const registry = createInMemoryRegistry({
      traits: {
        // Novice/adept/master each return tier-ascending arrays; the
        // master entry's array is the union (novice + adept + master)
        // because the production loader stamps it that way (ADR-014
        // tier stacking is registry-internal, additive).
        "intrigues:master": {
          specialAttacks: [
            sa("intrigues-backstab", "Backstab", 10), // novice
            sa("intrigues-backstab", "Backstab", 12), // adept (would-be)
            sa("intrigues-backstab", "Backstab", 14), // master (winner)
          ],
        },
      },
    });

    const char = makeTypedCharacter({
      traits: [{ id: "intrigues", tier: "master", source: "ability" }],
    });

    const result = recalculate(char, registry);
    assert.equal(result.specialAttacks.length, 1);
    assert.equal(result.specialAttacks[0]!.id, "intrigues-backstab");
    assert.equal(result.specialAttacks[0]!.damage, 14);
  });

  it("different-id entries coexist (Sulfur Cascade Scorch + Pyroclasm)", () => {
    const registry = createInMemoryRegistry({
      traits: {
        "sulfur-cascade:adept": {
          specialAttacks: [
            sa("sulfur-cascade-scorch", "Scorch", 6), // novice
            sa("sulfur-cascade-pyroclasm", "Pyroclasm", 10), // adept
          ],
        },
      },
    });

    const char = makeTypedCharacter({
      traits: [{ id: "sulfur-cascade", tier: "adept", source: "spell" }],
    });

    const result = recalculate(char, registry);
    const ids = result.specialAttacks.map((s) => s.id).sort();
    assert.deepEqual(ids, [
      "sulfur-cascade-pyroclasm",
      "sulfur-cascade-scorch",
    ]);
  });

  it("reactions follow the same rewrite-by-id rule", () => {
    const registry = createInMemoryRegistry({
      traits: {
        "intrigues:master": {
          reactions: [
            reaction("intrigues-strike-from-shadows", "Strike", 8), // novice
            reaction("intrigues-strike-from-shadows", "Strike", 12), // master
          ],
        },
      },
    });

    const char = makeTypedCharacter({
      traits: [{ id: "intrigues", tier: "master", source: "ability" }],
    });

    const result = recalculate(char, registry);
    assert.equal(result.reactions.length, 1);
    assert.equal(result.reactions[0]!.damage, 12);
  });

  it("a trait at adept never receives the master-only entries", () => {
    // Mirrors what a real registry returns at adept: novice + adept
    // entries only, no master. Engine has no way to "see" master
    // because the registry never hands it over.
    const registry = createInMemoryRegistry({
      traits: {
        "intrigues:adept": {
          specialAttacks: [
            sa("intrigues-backstab", "Backstab", 10), // novice
            sa("intrigues-backstab", "Backstab", 12), // adept
          ],
        },
      },
    });

    const char = makeTypedCharacter({
      traits: [{ id: "intrigues", tier: "adept", source: "ability" }],
    });

    const result = recalculate(char, registry);
    assert.equal(result.specialAttacks.length, 1);
    assert.equal(result.specialAttacks[0]!.damage, 12);
  });

  it("empty traits[] yields empty specialAttacks and reactions arrays", () => {
    const result = recalculate(
      makeTypedCharacter({ traits: [] }),
      emptyRegistry,
    );
    assert.deepEqual(result.specialAttacks, []);
    assert.deepEqual(result.reactions, []);
  });

  it("unknown trait id is warn-and-skip (no throw, no contribution)", () => {
    const warn = mock.method(console, "warn", () => {});
    try {
      const char = makeTypedCharacter({
        traits: [{ id: "nonexistent", tier: "master", source: "ability" }],
      });
      const result = recalculate(char, emptyRegistry);
      assert.deepEqual(result.specialAttacks, []);
      assert.deepEqual(result.reactions, []);
    } finally {
      warn.mock.restore();
    }
  });

  it("repeated recalc does not accumulate (NB-31 reset still applies)", () => {
    const registry = createInMemoryRegistry({
      traits: {
        "intrigues:master": {
          specialAttacks: [sa("intrigues-backstab", "Backstab", 14)],
        },
      },
    });

    const char = makeTypedCharacter({
      traits: [{ id: "intrigues", tier: "master", source: "ability" }],
    });

    const once = recalculate(char, registry);
    const twice = recalculate(once, registry);
    assert.equal(twice.specialAttacks.length, 1);
    assert.equal(twice.specialAttacks[0]!.damage, 14);
  });
});
