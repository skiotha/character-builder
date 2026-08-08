import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateCharacterCreation,
  validateCharacterUpdate,
  skipOnCreation,
} from "#models/validation";
import {
  validateFieldValue,
  checkRequiredFields,
  isFieldWritable,
  canAccessField,
  applyFieldUpdate,
  generateDefaultCharacter,
  validateCrossFieldRules,
  validateRPGRules,
} from "#models/schema-utils";

import { makeCharacter, makePrimaryAttributes } from "./helpers/fixtures.mts";

import type { ValidationError } from "#types";

// ── validateFieldValue ────────────────────────────────────────────

describe("validateFieldValue", () => {
  // ── Type mismatches ───────────────────────────────────────────

  it("rejects string for a number field", () => {
    const result = validateFieldValue("experience.total", "fifty");
    assert.equal(result.valid, false);
    assert.match(result.error!, /expected number/i);
  });

  it("rejects number for a string field", () => {
    const result = validateFieldValue("characterName", 42);
    assert.equal(result.valid, false);
    assert.match(result.error!, /expected string/i);
  });

  // ── Number boundaries ─────────────────────────────────────────

  it("rejects number below min", () => {
    // attributes.primary.accurate has min: 5
    const result = validateFieldValue("attributes.primary.accurate", 4);
    assert.equal(result.valid, false);
    assert.match(result.error!, /5/);
  });

  it("rejects number above max", () => {
    // attributes.primary.accurate has max: 15
    const result = validateFieldValue("attributes.primary.accurate", 16);
    assert.equal(result.valid, false);
    assert.match(result.error!, /15/);
  });

  it("accepts number at exact min boundary", () => {
    const result = validateFieldValue("attributes.primary.accurate", 5);
    assert.equal(result.valid, true);
  });

  it("accepts number at exact max boundary", () => {
    const result = validateFieldValue("attributes.primary.accurate", 15);
    assert.equal(result.valid, true);
  });

  it("rejects float where integer: true", () => {
    const result = validateFieldValue("attributes.primary.accurate", 10.5);
    assert.equal(result.valid, false);
    assert.match(result.error!, /integer/i);
  });

  // ── String boundaries ─────────────────────────────────────────

  it("rejects string below minLength", () => {
    // characterName has minLength: 3
    const result = validateFieldValue("characterName", "Ab");
    assert.equal(result.valid, false);
    assert.match(result.error!, /3/);
  });

  it("rejects string above maxLength", () => {
    // characterName has maxLength: 16
    const result = validateFieldValue("characterName", "A".repeat(17));
    assert.equal(result.valid, false);
    assert.match(result.error!, /16/);
  });

  it("accepts string at exact minLength", () => {
    const result = validateFieldValue("characterName", "Aba");
    assert.equal(result.valid, true);
  });

  it("accepts string at exact maxLength", () => {
    const result = validateFieldValue("characterName", "A".repeat(16));
    assert.equal(result.valid, true);
  });

  // ── Pattern ───────────────────────────────────────────────────

  it("rejects characterName with digits", () => {
    const result = validateFieldValue("characterName", "Test123");
    assert.equal(result.valid, false);
  });

  it("accepts characterName with hyphens, apostrophes, spaces", () => {
    const result = validateFieldValue("characterName", "El'ara Von-Dusk");
    assert.equal(result.valid, true);
  });

  // ── Unknown field ─────────────────────────────────────────────

  it("returns error for unknown field path", () => {
    const result = validateFieldValue("nonexistent.field", "value");
    assert.equal(result.valid, false);
    assert.match(result.error!, /unknown field/i);
  });

  // ── Custom validate function ──────────────────────────────────

  it("passes when the validate hook accepts (health within max)", () => {
    const result = validateFieldValue(
      "attributes.secondary.toughness.current",
      10,
      makeCharacter(),
    );
    assert.equal(result.valid, true);
  });

  it("fails when the validate hook rejects (health above max)", () => {
    const result = validateFieldValue(
      "attributes.secondary.toughness.current",
      11,
      makeCharacter(),
    );
    assert.equal(result.valid, false);
    assert.match(result.error!, /maximum health/i);
  });

  // ── Null handling ─────────────────────────────────────────────

  it("accepts null for nullable object fields (armor slots)", () => {
    const result = validateFieldValue("equipment.armor.body", null);
    assert.equal(result.valid, true);
  });

  it("rejects null for non-nullable object fields", () => {
    const result = validateFieldValue("equipment", null);
    assert.equal(result.valid, false);
    assert.match(result.error!, /null/i);
  });
});

