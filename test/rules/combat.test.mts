// Per-slot combat fanout tests (Phase 6 / Chunk E).
//
// Exercises `deriveCombatSlots` end-to-end through `recalculate`, plus
// `matchesPredicates` directly. Synthetic test data only — real catalog
// integration lands in Chunk G.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { recalculate } from "../../src/rules/derived.mts";
import { matchesPredicates } from "../../src/rules/applicator.mts";
import { normalizeRawEffect } from "../../src/rules/effects.mts";

import { createInMemoryRegistry, emptyRegistry } from "../helpers/registry.mts";
import { makeTypedCharacter } from "../helpers/fixtures.mts";

import type {
  Character,
  ResolvedEffect,
  Weapon,
} from "../../src/rpg-types.mts";

// ── helpers ────────────────────────────────────────────────────────

function weapon(
  id: string,
  type: string,
  damage: number,
  qualities: string[] = [],
  effects?: ResolvedEffect[],
): Weapon {
  return {
    id,
    name: id,
    type,
    damage,
    qualities,
    ...(effects ? { effects } : {}),
  };
}

/**
 * Build a typed character carrying the given weapons. `equipment.weapons`
 * is the array; `combat.carried` references entries by index. Slot 2 is
 * always pinned to the natural_weapon synthesized at index 0 of the
 * fixture's default equipment unless an `own`-qualified weapon is added
 * to `weapons`.
 */
function withLoadout(
  weapons: Weapon[],
  carried: [number | null, number | null, number],
): Character {
  // makeTypedCharacter seeds equipment.weapons[0] = natural_weapon and
  // combat.carried[2] = { weaponIndex: 0 }. Replace both wholesale.
  const natural = weapon("natural_weapon", "natural", 0, ["own"]);
  return makeTypedCharacter({
    equipment: { weapons: [natural, ...weapons] },
    combat: {
      carried: [
        carried[0] === null ? null : { weaponIndex: carried[0] + 1 },
        carried[1] === null ? null : { weaponIndex: carried[1] + 1 },
        // Map user-supplied index 2 onto natural_weapon (index 0) unless
        // they explicitly wanted a different `own` weapon at carried[2].
        { weaponIndex: carried[2] === 0 ? 0 : carried[2] + 1 },
      ],
    },
  }) as Character;
}

// ── matchesPredicates ──────────────────────────────────────────────

describe("matchesPredicates", () => {
  const sword = weapon("longsword", "main", 4, ["short"]);
  const polearm = weapon("halberd", "polearm", 6, ["long", "ranged"]);

  it("undefined predicates = match-all", () => {
    assert.equal(matchesPredicates(sword, undefined), true);
  });

  it("empty array = match-all", () => {
    assert.equal(matchesPredicates(sword, []), true);
  });

  it("kind=any always matches", () => {
    assert.equal(matchesPredicates(sword, [{ kind: "any" }]), true);
  });

  it("id matches when weapon.id is in values", () => {
    assert.equal(
      matchesPredicates(sword, [{ kind: "id", values: ["longsword"] }]),
      true,
    );
    assert.equal(
      matchesPredicates(polearm, [{ kind: "id", values: ["longsword"] }]),
      false,
    );
  });

  it("type matches when weapon.type is in values", () => {
    assert.equal(
      matchesPredicates(polearm, [{ kind: "type", values: ["polearm"] }]),
      true,
    );
    assert.equal(
      matchesPredicates(sword, [{ kind: "type", values: ["polearm"] }]),
      false,
    );
  });

  it("quality matches when any value appears in weapon.qualities (OR)", () => {
    assert.equal(
      matchesPredicates(polearm, [
        { kind: "quality", values: ["ranged", "thrown"] },
      ]),
      true,
    );
    assert.equal(
      matchesPredicates(sword, [
        { kind: "quality", values: ["ranged", "thrown"] },
      ]),
      false,
    );
  });

  it("multiple predicates AND-compose", () => {
    assert.equal(
      matchesPredicates(polearm, [
        { kind: "type", values: ["polearm"] },
        { kind: "quality", values: ["ranged"] },
      ]),
      true,
    );
    assert.equal(
      matchesPredicates(polearm, [
        { kind: "type", values: ["polearm"] },
        { kind: "quality", values: ["thrown"] },
      ]),
      false,
    );
  });
});

// ── deriveCombatSlots — predicate routing ──────────────────────────

