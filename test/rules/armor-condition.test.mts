import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyAddFlat,
  applyFlag,
  matchesArmorConditions,
} from "../../src/rules/applicator.mts";
import type {
  ArmorPiece,
  Character,
  ResolvedEffect,
} from "../../src/rpg-types.mts";
import { makeTypedCharacter } from "../helpers/fixtures.mts";

// ── ADR-015 §3f: character-level effect gating via `condition`.

function makeArmor(id: string, qualities: string[] = []): ArmorPiece {
  return {
    id,
    name: id,
    armor: 4,
    qualities,
    qualitiesEffective: [...qualities],
  };
}

function withArmor(
  body: ArmorPiece | null,
  plug: ArmorPiece | null,
): Character {
  const c = makeTypedCharacter();
  c.equipment.armor = { body, plug };
  return c;
}

// ── matchesArmorConditions ─────────────────────────────────────────

describe("matchesArmorConditions (character-level)", () => {
  it("undefined / [] always matches", () => {
    const c = withArmor(null, null);
    assert.equal(matchesArmorConditions(c, undefined), true);
    assert.equal(matchesArmorConditions(c, []), true);
  });

  it("noArmor passes only when both slots are empty", () => {
    assert.equal(
      matchesArmorConditions(withArmor(null, null), [{ kind: "noArmor" }]),
      true,
    );
    assert.equal(
      matchesArmorConditions(withArmor(makeArmor("leather"), null), [
        { kind: "noArmor" },
      ]),
      false,
    );
  });

  it("armorSlot character-level: any listed slot is non-empty", () => {
    const c = withArmor(null, makeArmor("plate"));
    assert.equal(
      matchesArmorConditions(c, [{ kind: "armorSlot", values: ["plug"] }]),
      true,
    );
    assert.equal(
      matchesArmorConditions(c, [{ kind: "armorSlot", values: ["body"] }]),
      false,
    );
  });

  it("armorQuality reads through qualitiesEffective with values OR-composed", () => {
    const c = withArmor(makeArmor("leather", ["oiled"]), null);
    assert.equal(
      matchesArmorConditions(c, [{ kind: "armorQuality", values: ["oiled"] }]),
      true,
    );
    assert.equal(
      matchesArmorConditions(c, [
        { kind: "armorQuality", values: ["frosted", "oiled"] },
      ]),
      true,
    );
    assert.equal(
      matchesArmorConditions(c, [
        { kind: "armorQuality", values: ["frosted"] },
      ]),
      false,
    );
  });

  it("multiple conditions AND-compose", () => {
    const c = withArmor(makeArmor("leather", ["oiled"]), null);
    // body slot + oiled — both true.
    assert.equal(
      matchesArmorConditions(c, [
        { kind: "armorSlot", values: ["body"] },
        { kind: "armorQuality", values: ["oiled"] },
      ]),
      true,
    );
    // body slot + frosted — second fails.
    assert.equal(
      matchesArmorConditions(c, [
        { kind: "armorSlot", values: ["body"] },
        { kind: "armorQuality", values: ["frosted"] },
      ]),
      false,
    );
  });

  it("armorId matches by piece id", () => {
    const c = withArmor(makeArmor("plate"), null);
    assert.equal(
      matchesArmorConditions(c, [
        { kind: "armorId", values: ["plate", "chain"] },
      ]),
      true,
    );
    assert.equal(
      matchesArmorConditions(c, [{ kind: "armorId", values: ["chain"] }]),
      false,
    );
  });
});

// ── matchesArmorConditions (per-piece) ─────────────────────────────

describe("matchesArmorConditions (per-piece, slot arg)", () => {
  it("noArmor is always false per-piece (a piece exists)", () => {
    const c = withArmor(makeArmor("leather"), null);
    assert.equal(
      matchesArmorConditions(c, [{ kind: "noArmor" }], "body"),
      false,
    );
  });

  it("armorSlot per-piece: matches if the slot is in values", () => {
    const c = withArmor(makeArmor("leather"), makeArmor("plate"));
    assert.equal(
      matchesArmorConditions(
        c,
        [{ kind: "armorSlot", values: ["plug"] }],
        "plug",
      ),
      true,
    );
    assert.equal(
      matchesArmorConditions(
        c,
        [{ kind: "armorSlot", values: ["plug"] }],
        "body",
      ),
      false,
    );
  });

  it("armorQuality per-piece: reads only that piece's qualitiesEffective", () => {
    const c = withArmor(
      makeArmor("leather", ["oiled"]),
      makeArmor("plate", ["frosted"]),
    );
    assert.equal(
      matchesArmorConditions(
        c,
        [{ kind: "armorQuality", values: ["oiled"] }],
        "body",
      ),
      true,
    );
    assert.equal(
      matchesArmorConditions(
        c,
        [{ kind: "armorQuality", values: ["oiled"] }],
        "plug",
      ),
      false,
    );
  });
});