// ── validateCharacterCreation ─────────────────────────────────────

describe("validateCharacterCreation", () => {
  function minimalCreationInput(
    overrides?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      characterName: "Testara",
      attributes: {
        primary: makePrimaryAttributes(),
        secondary: {
          toughness: { max: 10, current: 10 },
          defense: 10,
          armor: 0,
          painThreshold: 5,
          corruptionThreshold: 5,
          corruptionMax: 10,
        },
      },
      experience: { total: 50, unspent: 50 },
      corruption: { permanent: 0, temporary: 0 },
      background: { age: 30, race: "Human" },
      equipment: { money: 5 },
      ...overrides,
    };
  }

  // ── Server-controlled fields ────────────────────────────────

  it("warns and strips server-controlled fields from input", () => {
    const input = minimalCreationInput({ id: "injected-id", backupCode: "X" });
    const result = validateCharacterCreation(input, "p1", "Player One");
    assert.ok(result.warnings.length > 0, "should have warnings");
    const warnFields = result.warnings.map((w) => w.field);
    assert.ok(warnFields.includes("id"));
    assert.ok(warnFields.includes("backupCode"));
    if (result.validatedData) {
      assert.notEqual(result.validatedData.id, "injected-id");
    }
  });

  // ── Unknown field ─────────────────────────────────────────────

  it("returns UNKNOWN_FIELD error for unrecognized fields", () => {
    const input = minimalCreationInput({ madeUpField: "oops" });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const unkErr = result.errors.find((e) => e.code === "UNKNOWN_FIELD");
    assert.ok(unkErr, "should have UNKNOWN_FIELD error");
    assert.equal(unkErr!.field, "madeUpField");
  });

  // ── Permission-denied field ───────────────────────────────────

  it("returns PERMISSION_DENIED for non-settable fields", () => {
    // effects has perm_dm_write — owner has RO, so skipOnCreation returns false
    const input = minimalCreationInput({ effects: [] });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const permErr = result.errors.find((e) => e.code === "PERMISSION_DENIED");
    assert.ok(permErr, "should have PERMISSION_DENIED error");
    assert.equal(permErr!.field, "effects");
  });

  // ── Required fields ───────────────────────────────────────────

  it("returns REQUIRED errors when all required fields are missing", () => {
    const result = validateCharacterCreation({}, "p1", "Player One");
    assert.equal(result.success, false);
    const requiredErrors = result.errors.filter((e) => e.code === "REQUIRED");
    assert.ok(requiredErrors.length > 0, "should have REQUIRED errors");
  });

  // ── characterName boundaries ──────────────────────────────────

  it("accepts characterName at exactly 3 characters", () => {
    const input = minimalCreationInput({ characterName: "Aba" });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const nameErr = result.errors.find((e) => e.field === "characterName");
    assert.equal(nameErr, undefined, "should have no characterName error");
  });

  it("rejects characterName at 2 characters", () => {
    const input = minimalCreationInput({ characterName: "Ab" });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const nameErr = result.errors.find((e) => e.field === "characterName");
    assert.ok(nameErr, "should have characterName error");
  });

  it("accepts characterName at exactly 16 characters", () => {
    const input = minimalCreationInput({ characterName: "A".repeat(16) });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const nameErr = result.errors.find((e) => e.field === "characterName");
    assert.equal(nameErr, undefined, "should have no characterName error");
  });

  it("rejects characterName at 17 characters", () => {
    const input = minimalCreationInput({ characterName: "A".repeat(17) });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const nameErr = result.errors.find((e) => e.field === "characterName");
    assert.ok(nameErr, "should have characterName error");
  });

  it("rejects characterName with digits", () => {
    const input = minimalCreationInput({ characterName: "Test123" });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const nameErr = result.errors.find((e) => e.field === "characterName");
    assert.ok(nameErr, "should reject digits in name");
  });

  // ── Attribute budget ──────────────────────────────────────────

  // Budget errors surface from the `attributes` schema hook through the
  // cross-field pass (single home — validateRPGRules no longer reports
  // the budget).
  const findBudgetErr = (errors: ValidationError[]) =>
    errors.find(
      (e) => e.code === "CROSS_FIELD_VALIDATION" && e.field === "attributes",
    );

  it("accepts attributes totalling exactly 80", () => {
    const input = minimalCreationInput({
      attributes: { primary: makePrimaryAttributes() },
    });
    // Default makePrimaryAttributes: all 10 → total 80
    const result = validateCharacterCreation(input, "p1", "Player One");
    assert.equal(
      findBudgetErr(result.errors),
      undefined,
      "should not exceed budget at exactly 80",
    );
  });

  it("rejects attribute total of 81", () => {
    const attrs = makePrimaryAttributes({ accurate: 11 }); // 11+10*7 = 81
    const input = minimalCreationInput({ attributes: { primary: attrs } });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const budgetErr = findBudgetErr(result.errors);
    assert.ok(budgetErr, "should reject total > 80");
    assert.match(budgetErr!.error, /80/);
  });

  it("rejects attributes under budget (all defaults = 40)", () => {
    const attrs = makePrimaryAttributes({
      accurate: 5,
      cunning: 5,
      discreet: 5,
      appealing: 5,
      quick: 5,
      resolute: 5,
      vigilant: 5,
      strong: 5,
    });
    const input = minimalCreationInput({ attributes: { primary: attrs } });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const budgetErr = findBudgetErr(result.errors);
    assert.ok(budgetErr, "should reject total < 80");
    assert.match(budgetErr!.error, /80/);
  });

  it("accepts single attribute at 15 with others compensating to total 80", () => {
    // 15 + 65/7 ≈ not integer. Use: 15+10+10+10+10+10+10+5 = 80
    const attrs = makePrimaryAttributes({ accurate: 15, strong: 5 });
    const input = minimalCreationInput({ attributes: { primary: attrs } });
    const result = validateCharacterCreation(input, "p1", "Player One");
    assert.equal(
      findBudgetErr(result.errors),
      undefined,
      "should accept exactly 80 with max attr",
    );
  });

  // ── Secondary attributes are server-controlled ────────────────

  it("warns and ignores client-supplied secondary attribute values", () => {
    // minimalCreationInput seeds defense/painThreshold/… — all
    // server-controlled recalc output. They warn, never validate, and
    // never reach validatedData; recalc computes them before first save.
    const result = validateCharacterCreation(
      minimalCreationInput(),
      "p1",
      "Player One",
    );
    assert.equal(result.success, true);
    const warnFields = result.warnings.map((w) => w.field);
    assert.ok(warnFields.includes("attributes.secondary.defense"));
    assert.ok(warnFields.includes("attributes.secondary.toughness.max"));
    const attrs = result.validatedData!.attributes as {
      secondary?: { defense?: unknown; toughness?: { current?: unknown } };
    };
    assert.equal(attrs.secondary?.defense, undefined);
    // toughness.current is real state, not derived — it survives.
    assert.equal(attrs.secondary?.toughness?.current, 10);
  });

  // ── RPG rules ─────────────────────────────────────────────────

  it("rejects negative experience.unspent in merged data", () => {
    const input = minimalCreationInput({
      experience: { total: 50, unspent: -1 },
    });
    const result = validateCharacterCreation(input, "p1", "Player One");
    const xpErr = result.errors.find((e) => e.code === "BUSINESS_RULE");
    assert.ok(xpErr, "should reject negative unspent XP");
  });

  // ── Output shape on success ───────────────────────────────────

  it("output validatedData contains playerId, player, created, lastModified", () => {
    const input = minimalCreationInput();
    const result = validateCharacterCreation(input, "player-1", "Player One");
    assert.equal(result.success, true);
    assert.ok(result.validatedData);
    assert.equal(result.validatedData!.playerId, "player-1");
    assert.equal(result.validatedData!.player, "Player One");
    assert.ok(
      typeof result.validatedData!.created === "string",
      "created should be ISO string",
    );
    assert.ok(
      typeof result.validatedData!.lastModified === "string",
      "lastModified should be ISO string",
    );
  });

  // ── Output shape on failure ───────────────────────────────────

  it("validatedData is null when errors exist", () => {
    const result = validateCharacterCreation({}, "p1", "Player One");
    assert.equal(result.success, false);
    assert.equal(result.validatedData, null);
  });

  it("success is false when errors exist", () => {
    const input = minimalCreationInput({ characterName: "A" }); // too short
    const result = validateCharacterCreation(input, "p1", "Player One");
    assert.equal(result.success, false);
  });
});

