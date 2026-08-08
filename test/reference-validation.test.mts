// Unit tests for the strict catalog-membership pass
// (`src/models/reference-validation.mts`). Deliberately runs against the
// REAL reference catalogs (same posture as the reference-lint test): the
// catalogs are the sole source of truth the validator enforces, so the
// production data is the correct fixture. Ids used below are stable
// canonical entries (`natural_weapon`, `acrobatics`, `light_armor`, …).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateCatalogRefs } from "#models/reference-validation";

import type { ValidationError } from "#types";

function codes(errors: ValidationError[]): string[] {
  return errors.map((e) => e.code);
}

function catalogWeapon(overrides?: Record<string, unknown>) {
  return {
    id: "natural_weapon",
    name: "Natural Weapon",
    type: "natural",
    damage: 4,
    qualities: ["own", "short"],
    ...overrides,
  };
}

describe("validateCatalogRefs", () => {
  it("returns no errors for an empty character (absent arrays are the schema's problem)", async () => {
    const errors = await validateCatalogRefs({});
    assert.deepEqual(errors, []);
  });

  // ── weapons ─────────────────────────────────────────────────────

  it("accepts a catalog-resolving weapon entry", async () => {
    const errors = await validateCatalogRefs({
      equipment: { weapons: [catalogWeapon()] },
    });
    assert.deepEqual(errors, []);
  });

  it("rejects an unknown weapon id", async () => {
    const errors = await validateCatalogRefs({
      equipment: { weapons: [catalogWeapon({ id: "homebrew_blade" })] },
    });
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.code, "UNKNOWN_REFERENCE");
    assert.match(errors[0]!.error, /homebrew_blade/);
    assert.equal(errors[0]!.field, "equipment.weapons[0]");
  });

  it("rejects an unknown quality id on a weapon", async () => {
    const errors = await validateCatalogRefs({
      equipment: {
        weapons: [catalogWeapon({ qualities: ["own", "never_registered"] })],
      },
    });
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.code, "UNKNOWN_REFERENCE");
    assert.match(errors[0]!.error, /never_registered/);
  });

  it("rejects a structurally broken weapon entry (missing damage)", async () => {
    const errors = await validateCatalogRefs({
      equipment: { weapons: [catalogWeapon({ damage: "high" })] },
    });
    assert.ok(codes(errors).includes("VALIDATION"));
    assert.match(errors[0]!.error, /numeric damage/);
  });

  // ── armor ───────────────────────────────────────────────────────

  it("accepts null armor slots and a catalog-resolving body piece", async () => {
    const errors = await validateCatalogRefs({
      equipment: {
        armor: {
          body: {
            id: "light_armor",
            name: "Light Armor",
            armor: 4,
            qualities: ["hampering_2"],
          },
          plug: null,
        },
      },
    });
    assert.deepEqual(errors, []);
  });

  it("rejects an unknown armor id", async () => {
    const errors = await validateCatalogRefs({
      equipment: {
        armor: {
          body: { id: "cardboard_box", name: "Box", armor: 1, qualities: [] },
          plug: null,
        },
      },
    });
    assert.ok(
      errors.some(
        (e) =>
          e.code === "UNKNOWN_REFERENCE" && /cardboard_box/.test(e.error),
      ),
    );
  });

  it("rejects a body piece equipped in the plug slot", async () => {
    const errors = await validateCatalogRefs({
      equipment: {
        armor: {
          body: null,
          plug: {
            id: "light_armor",
            name: "Light Armor",
            armor: 4,
            qualities: ["hampering_2"],
          },
        },
      },
    });
    assert.ok(
      errors.some(
        (e) => e.code === "VALIDATION" && /body piece/.test(e.error),
      ),
      "catalog slot must match the equipped position",
    );
  });

  // ── traits ──────────────────────────────────────────────────────

  it("accepts a resolving trait with a valid tier and source", async () => {
    const errors = await validateCatalogRefs({
      traits: [{ id: "acrobatics", tier: "novice", source: "ability" }],
    });
    assert.deepEqual(errors, []);
  });

  it("rejects an unknown trait id", async () => {
    const errors = await validateCatalogRefs({
      traits: [{ id: "no-such-trait", tier: "novice", source: "ability" }],
    });
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.code, "UNKNOWN_REFERENCE");
    assert.equal(errors[0]!.field, "traits[0]");
  });

  it("rejects an invalid tier", async () => {
    const errors = await validateCatalogRefs({
      traits: [{ id: "acrobatics", tier: "legendary", source: "ability" }],
    });
    assert.ok(
      errors.some((e) => e.code === "VALIDATION" && /tier/.test(e.error)),
    );
  });

  it("rejects a source that contradicts the catalog", async () => {
    // break-will is a spell; claiming it as an ability is an authoring bug.
    const errors = await validateCatalogRefs({
      traits: [{ id: "break-will", tier: "novice", source: "ability" }],
    });
    assert.ok(
      errors.some(
        (e) => e.code === "VALIDATION" && /catalog says "spell"/.test(e.error),
      ),
    );
  });

  // ── talents ─────────────────────────────────────────────────────

  it("accepts a resolving talent within its level bounds", async () => {
    const errors = await validateCatalogRefs({
      talents: [{ id: "blood-bond", level: 1, source: "boon" }],
    });
    assert.deepEqual(errors, []);
  });

  it("rejects a talent level above the catalog maximum", async () => {
    // blood-bond has levels: 1.
    const errors = await validateCatalogRefs({
      talents: [{ id: "blood-bond", level: 2, source: "boon" }],
    });
    assert.ok(
      errors.some(
        (e) => e.code === "VALIDATION" && /catalog maximum/.test(e.error),
      ),
    );
  });

  it("rejects an unknown talent id", async () => {
    const errors = await validateCatalogRefs({
      talents: [{ id: "no-such-talent", level: 1, source: "boon" }],
    });
    assert.equal(errors[0]!.code, "UNKNOWN_REFERENCE");
  });

  // ── rituals ─────────────────────────────────────────────────────

  it("accepts a resolving ritual and rejects an unknown one", async () => {
    const ok = await validateCatalogRefs({
      rituals: [{ id: "life-extension", level: 1 }],
    });
    assert.deepEqual(ok, []);

    const bad = await validateCatalogRefs({
      rituals: [{ id: "no-such-ritual", level: 1 }],
    });
    assert.equal(bad[0]!.code, "UNKNOWN_REFERENCE");
  });

  it("rejects a non-integer ritual level", async () => {
    const errors = await validateCatalogRefs({
      rituals: [{ id: "life-extension", level: 0 }],
    });
    assert.ok(
      errors.some((e) => e.code === "VALIDATION" && /level/.test(e.error)),
    );
  });

  // ── traditions ──────────────────────────────────────────────────

  it("accepts an ability id as a tradition and rejects a spell id", async () => {
    const ok = await validateCatalogRefs({ traditions: ["witchcraft"] });
    assert.deepEqual(ok, []);

    // Traditions are curated ability ids; a spell id must not resolve.
    const bad = await validateCatalogRefs({ traditions: ["break-will"] });
    assert.equal(bad[0]!.code, "UNKNOWN_REFERENCE");
    assert.equal(bad[0]!.field, "traditions[0]");
  });
});
