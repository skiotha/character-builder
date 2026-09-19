import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  armorSlotFromPath,
  catalogEntriesForSlot,
  projectCatalogArmor,
} from "../public/utils/armor.mjs";

const lightArmor = {
  id: "light_armor",
  name: "Light Armor",
  description: "Light armor.",
  slot: "body",
  armor: 4,
  cost: 25,
  qualities: ["hampering_2"],
  effects: [],
};
const plug = {
  id: "plug_test_fortified",
  name: "Test Plug (Fortified)",
  description: "Placeholder.",
  slot: "plug",
  armor: 0,
  cost: 10,
  qualities: ["hampering_2", "fortified"],
  effects: [],
};

describe("projectCatalogArmor", () => {
  it("keeps only the stored ArmorPiece fields", () => {
    assert.deepEqual(projectCatalogArmor(lightArmor), {
      id: "light_armor",
      name: "Light Armor",
      armor: 4,
      qualities: ["hampering_2"],
    });
  });

  it("drops empty effects but keeps authored ones (deep-copied)", () => {
    const effects = [{ target: { kind: "flag", value: "x" }, modifier: "addFlat", value: 1 }];
    const projected = projectCatalogArmor({ ...plug, effects });
    assert.deepEqual(projected.effects, effects);
    assert.notEqual(projected.effects, effects);
    assert.equal("effects" in projectCatalogArmor(plug), false);
  });

  it("defaults missing name/armor/qualities", () => {
    assert.deepEqual(projectCatalogArmor({ id: "bare" }), {
      id: "bare",
      name: "bare",
      armor: 0,
      qualities: [],
    });
  });

  it("does not alias the catalog qualities array", () => {
    const projected = projectCatalogArmor(plug);
    projected.qualities.push("extra");
    assert.deepEqual(plug.qualities, ["hampering_2", "fortified"]);
  });
});

describe("armorSlotFromPath", () => {
  it("returns the last dotted segment", () => {
    assert.equal(armorSlotFromPath("equipment.armor.body"), "body");
    assert.equal(armorSlotFromPath("equipment.armor.plug"), "plug");
  });

  it("tolerates a bare or missing path", () => {
    assert.equal(armorSlotFromPath("body"), "body");
    assert.equal(armorSlotFromPath(undefined), "");
  });
});

describe("catalogEntriesForSlot", () => {
  const catalog = [lightArmor, plug, { id: "no-slot" }];

  it("filters by slot and preserves catalog order", () => {
    assert.deepEqual(
      catalogEntriesForSlot([plug, lightArmor], "body").map((e) => e.id),
      ["light_armor"],
    );
    assert.deepEqual(
      catalogEntriesForSlot(catalog, "plug").map((e) => e.id),
      ["plug_test_fortified"],
    );
  });

  it("returns an empty array for a missing catalog or unknown slot", () => {
    assert.deepEqual(catalogEntriesForSlot(null, "body"), []);
    assert.deepEqual(catalogEntriesForSlot(catalog, "head"), []);
  });
});