// ── validateCharacterUpdate ───────────────────────────────────────

describe("validateCharacterUpdate", () => {
  const baseChar = makeCharacter();

  it("places a single valid update into validUpdates", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "characterName", value: "Newname" }],
      baseChar,
      "owner",
    );
    assert.equal(result.validUpdates.length, 1);
    assert.equal(result.errors.length, 0);
  });

  it("places a single invalid update into errors", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "characterName", value: "A" }], // too short
      baseChar,
      "owner",
    );
    assert.equal(result.validUpdates.length, 0);
    assert.equal(result.errors.length, 1);
  });

  it("separates mixed valid and invalid updates", async () => {
    const result = await validateCharacterUpdate(
      [
        { field: "characterName", value: "Newname" },
        { field: "characterName", value: "X" }, // too short
      ],
      baseChar,
      "owner",
    );
    assert.equal(result.validUpdates.length, 1);
    assert.equal(result.errors.length, 1);
  });

  it("rejects any field for public role as FORBIDDEN", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "characterName", value: "Newname" }],
      baseChar,
      "public",
    );
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]!.code, "FORBIDDEN");
  });

  it("rejects owner writing DM-only field as FORBIDDEN", async () => {
    // effects is perm_dm_write — owner has read-only
    const result = await validateCharacterUpdate(
      [{ field: "effects", value: [] }],
      baseChar,
      "owner",
    );
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]!.code, "FORBIDDEN");
  });

  it("allows dm role writing a writable field", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "characterName", value: "Newname" }],
      baseChar,
      "dm",
    );
    assert.equal(result.validUpdates.length, 1);
    assert.equal(result.errors.length, 0);
  });

  it("rejects server-controlled field as FORBIDDEN", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "id", value: "injected" }],
      baseChar,
      "dm",
    );
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]!.code, "FORBIDDEN");
  });

  it("rejects derived field as FORBIDDEN", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "combat.baseDamage", value: 99 }],
      baseChar,
      "dm",
    );
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]!.code, "FORBIDDEN");
  });

  it("rejects immutable field as FORBIDDEN", async () => {
    // playerId is both immutable and serverControlled
    const result = await validateCharacterUpdate(
      [{ field: "playerId", value: "injected" }],
      baseChar,
      "dm",
    );
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]!.code, "FORBIDDEN");
  });

  // NOTE: push of a single trait *object* (not an array) is rejected by
  // validateFieldValue — the schema types `traits` as an array, so the
  // object value is a type mismatch and the push is rejected before any
  // business-rule checks. (The legacy XP-cost check that once sat in this
  // path was removed; see NB-15.)

  it("push on traits rejects single object due to type:array mismatch", async () => {
    const char = makeCharacter({ experience: { total: 50, unspent: 50 } });
    const result = await validateCharacterUpdate(
      [
        {
          field: "traits",
          value: { name: "Iron Fist", cost: [10, 20, 30] },
          operation: "push",
        },
      ],
      char,
      "dm",
    );
    // Type validation rejects the object-vs-array mismatch.
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]!.code, "VALIDATION");
    assert.equal(result.validUpdates.length, 0);
  });

  it("push on traits passes per-field checks but fails the merged catalog pass", async () => {
    // Per-field validation only sees "array pushed onto an array field" —
    // the strict catalog-membership pass over the merged character is
    // what rejects the malformed entry (no id, not in the catalog).
    const char = makeCharacter({ experience: { total: 50, unspent: 0 } });
    const result = await validateCharacterUpdate(
      [
        {
          field: "traits",
          value: [{ name: "Iron Fist", cost: [10, 20, 30] }],
          operation: "push",
        },
      ],
      char,
      "dm",
    );
    assert.equal(result.validUpdates.length, 1, "per-field check passes");
    assert.ok(
      result.errors.some((e) => e.field.startsWith("traits[")),
      "merged catalog pass rejects the malformed entry",
    );
  });

  // ── Merged-state pass: budget, catalog refs, null parents ──────

  it("rejects a primary-attribute PATCH that breaks the 80 budget", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "attributes.primary.strong", value: 11 }],
      makeCharacter(),
      "dm",
    );
    const budgetErr = result.errors.find(
      (e) => e.code === "CROSS_FIELD_VALIDATION" && e.field === "attributes",
    );
    assert.ok(budgetErr, "merged pass should re-check the budget");
    assert.match(budgetErr!.error, /81/);
  });

  it("accepts a rebalancing PATCH that keeps the budget at exactly 80", async () => {
    const result = await validateCharacterUpdate(
      [
        { field: "attributes.primary.strong", value: 11 },
        { field: "attributes.primary.quick", value: 9 },
      ],
      makeCharacter(),
      "dm",
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.validUpdates.length, 2);
  });

  it("rejects a weapons PATCH carrying an unknown quality id (pre-recalc)", async () => {
    // Regression: this used to sail through validation and blow up as an
    // ADR-016 `[quality-registry]` throw inside recalc. The catalog pass
    // now rejects it with a designed error before anything is applied.
    const result = await validateCharacterUpdate(
      [
        {
          field: "equipment.weapons",
          value: [
            {
              id: "natural_weapon",
              name: "natural_weapon",
              type: "natural",
              damage: 0,
              qualities: ["own", "never_registered"],
            },
          ],
        },
      ],
      makeCharacter(),
      "owner",
    );
    const qualityErr = result.errors.find(
      (e) => e.code === "UNKNOWN_REFERENCE",
    );
    assert.ok(qualityErr, "unknown quality id should be rejected");
    assert.match(qualityErr!.error, /never_registered/);
  });

  it("rejects nulling an object-typed parent (equipment)", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "equipment", value: null }],
      makeCharacter(),
      "owner",
    );
    assert.ok(
      result.errors.some(
        (e) => e.field === "equipment" && e.code === "VALIDATION",
      ),
      "null on a non-nullable object parent is rejected",
    );
  });

  it("accepts clearing an armor slot to null via PATCH", async () => {
    const result = await validateCharacterUpdate(
      [{ field: "equipment.armor.body", value: null }],
      makeCharacter(),
      "owner",
    );
    assert.equal(result.errors.length, 0);
    assert.equal(result.validUpdates.length, 1);
  });
});