describe("deriveCombatSlots: predicate routing", () => {
  it("addFlat with type predicate routes to matching slot only", () => {
    const sword = weapon("longsword", "main", 4);
    const polearm = weapon("halberd", "polearm", 6);
    const char = withLoadout([sword, polearm], [0, 1, 0]);

    const registry = createInMemoryRegistry({
      traits: {
        "polearm-mastery:novice": {
          effects: [
            {
              source: "polearm-mastery",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "addFlat", value: 2 },
              appliesTo: [{ kind: "type", values: ["polearm"] }],
            },
          ],
        },
      },
    });
    char.traits = [
      { id: "polearm-mastery", tier: "novice", source: "ability" },
    ];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.bonusDamage, 0); // sword unaffected
    assert.equal(result.combat.carried[1]!.bonusDamage, 2); // polearm
    assert.equal(result.combat.carried[2]!.bonusDamage, 0); // natural
  });

  it("id predicate narrows to a single weapon", () => {
    const longsword = weapon("longsword", "main", 4);
    const dagger = weapon("dagger", "main", 2);
    const char = withLoadout([longsword, dagger], [0, 1, 0]);

    const registry = createInMemoryRegistry({
      traits: {
        "dagger-tricks:novice": {
          effects: [
            {
              source: "dagger-tricks",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "addFlat", value: 3 },
              appliesTo: [{ kind: "id", values: ["dagger"] }],
            },
          ],
        },
      },
    });
    char.traits = [{ id: "dagger-tricks", tier: "novice", source: "ability" }];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.bonusDamage, 0);
    assert.equal(result.combat.carried[1]!.bonusDamage, 3);
  });

  it("multi-slot independence: per-slot effects don't bleed", () => {
    const sword = weapon("longsword", "main", 4);
    const bow = weapon("shortbow", "ranged", 3, ["ranged"]);
    const char = withLoadout([sword, bow], [0, 1, 0]);

    const registry = createInMemoryRegistry({
      qualities: {
        // `ranged` is referenced by both the weapon (carried quality)
        // and the ability's `appliesTo` predicate; register it as a
        // no-op so the strict registry check is satisfied.
        ranged: { id: "ranged", effects: [] },
      },
      traits: {
        "marksmanship:adept": {
          effects: [
            {
              source: "marksmanship",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "addFlat", value: 4 },
              appliesTo: [{ kind: "quality", values: ["ranged"] }],
            },
          ],
        },
      },
    });
    char.traits = [{ id: "marksmanship", tier: "adept", source: "ability" }];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.bonusDamage, 0);
    assert.equal(result.combat.carried[1]!.bonusDamage, 4);
  });
});

// ── deriveCombatSlots — slot defaults & enforcement ────────────────

describe("deriveCombatSlots: slot shape", () => {
  it("empty slot 0/1 stays null; slot 2 always present", () => {
    const result = recalculate(
      makeTypedCharacter() as Character,
      emptyRegistry,
    );
    assert.equal(result.combat.carried[0], null);
    assert.equal(result.combat.carried[1], null);
    assert.notEqual(result.combat.carried[2], null);
  });

  it("slot defaults: attackAttribute=accurate, baseDamage=weapon.damage", () => {
    const sword = weapon("longsword", "main", 4);
    const char = withLoadout([sword], [0, null, 0]);
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.combat.carried[0]!.attackAttribute, "accurate");
    assert.equal(result.combat.carried[0]!.baseDamage, 4);
    assert.equal(result.combat.carried[0]!.bonusDamage, 0);
    assert.deepEqual(result.combat.carried[0]!.qualities, []);
    assert.deepEqual(result.combat.carried[0]!.flags, []);
  });

  it("slot 2 own-quality enforced — natural_weapon synthesized when missing", () => {
    // Construct a character whose equipment.weapons has no `own` weapon.
    // The synthesis logic must add one and pin slot 2 to it.
    const char = makeTypedCharacter({
      equipment: { weapons: [weapon("longsword", "main", 4)] },
      combat: { carried: [null, null, { weaponIndex: 0 }] },
    }) as Character;
    const result = recalculate(char, emptyRegistry);
    const slot2 = result.combat.carried[2]!;
    const slot2Weapon = result.equipment.weapons[slot2.weaponIndex] as Weapon;
    assert.ok(slot2Weapon.qualities.includes("own"));
  });
});

// ── deriveCombatSlots — modifier semantics ─────────────────────────

