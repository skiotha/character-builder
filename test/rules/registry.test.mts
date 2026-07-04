import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { loadRegistry } from "../../src/rules/registry.mts";
import {
  deserializeAction,
  deserializeEffect,
} from "../../src/rules/effects.mts";

// ── loadRegistry over the real reference catalog ───────────────────
//
// Doubles as a fail-fast smoke test: if any authored ability / spell /
// boon / sin effect or action is malformed, `loadRegistry` throws here
// (naming the entry), so this suite going green means the production
// startup load (src/app.mts) is clean too.

describe("loadRegistry (real reference data)", () => {
  it("loads without throwing and exposes non-empty lookups", async () => {
    const registry = await loadRegistry();
    // Slot-2 anchor quality is registered (NB-39).
    assert.ok(registry.lookupQuality("own"));
    // A known trait and talent resolve.
    assert.ok(registry.lookupTrait("smoke-and-mirrors", "master"));
    assert.ok(registry.lookupTalent("cartographer", 1));
    // An unknown id resolves to null (warn-and-skip in collectAllEffects).
    assert.equal(registry.lookupTrait("does-not-exist", "novice"), null);
    assert.equal(registry.lookupTalent("does-not-exist", 1), null);
  });

  it("stacks tiers additively (novice ⊆ adept ⊆ master)", async () => {
    const registry = await loadRegistry();
    const novice = registry.lookupTrait("smoke-and-mirrors", "novice")!;
    const adept = registry.lookupTrait("smoke-and-mirrors", "adept")!;
    const master = registry.lookupTrait("smoke-and-mirrors", "master")!;

    assert.ok(novice.effects.length >= 1);
    // Adept introduces the Discreet-for-Defense effect on top of novice.
    assert.ok(adept.effects.length > novice.effects.length);
    assert.deepEqual(
      adept.effects.slice(0, novice.effects.length),
      novice.effects,
    );
    // Master's only own effect is Tier-C narrative (skipped), so its
    // effect set equals adept's — but it introduces the Feint special
    // attack.
    assert.equal(master.effects.length, adept.effects.length);
    assert.deepEqual(
      master.effects.slice(0, adept.effects.length),
      adept.effects,
    );
    assert.equal(novice.specialAttacks.length, 0);
    assert.ok(master.specialAttacks.length >= 1);
  });

  it("resolves secondary + setBase through the loader (NB-44)", async () => {
    const registry = await loadRegistry();
    const adept = registry.lookupTrait("smoke-and-mirrors", "adept")!;
    const hit = adept.effects.find(
      (e) =>
        e.target.kind === "secondary" &&
        e.target.stat === "defense" &&
        e.modifier.type === "setBase" &&
        e.modifier.value === "discreet",
    );
    assert.ok(
      hit,
      "smoke-and-mirrors adept should carry secondary.defense setBase discreet",
    );
  });

  it("carries special attacks verbatim in tier order", async () => {
    const registry = await loadRegistry();
    const master = registry.lookupTrait("smoke-and-mirrors", "master")!;
    const feint = master.specialAttacks.find(
      (a) => a.id === "smoke-and-mirrors-feint",
    );
    assert.ok(feint);
    assert.equal(feint.trigger, "manual");
    assert.equal(feint.isFree, true);
    assert.ok(feint.appliesTo && feint.appliesTo.length > 0);
  });
});

// ── deserializeEffect (fail-fast catalog boundary) ─────────────────

describe("deserializeEffect", () => {
  it("skips a narrative entry (neither target nor modifier)", () => {
    assert.equal(deserializeEffect({ description: "flavor" }, "x"), null);
  });

  it("throws on target without modifier", () => {
    assert.throws(
      () =>
        deserializeEffect(
          { target: { kind: "secondary", stat: "defense" } },
          "x",
        ),
      /target without modifier/,
    );
  });

  it("throws on modifier without target", () => {
    assert.throws(
      () => deserializeEffect({ modifier: { type: "addFlat", value: 1 } }, "x"),
      /modifier without target/,
    );
  });

  it("accepts secondary + setBase (NB-44 is not a rejection)", () => {
    const eff = deserializeEffect(
      {
        target: { kind: "secondary", stat: "defense" },
        modifier: { type: "setBase", value: "discreet" },
      },
      "x",
    );
    assert.ok(eff);
    assert.equal(eff.target.kind, "secondary");
    assert.equal(eff.modifier.type, "setBase");
  });

  it("throws on an unparseable target", () => {
    assert.throws(
      () =>
        deserializeEffect(
          {
            target: { kind: "bogus" },
            modifier: { type: "addFlat", value: 1 },
          },
          "x",
        ),
      /Unparseable effect/,
    );
  });
});

// ── deserializeAction (verbatim carry + fail-fast) ────────────────

describe("deserializeAction", () => {
  const statuses = new Set(["bleeding"]);

  it("round-trips declarative fields verbatim", () => {
    const action = deserializeAction(
      {
        id: "a",
        name: "A",
        trigger: "manual",
        damage: 3,
        ignoresArmor: true,
        appliesTo: [{ kind: "type", values: ["short"] }],
        damageBonus: 2,
        isFree: true,
        inflicts: ["bleeding"],
      },
      "x",
      statuses,
    );
    assert.equal(action.damage, 3);
    assert.equal(action.ignoresArmor, true);
    assert.equal(action.damageBonus, 2);
    assert.equal(action.isFree, true);
    assert.deepEqual(action.inflicts, ["bleeding"]);
    assert.ok(action.appliesTo && action.appliesTo.length === 1);
  });

  it("throws on a missing id", () => {
    assert.throws(
      () => deserializeAction({ name: "A", trigger: "manual" }, "x", statuses),
      /missing a required string 'id'/,
    );
  });

  it("throws on an unknown trigger", () => {
    assert.throws(
      () =>
        deserializeAction(
          { id: "a", name: "A", trigger: "whenever" },
          "x",
          statuses,
        ),
      /unknown trigger/,
    );
  });

  it("throws when isFree is set on a non-manual trigger", () => {
    assert.throws(
      () =>
        deserializeAction(
          { id: "a", name: "A", trigger: "onAttacked", isFree: true },
          "x",
          statuses,
        ),
      /'isFree' is only valid on/,
    );
  });

  it("throws when damageBonus has no appliesTo", () => {
    assert.throws(
      () =>
        deserializeAction(
          { id: "a", name: "A", trigger: "manual", damageBonus: 2 },
          "x",
          statuses,
        ),
      /'damageBonus' requires a/,
    );
  });

  it("throws when inflicts references an unknown status", () => {
    assert.throws(
      () =>
        deserializeAction(
          { id: "a", name: "A", trigger: "manual", inflicts: ["nope"] },
          "x",
          statuses,
        ),
      /unknown status/,
    );
  });
});