// ── skipOnCreation ────────────────────────────────────────────────

describe("skipOnCreation", () => {
  it("returns false for server-controlled field", () => {
    assert.equal(skipOnCreation("id", "owner"), false);
  });

  it("returns true for owner + creation-override field (experience.total)", () => {
    assert.equal(skipOnCreation("experience.total", "owner"), true);
  });

  it("returns true for owner + primary attribute path", () => {
    assert.equal(skipOnCreation("attributes.primary.accurate", "owner"), true);
  });

  it("returns false for owner + secondary attribute path (server-controlled)", () => {
    // Secondary attributes are recalc output — no creation override.
    assert.equal(
      skipOnCreation("attributes.secondary.defense", "owner"),
      false,
    );
  });

  it("returns false for unknown field", () => {
    assert.equal(skipOnCreation("nonexistent.field", "owner"), false);
  });

  it("returns true for non-override writable field (falls through to canAccessField)", () => {
    // characterName is not in creationOverrides but is writable by owner
    assert.equal(skipOnCreation("characterName", "owner"), true);
  });
});

// ── checkRequiredFields ───────────────────────────────────────────

describe("checkRequiredFields", () => {
  const requiredPaths = ["characterName", "attributes"];
  const serverControlled = ["id"];

  it("adds REQUIRED error for missing required field", () => {
    const errors: ValidationError[] = [];
    checkRequiredFields({}, errors, requiredPaths, serverControlled);
    const nameErr = errors.find((e) => e.field === "characterName");
    assert.ok(nameErr);
    assert.equal(nameErr!.code, "REQUIRED");
  });

  it("skips server-controlled required field", () => {
    const errors: ValidationError[] = [];
    checkRequiredFields({}, errors, ["id"], serverControlled);
    assert.equal(errors.length, 0);
  });

  it("treats empty string as missing", () => {
    const errors: ValidationError[] = [];
    checkRequiredFields(
      { characterName: "" },
      errors,
      requiredPaths,
      serverControlled,
    );
    const nameErr = errors.find((e) => e.field === "characterName");
    assert.ok(nameErr);
  });

  it("treats empty array as missing", () => {
    const errors: ValidationError[] = [];
    checkRequiredFields(
      { characterName: [] },
      errors,
      requiredPaths,
      serverControlled,
    );
    const nameErr = errors.find((e) => e.field === "characterName");
    assert.ok(nameErr);
  });

  it("treats null as missing", () => {
    const errors: ValidationError[] = [];
    checkRequiredFields(
      { characterName: null },
      errors,
      requiredPaths,
      serverControlled,
    );
    const nameErr = errors.find((e) => e.field === "characterName");
    assert.ok(nameErr);
  });

  it("treats undefined as missing", () => {
    const errors: ValidationError[] = [];
    checkRequiredFields(
      { characterName: undefined },
      errors,
      requiredPaths,
      serverControlled,
    );
    const nameErr = errors.find((e) => e.field === "characterName");
    assert.ok(nameErr);
  });
});

