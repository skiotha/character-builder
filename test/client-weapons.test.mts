import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  availableCatalogEntries,
  projectCatalogWeapon,
  remapCarriedAfterRemove,
  stripCarried,
} from "../public/utils/weapons.mjs";

const natural = {
  id: "natural_weapon",
  name: "Natural Weapon",
  type: "natural",
  damage: 4,
  qualities: ["own", "short"],
};
const sword = {
  id: "two_handed_sword",
  name: "Two-Handed Sword",
  type: "heavy",
  damage: 10,
  qualities: ["precise", "versatile"],
};
const claws = {
  id: "war_claws",
  name: "War Claws",
  type: "natural",
  damage: 4,
  qualities: ["own", "short", "deep_wounds"],
};

// ── projectCatalogWeapon ─────────────────────────────────────────

describe("projectCatalogWeapon", () => {
  it("keeps the engine keys and drops presentation fields", () => {
    const projected = projectCatalogWeapon({
      ...sword,
      description: "long text",
      cost: 50,
      effects: [],
    });
    assert.deepEqual(projected, sword);
    assert.equal("description" in projected, false);
    assert.equal("cost" in projected, false);
    assert.equal("effects" in projected, false);
  });

  it("carries effects only when authored non-empty, as a copy", () => {
    const effects = [{ id: "x", target: { kind: "flag", flag: "f" } }];
    const projected = projectCatalogWeapon({ ...sword, effects });
    assert.deepEqual(projected.effects, effects);
    assert.notEqual(projected.effects, effects);
  });

  it("copies qualities rather than aliasing the catalog array", () => {
    const projected = projectCatalogWeapon(sword);
    assert.notEqual(projected.qualities, sword.qualities);
  });

  it("falls back to id / empty type / zero damage on malformed entries", () => {
    assert.deepEqual(projectCatalogWeapon({ id: "odd" }), {
      id: "odd",
      name: "odd",
      type: "",
      damage: 0,
      qualities: [],
    });
  });
});

// ── stripCarried ─────────────────────────────────────────────────

describe("stripCarried", () => {
  it("keeps only weaponIndex and pads to three entries", () => {
    const carried = [
      { weaponIndex: 1, attackAttribute: "strength", baseDamage: 10 },
      null,
      { weaponIndex: 0, qualities: ["own"] },
    ];
    assert.deepEqual(stripCarried(carried), [
      { weaponIndex: 1 },
      null,
      { weaponIndex: 0 },
    ]);
    assert.deepEqual(stripCarried(undefined), [null, null, null]);
    assert.deepEqual(stripCarried([{ weaponIndex: 0 }]), [
      { weaponIndex: 0 },
      null,
      null,
    ]);
  });

  it("treats a slot without an integer weaponIndex as empty", () => {
    assert.deepEqual(stripCarried([{ weaponIndex: "1" }, {}, null]), [
      null,
      null,
      null,
    ]);
  });
});

// ── remapCarriedAfterRemove ──────────────────────────────────────

describe("remapCarriedAfterRemove", () => {
  it("nulls a hand slot that pointed at the removed weapon", () => {
    const carried = [{ weaponIndex: 1 }, null, { weaponIndex: 0 }];
    assert.deepEqual(remapCarriedAfterRemove(carried, 1, [natural]), [
      null,
      null,
      { weaponIndex: 0 },
    ]);
  });

  it("shifts indices above the removed one down", () => {
    // weapons: [natural, sword, claws]; remove sword; own = claws (2 → 1)
    const carried = [null, { weaponIndex: 2 }, { weaponIndex: 2 }];
    assert.deepEqual(remapCarriedAfterRemove(carried, 1, [natural, claws]), [
      null,
      { weaponIndex: 1 },
      { weaponIndex: 1 },
    ]);
  });

  it("re-points the own slot at natural_weapon when its weapon is removed", () => {
    // weapons: [natural, sword, claws]; own = claws; remove claws
    const carried = [{ weaponIndex: 1 }, null, { weaponIndex: 2 }];
    assert.deepEqual(remapCarriedAfterRemove(carried, 2, [natural, sword]), [
      { weaponIndex: 1 },
      null,
      { weaponIndex: 0 },
    ]);
  });

  it("finds natural_weapon at a non-zero index", () => {
    // weapons: [claws, natural]; own = claws; remove claws
    const carried = [null, null, { weaponIndex: 0 }];
    assert.deepEqual(remapCarriedAfterRemove(carried, 0, [natural]), [
      null,
      null,
      { weaponIndex: 0 },
    ]);
    const carried2 = [null, null, { weaponIndex: 0 }];
    assert.deepEqual(remapCarriedAfterRemove(carried2, 0, [sword, natural]), [
      null,
      null,
      { weaponIndex: 1 },
    ]);
  });

  it("leaves indices below the removed one untouched", () => {
    const carried = [
      { weaponIndex: 0 },
      { weaponIndex: 1 },
      { weaponIndex: 0 },
    ];
    assert.deepEqual(remapCarriedAfterRemove(carried, 2, [natural, sword]), [
      { weaponIndex: 0 },
      { weaponIndex: 1 },
      { weaponIndex: 0 },
    ]);
  });

  it("strips derived per-slot fields from the result", () => {
    const carried = [
      { weaponIndex: 1, baseDamage: 10, attackAttribute: "strength" },
      null,
      { weaponIndex: 0, qualities: ["own"] },
    ];
    const result = remapCarriedAfterRemove(carried, 2, [natural, sword]);
    assert.deepEqual(result, [{ weaponIndex: 1 }, null, { weaponIndex: 0 }]);
  });
});

// ── availableCatalogEntries ──────────────────────────────────────

describe("availableCatalogEntries", () => {
  const catalog = [natural, sword, claws];

  it("omits entries already stored on the character", () => {
    assert.deepEqual(availableCatalogEntries(catalog, [natural, claws]), [
      sword,
    ]);
  });

  it("never offers natural_weapon (always stored) and preserves catalog order", () => {
    assert.deepEqual(availableCatalogEntries(catalog, [natural]), [
      sword,
      claws,
    ]);
  });

  it("tolerates a missing weapons array", () => {
    assert.deepEqual(availableCatalogEntries(catalog, undefined), catalog);
  });
});