describe("deriveCombatSlots: modifier semantics", () => {
  it("addFlat accumulates across multiple effects", () => {
    const sword = weapon("longsword", "main", 4);
    const char = withLoadout([sword], [0, null, 0]);

    const registry = createInMemoryRegistry({
      traits: {
        "training:novice": {
          effects: [
            {
              source: "training",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "addFlat", value: 2 },
            },
            {
              source: "training",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "addFlat", value: 3 },
            },
          ],
        },
      },
    });
    char.traits = [{ id: "training", tier: "novice", source: "ability" }];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.bonusDamage, 5);
  });

  it("negative addFlat (Axe-Patterns adept style) is honored", () => {
    const axe = weapon("battleaxe", "main", 5);
    const char = withLoadout([axe], [0, null, 0]);

    const registry = createInMemoryRegistry({
      traits: {
        "axe-patterns:adept": {
          effects: [
            {
              source: "axe-patterns",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "addFlat", value: -2 },
            },
          ],
        },
      },
    });
    char.traits = [{ id: "axe-patterns", tier: "adept", source: "ability" }];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.bonusDamage, -2);
  });

  it("cap clamps slot bonusDamage", () => {
    const sword = weapon("longsword", "main", 4);
    const char = withLoadout([sword], [0, null, 0]);

    const registry = createInMemoryRegistry({
      traits: {
        "test:novice": {
          effects: [
            {
              source: "test",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "addFlat", value: 10 },
            },
            {
              source: "test",
              target: { kind: "combat", field: "bonusDamage" },
              modifier: { type: "cap", value: 5 },
            },
          ],
        },
      },
    });
    char.traits = [{ id: "test", tier: "novice", source: "ability" }];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.bonusDamage, 5);
  });

  it("attackAttribute setBase overrides default", () => {
    const sword = weapon("longsword", "main", 4);
    const char = withLoadout([sword], [0, null, 0]);
    // resolveSetBase picks max-by-primary with the default (accurate)
    // included; ties go to the default. Bump strong above accurate so
    // the override wins.
    char.attributes.primary.strong = 13;
    char.attributes.primaryEffective = { ...char.attributes.primary };

    const registry = createInMemoryRegistry({
      traits: {
        "brutality:novice": {
          effects: [
            {
              source: "brutality",
              target: { kind: "combat", field: "attackAttribute" },
              modifier: { type: "setBase", value: "strong" },
            },
          ],
        },
      },
    });
    char.traits = [{ id: "brutality", tier: "novice", source: "ability" }];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.attackAttribute, "strong");
  });

  it("attackAttribute arithmetic is rejected at parse time", () => {
    // Round-trip via normalizeRawEffect — addFlat on attackAttribute
    // must be dropped (returns null).
    const result = normalizeRawEffect(
      {
        target: { kind: "combat", field: "attackAttribute" },
        modifier: { type: "addFlat", value: 1 },
      } as never,
      "test",
    );
    assert.equal(result, null);
  });

  it("setBase on non-attackAttribute combat field is rejected at parse time", () => {
    const result = normalizeRawEffect(
      {
        target: { kind: "combat", field: "baseDamage" },
        modifier: { type: "setBase", value: "strong" },
      } as never,
      "test",
    );
    assert.equal(result, null);
  });
});

// ── deriveCombatSlots — weaponQuality per-slot ─────────────────────

describe("deriveCombatSlots: weaponQuality add/remove", () => {
  it("addFlat adds the quality to matching slot only", () => {
    const sword = weapon("longsword", "main", 4);
    const polearm = weapon("halberd", "polearm", 6);
    const char = withLoadout([sword, polearm], [0, 1, 0]);

    const registry = createInMemoryRegistry({
      traits: {
        "polearm-mastery:novice": {
          effects: [
            {
              source: "polearm-mastery",
              target: { kind: "weaponQuality", quality: "reach" },
              modifier: { type: "addFlat", value: 1 },
              appliesTo: [{ kind: "type", values: ["polearm"] }],
            },
          ],
        },
      },
    });
    char.traits = [
      { id: "polearm-mastery", tier: "novice", source: "ability" },
    ];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.qualities.includes("reach"), false);
    assert.equal(result.combat.carried[1]!.qualities.includes("reach"), true);
  });

  it("remove strips a quality the weapon was carrying", () => {
    const polearm = weapon("halberd", "polearm", 6, ["clumsy"]);
    const char = withLoadout([polearm], [0, null, 0]);

    const registry = createInMemoryRegistry({
      qualities: {
        // Test-only quality; register as a no-op so the strict
        // registry check is satisfied.
        clumsy: { id: "clumsy", effects: [] },
      },
      traits: {
        "polish:adept": {
          effects: [
            {
              source: "polish",
              target: { kind: "weaponQuality", quality: "clumsy" },
              modifier: { type: "remove" },
              appliesTo: [{ kind: "type", values: ["polearm"] }],
            },
          ],
        },
      },
    });
    char.traits = [{ id: "polish", tier: "adept", source: "ability" }];

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.qualities.includes("clumsy"), false);
  });

  it("registry-resolved weapon quality (ADR-016): effects scope to the carrying weapon", () => {
    // `fortified` quality registry entry adds +2 baseDamage. It is
    // listed on the polearm only, so the sword in slot 0 is unaffected
    // even though the same id could appear elsewhere.
    const sword = weapon("longsword", "main", 4);
    const polearm = weapon("halberd", "polearm", 6, ["fortified"]);
    const char = withLoadout([sword, polearm], [0, 1, 0]);

    const registry = createInMemoryRegistry({
      qualities: {
        fortified: {
          id: "fortified",
          effects: [
            {
              source: "fortified",
              target: { kind: "combat", field: "baseDamage" },
              modifier: { type: "addFlat", value: 2 },
            },
          ],
        },
      },
    });

    const result = recalculate(char, registry);
    assert.equal(result.combat.carried[0]!.baseDamage, 4); // sword unchanged
    assert.equal(result.combat.carried[1]!.baseDamage, 8); // polearm 6 + 2
  });
});