// ── isFieldWritable ───────────────────────────────────────────────

describe("isFieldWritable", () => {
  it("returns false for serverControlled field regardless of role", () => {
    assert.equal(isFieldWritable("id", "owner"), false);
    assert.equal(isFieldWritable("id", "dm"), false);
    assert.equal(isFieldWritable("id", "public"), false);
  });

  it("returns false for generated field", () => {
    // player is generated: true
    assert.equal(isFieldWritable("player", "owner"), false);
  });

  it("returns false for immutable field", () => {
    assert.equal(isFieldWritable("playerId", "owner"), false);
  });

  it("returns false for derived field", () => {
    assert.equal(
      isFieldWritable("attributes.secondary.defense", "owner"),
      false,
    );
  });

  it("returns true for regular writable field + owner", () => {
    assert.equal(isFieldWritable("characterName", "owner"), true);
  });

  it("returns false for regular field + public", () => {
    // characterName: perm_default → public has read-only
    assert.equal(isFieldWritable("characterName", "public"), false);
  });
});

// ── canAccessField ────────────────────────────────────────────────

describe("canAccessField", () => {
  // ── Read access ─────────────────────────────────────────────

  it("read: owner can read public field", () => {
    assert.equal(canAccessField("characterName", "owner", "read"), true);
  });

  it("read: public cannot read private field", () => {
    // playerId: public has NO access
    assert.equal(canAccessField("playerId", "public", "read"), false);
  });

  it("read: dm can read any field", () => {
    assert.equal(canAccessField("characterName", "dm", "read"), true);
    assert.equal(canAccessField("playerId", "dm", "read"), true);
  });

  // ── Write access ────────────────────────────────────────────

  it("write: owner can write writable field", () => {
    assert.equal(canAccessField("characterName", "owner", "write"), true);
  });

  it("write: owner cannot write read-only field (attribute)", () => {
    // perm_attr: owner has RO
    assert.equal(
      canAccessField("attributes.primary.accurate", "owner", "write"),
      false,
    );
  });

  it("write: public cannot write any field", () => {
    assert.equal(canAccessField("characterName", "public", "write"), false);
  });

  it("write: dm can write default-perm field", () => {
    assert.equal(canAccessField("characterName", "dm", "write"), true);
  });

  // ── Unknown field ─────────────────────────────────────────────

  it("returns false for unknown field", () => {
    assert.equal(canAccessField("nonexistent.field", "dm", "read"), false);
  });
});