// ── Combat Oils: secondary.armor +N gated on armorQuality:oiled ────

describe("secondary effects gated by condition (Combat Oils pattern)", () => {
  function combatOils(): ResolvedEffect {
    return {
      source: "combat-oils",
      target: { kind: "secondary", stat: "armor" },
      modifier: { type: "addFlat", value: 4 },
      condition: [{ kind: "armorQuality", values: ["oiled"] }],
    };
  }

  it("fires when an equipped piece carries the gating quality", () => {
    const c = withArmor(makeArmor("leather", ["oiled"]), null);
    c.attributes.secondary.armor = 0;
    applyAddFlat(c, [combatOils()]);
    assert.equal(c.attributes.secondary.armor, 4);
  });

  it("does NOT fire when no equipped piece carries the gating quality", () => {
    const c = withArmor(makeArmor("leather", []), null);
    c.attributes.secondary.armor = 0;
    applyAddFlat(c, [combatOils()]);
    assert.equal(c.attributes.secondary.armor, 0);
  });

  it("does NOT fire when no armor is equipped at all", () => {
    const c = withArmor(null, null);
    c.attributes.secondary.armor = 0;
    applyAddFlat(c, [combatOils()]);
    assert.equal(c.attributes.secondary.armor, 0);
  });

  it("noArmor condition fires only when both slots are empty", () => {
    const eff: ResolvedEffect = {
      source: "robe-mastery",
      target: { kind: "secondary", stat: "defense" },
      modifier: { type: "addFlat", value: 2 },
      condition: [{ kind: "noArmor" }],
    };
    const empty = withArmor(null, null);
    empty.attributes.secondary.defense = 10;
    applyAddFlat(empty, [eff]);
    assert.equal(empty.attributes.secondary.defense, 12);

    const armored = withArmor(makeArmor("plate"), null);
    armored.attributes.secondary.defense = 10;
    applyAddFlat(armored, [eff]);
    assert.equal(armored.attributes.secondary.defense, 10);
  });
});

// ── armorQuality target gated per-piece (Soldier Adept pattern) ────

describe("armorQuality effects gated per-piece by condition", () => {
  it("Soldier Adept: removes hampering_2 only from pieces that carry it", () => {
    const c = withArmor(
      makeArmor("plate", ["hampering_2"]),
      makeArmor("plug", ["hampering_3"]),
    );
    const eff: ResolvedEffect = {
      source: "soldier-adept",
      target: { kind: "armorQuality", quality: "hampering_2" },
      modifier: { type: "remove" },
      condition: [{ kind: "armorQuality", values: ["hampering_2"] }],
    };
    applyFlag(c, [eff]);
    // body had hampering_2 → removed from its qualitiesEffective.
    assert.deepEqual(c.equipment.armor.body!.qualitiesEffective, []);
    // plug didn't have hampering_2 → unchanged.
    assert.deepEqual(c.equipment.armor.plug!.qualitiesEffective, [
      "hampering_3",
    ]);
    // Authored qualities never mutated.
    assert.deepEqual(c.equipment.armor.body!.qualities, ["hampering_2"]);
    assert.deepEqual(c.equipment.armor.plug!.qualities, ["hampering_3"]);
  });

  it("Demiurge Hands Master: armorSlot + armorQuality AND scopes to the plug only", () => {
    const c = withArmor(
      makeArmor("plate", ["hampering_2"]),
      makeArmor("plug", ["hampering_2"]),
    );
    const eff: ResolvedEffect = {
      source: "demiurge-hands-master",
      target: { kind: "armorQuality", quality: "hampering_2" },
      modifier: { type: "remove" },
      condition: [
        { kind: "armorSlot", values: ["plug"] },
        { kind: "armorQuality", values: ["hampering_2"] },
      ],
    };
    applyFlag(c, [eff]);
    assert.deepEqual(c.equipment.armor.body!.qualitiesEffective, [
      "hampering_2",
    ]);
    assert.deepEqual(c.equipment.armor.plug!.qualitiesEffective, []);
  });

  it("Demiurge Hands Novice: armorSlot:plug add only fires on plug", () => {
    const c = withArmor(makeArmor("plate"), makeArmor("plug"));
    const eff: ResolvedEffect = {
      source: "demiurge-hands-novice",
      target: { kind: "armorQuality", quality: "flexible" },
      modifier: { type: "addFlat", value: 1 },
      condition: [{ kind: "armorSlot", values: ["plug"] }],
    };
    applyFlag(c, [eff]);
    assert.deepEqual(c.equipment.armor.body!.qualitiesEffective, []);
    assert.deepEqual(c.equipment.armor.plug!.qualitiesEffective, ["flexible"]);
  });
});
