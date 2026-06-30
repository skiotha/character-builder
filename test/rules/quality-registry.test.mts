// Quality registry wiring (ADR-016).
//
// Exercises `recalculate` end-to-end with an in-memory registry whose
// `lookupQuality` is populated. Verifies:
//   * armor body+plug qualities feed the global effect pipeline
//   * parametric ids (e.g. `fortified_2`) resolve independently of
//     their bare counterpart (`fortified`)
//   * unknown ids THROW with a citing message that names the offending
//     weapon (id + slot index) or armor piece (body|plug + id)
//   * the strict path is the default (ADR-016) — the test stub no longer
//     silently absorbs unmapped ids; tests must register every quality
//     they reference (using `BASE_QUALITIES` for the own-slot anchor).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { recalculate } from "../../src/rules/derived.mts";

import {
  BASE_QUALITIES,
  createInMemoryRegistry,
  emptyRegistry,
} from "../helpers/registry.mts";
import { makeTypedCharacter } from "../helpers/fixtures.mts";

import type { Character, Weapon } from "../../src/rpg-types.mts";

function weapon(
  id: string,
  type: string,
  damage: number,
  qualities: string[] = [],
): Weapon {
  return { id, name: id, type, damage, qualities };
}

/** No-op registry with the given ids registered as empty-effect entries. */
function noopRegistry(ids: string[]) {
  const qualities = { ...BASE_QUALITIES } as Record<
    string,
    { id: string; effects: never[] }
  >;
  for (const id of ids) qualities[id] = { id, effects: [] };
  return createInMemoryRegistry({ qualities });
}

describe("quality registry: armor body and plug (ADR-016)", () => {
  it("body quality contributes effects globally", () => {
    const char = makeTypedCharacter({
      equipment: {
        armor: {
          body: {
            id: "leather",
            name: "Leather",
            armor: 1,
            qualities: ["padded"],
          },
          plug: null,
        },
      },
    }) as Character;

    const registry = createInMemoryRegistry({
      qualities: {
        ...BASE_QUALITIES,
        padded: {
          id: "padded",
          effects: [
            {
              source: "padded",
              target: { kind: "secondary", stat: "toughness" },
              modifier: { type: "addFlat", value: 5 },
            },
          ],
        },
      },
    });

    const before = recalculate(char, noopRegistry(["padded"]));
    const after = recalculate(char, registry);
    assert.equal(
      after.attributes.secondary.toughness.max -
        before.attributes.secondary.toughness.max,
      5,
    );
  });

  it("plug quality contributes effects globally and stacks with body", () => {
    const char = makeTypedCharacter({
      equipment: {
        armor: {
          body: {
            id: "leather",
            name: "Leather",
            armor: 1,
            qualities: ["padded"],
          },
          plug: {
            id: "shield",
            name: "Shield",
            armor: 0,
            qualities: ["padded"],
          },
        },
      },
    }) as Character;

    const registry = createInMemoryRegistry({
      qualities: {
        ...BASE_QUALITIES,
        padded: {
          id: "padded",
          effects: [
            {
              source: "padded",
              target: { kind: "secondary", stat: "toughness" },
              modifier: { type: "addFlat", value: 3 },
            },
          ],
        },
      },
    });

    const before = recalculate(char, noopRegistry(["padded"]));
    const after = recalculate(char, registry);
    // body + plug both carry padded → +3 each
    assert.equal(
      after.attributes.secondary.toughness.max -
        before.attributes.secondary.toughness.max,
      6,
    );
  });
});

describe("quality registry: parametric ids resolve independently", () => {
  it("fortified_2 and fortified are distinct registry entries", () => {
    const polearm = weapon("halberd", "polearm", 6, ["fortified_2"]);
    const char = makeTypedCharacter({
      equipment: {
        weapons: [weapon("natural_weapon", "natural", 0, ["own"]), polearm],
      },
      combat: {
        carried: [{ weaponIndex: 1 }, null, { weaponIndex: 0 }],
      },
    }) as Character;

    const registry = createInMemoryRegistry({
      qualities: {
        ...BASE_QUALITIES,
        fortified: {
          id: "fortified",
          effects: [
            {
              source: "fortified",
              target: { kind: "combat", field: "baseDamage" },
              modifier: { type: "addFlat", value: 1 },
            },
          ],
        },
        fortified_2: {
          id: "fortified_2",
          effects: [
            {
              source: "fortified_2",
              target: { kind: "combat", field: "baseDamage" },
              modifier: { type: "addFlat", value: 2 },
            },
          ],
        },
      },
    });

    const result = recalculate(char, registry);
    // Polearm carries fortified_2 → +2 only (not +1 from `fortified`).
    assert.equal(result.combat.carried[0]!.baseDamage, 8);
  });
});

describe("quality registry: unknown ids throw (ADR-016 strict)", () => {
  it("unknown weapon quality throws with weapon id + slot index", () => {
    const polearm = weapon("halberd", "polearm", 6, ["never_registered"]);
    const char = makeTypedCharacter({
      equipment: {
        weapons: [weapon("natural_weapon", "natural", 0, ["own"]), polearm],
      },
      combat: {
        carried: [{ weaponIndex: 1 }, null, { weaponIndex: 0 }],
      },
    }) as Character;

    // `own` registered (own-slot anchor); `never_registered` is not.
    const strict = createInMemoryRegistry({ qualities: { ...BASE_QUALITIES } });
    assert.throws(
      () => recalculate(char, strict),
      (err: Error) =>
        /Unknown weapon quality 'never_registered'/.test(err.message) &&
        /weapon 'halberd'/.test(err.message) &&
        /equipment\.weapons\[1\]/.test(err.message),
    );
  });

  it("unknown armor body quality throws with body + piece id", () => {
    const char = makeTypedCharacter({
      equipment: {
        armor: {
          body: {
            id: "leather",
            name: "Leather",
            armor: 1,
            qualities: ["never_registered_armor"],
          },
          plug: null,
        },
      },
    }) as Character;

    const strict = createInMemoryRegistry({ qualities: { ...BASE_QUALITIES } });
    assert.throws(
      () => recalculate(char, strict),
      (err: Error) =>
        /Unknown armor quality 'never_registered_armor'/.test(err.message) &&
        /armor\.body 'leather'/.test(err.message),
    );
  });

  it("unknown armor plug quality throws with plug + piece id", () => {
    const char = makeTypedCharacter({
      equipment: {
        armor: {
          body: {
            id: "leather",
            name: "Leather",
            armor: 1,
            qualities: [],
          },
          plug: {
            id: "shield",
            name: "Shield",
            armor: 0,
            qualities: ["never_registered_plug"],
          },
        },
      },
    }) as Character;

    const strict = createInMemoryRegistry({ qualities: { ...BASE_QUALITIES } });
    assert.throws(
      () => recalculate(char, strict),
      (err: Error) =>
        /Unknown armor quality 'never_registered_plug'/.test(err.message) &&
        /armor\.plug 'shield'/.test(err.message),
    );
  });
});

describe("quality registry: BASE_QUALITIES default fixture", () => {
  it("`own` resolves cleanly through the strict path on a default character", () => {
    // The default fixture seeds the own slot with a natural_weapon
    // carrying the `own` quality. Recalc with the bare emptyRegistry must
    // NOT throw — emptyRegistry pre-registers BASE_QUALITIES so the
    // own-slot anchor doesn't blow up. Any *other* quality on a fixture
    // weapon/armor would throw, which is the desired strict default.
    const char = makeTypedCharacter() as Character;
    assert.doesNotThrow(() => recalculate(char, emptyRegistry));
  });
});