// ── applyFieldUpdate ──────────────────────────────────────────────

describe("applyFieldUpdate", () => {
  it("set operation replaces value", () => {
    const obj: Record<string, unknown> = { characterName: "Old" };
    applyFieldUpdate(obj, "characterName", "New", "set");
    assert.equal(obj.characterName, "New");
  });

  it("increment adds to numeric value", () => {
    const obj: Record<string, unknown> = { experience: { unspent: 10 } };
    applyFieldUpdate(obj, "experience.unspent", 5, "increment");
    assert.equal((obj.experience as Record<string, unknown>).unspent, 15);
  });

  it("increment on missing field treats as 0 + value", () => {
    const obj: Record<string, unknown> = {};
    applyFieldUpdate(obj, "score", 7, "increment");
    assert.equal(obj.score, 7);
  });

  it("push appends to existing array", () => {
    const obj: Record<string, unknown> = { traits: ["a"] };
    applyFieldUpdate(obj, "traits", "b", "push");
    assert.deepStrictEqual(obj.traits, ["a", "b"]);
  });

  it("push on missing field creates array then pushes", () => {
    const obj: Record<string, unknown> = {};
    applyFieldUpdate(obj, "traits", "first", "push");
    assert.deepStrictEqual(obj.traits, ["first"]);
  });

  it("creates intermediate objects for deep paths", () => {
    const obj: Record<string, unknown> = {};
    applyFieldUpdate(obj, "deep.nested.value", 42, "set");
    assert.equal(
      ((obj.deep as Record<string, unknown>).nested as Record<string, unknown>)
        .value,
      42,
    );
  });
});