// ── armorQuality body + plug ────────────────────────────────────────

describe("armorQuality: body and plug", () => {
  it("addFlat adds quality to both body and plug when present", () => {
    const char = makeTypedCharacter({
      equipment: {
        armor: {
          body: { id: "leather", name: "Leather", armor: 1, qualities: [] },
          plug: { id: "shield", name: "Shield", armor: 0, qualities: [] },
        },
      },
    }) as Character;

    const registry = createInMemoryRegistry({
      traits: {
        "reinforcement:novice": {
          effects: [
            {
              source: "reinforcement",
              target: { kind: "armorQuality", quality: "reinforced" },
              modifier: { type: "addFlat", value: 1 },
            },
          ],
        },
      },
    });
    char.traits = [{ id: "reinforcement", tier: "novice", source: "ability" }];

    const result = recalculate(char, registry);
    assert.deepEqual(result.equipment.armor.body!.qualitiesEffective, [
      "reinforced",
    ]);
    assert.deepEqual(result.equipment.armor.plug!.qualitiesEffective, [
      "reinforced",
    ]);
    // Authored qualities never mutated (Bug #31).
    assert.deepEqual(result.equipment.armor.body!.qualities, []);
    assert.deepEqual(result.equipment.armor.plug!.qualities, []);
  });
});

// ── flags reset between recalcs (Bug #31) ──────────────────────────

describe("Bug #31: derived collections reset between recalcs", () => {
  it("character.flags from a prior recalc is wiped before the next pass", () => {
    const char = makeTypedCharacter() as Character;
    // Simulate stale state from a previous recalc.
    char.flags = ["stale-flag"];
    const result = recalculate(char, emptyRegistry);
    assert.deepEqual(result.flags, []);
  });

  it("per-slot flags reset between recalcs", () => {
    const sword = weapon("longsword", "main", 4);
    const char = withLoadout([sword], [0, null, 0]);
    // Simulate stale per-slot flags.
    char.combat.carried[0]!.flags = ["stale"];
    const result = recalculate(char, emptyRegistry);
    assert.deepEqual(result.combat.carried[0]!.flags, []);
  });
});

// ── armor + weapon mounted effects ─────────────────────────────────

describe("equipment-mounted effects", () => {
  it("armor.body.effects are collected globally", () => {
    const char = makeTypedCharacter({
      equipment: {
        armor: {
          body: {
            id: "blessed-mail",
            name: "Blessed Mail",
            armor: 2,
            qualities: [],
            effects: [
              {
                source: "blessed-mail",
                target: { kind: "flag", name: "darkvision" },
                modifier: { type: "addFlat", value: 1 },
              },
            ],
          },
          plug: null,
        },
      },
    }) as Character;
    const result = recalculate(char, emptyRegistry);
    assert.ok(result.flags.includes("darkvision"));
  });

  it("weapon.effects scope to the carrying slot only", () => {
    const sword = weapon("longsword", "main", 4);
    const enchanted = weapon(
      "flame-sword",
      "main",
      5,
      [],
      [
        {
          source: "flame-sword",
          target: { kind: "combat", field: "bonusDamage" },
          modifier: { type: "addFlat", value: 3 },
        },
      ],
    );
    const char = withLoadout([sword, enchanted], [0, 1, 0]);
    const result = recalculate(char, emptyRegistry);
    assert.equal(result.combat.carried[0]!.bonusDamage, 0); // plain sword
    assert.equal(result.combat.carried[1]!.bonusDamage, 3); // flame sword
  });
});
