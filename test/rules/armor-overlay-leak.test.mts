import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { recalculate } from "../../src/rules/derived.mts";
import type { ArmorPiece, Character, RawEffect } from "../../src/rpg-types.mts";
import {
  BASE_QUALITIES,
  createInMemoryRegistry,
} from "../helpers/registry.mts";
import { makeTypedCharacter } from "../helpers/fixtures.mts";

// ── Bug #31 (armor overlay): `applyArmorQuality` previously mutated
//    `armor.body.qualities` / `armor.plug.qualities` in-place, so
//    add/remove operations compounded across recalcs and registry
//    quality effects bled across pieces. The engine now writes overlays
//    to `qualitiesEffective` (reset-from-`qualities` at the top of
//    every recalc) and registry-synthesized `armorQuality` effects
//    carry an implicit `armorSlot` condition scoping them to the
//    carrying piece.

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

describe("Bug #31 — armor overlay reset", () => {
  it("authored `qualities` is never mutated by repeated recalcs", () => {
    const c = withArmor(makeArmor("plate", ["hampering_2"]), null);
    c.effects = [
      {
        source: "test-add",
        target: { kind: "armorQuality", quality: "polished" },
        modifier: { type: "addFlat", value: 1 },
      } as unknown as RawEffect,
    ];
    const registry = createInMemoryRegistry({
      qualities: {
        ...BASE_QUALITIES,
        hampering_2: { id: "hampering_2", effects: [] },
      },
    });

    const r1 = recalculate(c, registry);
    const r2 = recalculate(r1, registry);

    // Authored qualities never grew the overlay quality.
    assert.deepEqual(r1.equipment.armor.body!.qualities, ["hampering_2"]);
    assert.deepEqual(r2.equipment.armor.body!.qualities, ["hampering_2"]);
    // qualitiesEffective contains polished exactly once after each pass.
    assert.deepEqual([...r1.equipment.armor.body!.qualitiesEffective!].sort(), [
      "hampering_2",
      "polished",
    ]);
    assert.deepEqual([...r2.equipment.armor.body!.qualitiesEffective!].sort(), [
      "hampering_2",
      "polished",
    ]);
  });

  it("removing the effect drops it from the next recalc's overlay (the actual leak)", () => {
    const c = withArmor(makeArmor("plate", ["hampering_2"]), null);
    c.effects = [
      {
        source: "soldier-adept",
        target: { kind: "armorQuality", quality: "hampering_2" },
        modifier: { type: "remove" },
        condition: [{ kind: "armorQuality", values: ["hampering_2"] }],
      } as unknown as RawEffect,
    ];
    const registry = createInMemoryRegistry({
      qualities: {
        ...BASE_QUALITIES,
        hampering_2: { id: "hampering_2", effects: [] },
      },
    });

    const removed = recalculate(c, registry);
    assert.deepEqual(removed.equipment.armor.body!.qualitiesEffective, []);

    // Drop the effect; recalc should restore qualitiesEffective from
    // authored qualities (no leftover absence).
    removed.effects = [];
    const restored = recalculate(removed, registry);
    assert.deepEqual(restored.equipment.armor.body!.qualitiesEffective, [
      "hampering_2",
    ]);
  });

  it("registry synthesis: body-piece quality effect doesn't bleed onto the plug", () => {
    // Flexible-style quality: removes hampering_N. Lives on the body
    // piece. Without slot-condition synthesis it would also clear the
    // plug's hampering_N. With synthesis it doesn't.
    const c = withArmor(
      makeArmor("plate", ["flexible", "hampering_2"]),
      makeArmor("plug", ["hampering_2"]),
    );
    const registry = createInMemoryRegistry({
      qualities: {
        ...BASE_QUALITIES,
        flexible: {
          id: "flexible",
          effects: [
            {
              source: "flexible",
              target: { kind: "armorQuality", quality: "hampering_2" },
              modifier: { type: "remove" },
            },
          ],
        },
        hampering_2: { id: "hampering_2", effects: [] },
      },
    });

    const r = recalculate(c, registry);

    // Body lost hampering_2 (its own flexible removed it).
    assert.equal(
      r.equipment.armor.body!.qualitiesEffective!.includes("hampering_2"),
      false,
    );
    // Plug still has hampering_2 (no cross-slot bleed).
    assert.deepEqual(r.equipment.armor.plug!.qualitiesEffective, [
      "hampering_2",
    ]);
  });
});