// ── generateDefaultCharacter ──────────────────────────────────────

describe("generateDefaultCharacter", () => {
  const defaults = generateDefaultCharacter("player-1", "Test Player");

  it("sets playerId and player from arguments", () => {
    assert.equal(defaults.playerId, "player-1");
    assert.equal(defaults.player, "Test Player");
  });

  it("created and lastModified are ISO date strings", () => {
    assert.ok(typeof defaults.created === "string");
    assert.ok(typeof defaults.lastModified === "string");
    // Should be parseable as a date
    assert.ok(!isNaN(Date.parse(defaults.created as string)));
    assert.ok(!isNaN(Date.parse(defaults.lastModified as string)));
  });

  it("excludes serverControlled fields like schemaVersion", () => {
    assert.equal(defaults.schemaVersion, undefined);
  });

  it("excludes serverControlled attributes.primaryEffective block", () => {
    const attrs = defaults.attributes as Record<string, unknown>;
    assert.equal(attrs.primaryEffective, undefined);
  });

  it("includes non-serverControlled fields with defaults", () => {
    const attrs = defaults.attributes as Record<string, unknown>;
    const primary = attrs.primary as Record<string, number>;
    assert.equal(primary.accurate, 5);
    assert.equal(primary.strong, 5);
  });

  it("uses 'Unknown' as default playerName when not provided", () => {
    const d = generateDefaultCharacter("pid");
    assert.equal(d.player, "Unknown");
  });

  // Invariant: schema's seed natural_weapon must match the snapshot below.
  // If the reference catalog's `natural_weapon` entry drifts, this test
  // does NOT auto-update — the goal is to catch silent drift between the
  // schema default and the canonical record. This test is the guard for
  // that drift; the single-source fix is tracked in NB-45.
  it("schema default for equipment.weapons[0] is the natural_weapon seed", () => {
    const d = generateDefaultCharacter("pid");
    const equipment = d.equipment as Record<string, unknown>;
    const weapons = equipment.weapons as Array<Record<string, unknown>>;
    assert.deepEqual(weapons[0], {
      id: "natural_weapon",
      name: "natural_weapon",
      type: "natural",
      damage: 0,
      qualities: ["own"],
    });
  });
});

// ── validateRPGRules ──────────────────────────────────────────────

describe("validateRPGRules", () => {
  it("returns BUSINESS_RULE error for negative experience.unspent", () => {
    const char = makeCharacter({
      experience: { total: 50, unspent: -1 },
    });
    const errors = validateRPGRules(char);
    const xpErr = errors.find((e) => e.code === "BUSINESS_RULE");
    assert.ok(xpErr);
  });

  it("does not report the attribute budget (rule lives on the attributes schema hook)", () => {
    const char = makeCharacter({
      attributes: {
        primary: makePrimaryAttributes({ accurate: 11 }), // 81 total
      },
    });
    const errors = validateRPGRules(char);
    assert.equal(
      errors.find((e) => e.field === "attributes.primary"),
      undefined,
      "budget enforcement moved to rpgValidators.attributePointsValid",
    );
  });

  it("does not crash with missing attributes or experience", () => {
    const char: Record<string, unknown> = {};
    const errors = validateRPGRules(char);
    assert.ok(Array.isArray(errors));
  });
});

// ── validateCrossFieldRules ───────────────────────────────────────

describe("validateCrossFieldRules", () => {
  it("returns no errors for a valid character with the real validator list", () => {
    // The fields carrying validate hooks: the attributes budget, the
    // health range, and the combat carried tuple. makeCharacter satisfies
    // all three.
    const char = makeCharacter();
    const fieldsWithValidation = [
      "attributes",
      "attributes.secondary.toughness.current",
      "combat.carried",
    ];
    const errors = validateCrossFieldRules(char, fieldsWithValidation);
    assert.equal(errors.length, 0);
  });

  it("reports a budget violation through the attributes hook", () => {
    const char = makeCharacter({
      attributes: { primary: makePrimaryAttributes({ accurate: 11 }) },
    });
    const errors = validateCrossFieldRules(char, ["attributes"]);
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.code, "CROSS_FIELD_VALIDATION");
    assert.match(errors[0]!.error, /81/);
  });

  it("returns no errors with empty field list", () => {
    const char = makeCharacter();
    const errors = validateCrossFieldRules(char, []);
    assert.equal(errors.length, 0);
  });

  it("skips fields that do not have a validate function in schema", () => {
    // If a path without validate fn is in the list, it's silently skipped
    const char = makeCharacter();
    const errors = validateCrossFieldRules(char, ["location"]);
    assert.equal(errors.length, 0);
  });
});
