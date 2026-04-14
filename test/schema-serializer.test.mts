import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  serializeSchema,
  getSerializedSchema,
} from "#models/schema-serializer";
import { CHARACTER_SCHEMA, SCHEMA_SECTIONS } from "#models/character";

// ── serializeSchema ───────────────────────────────────────────────

describe("serializeSchema", () => {
  const result = serializeSchema();

  it("returns { fields, sections, version } structure", () => {
    assert.ok(result.fields && typeof result.fields === "object");
    assert.ok(Array.isArray(result.sections));
    assert.equal(typeof result.version, "number");
  });

  it("fields contains entries for visible schema leaf fields", () => {
    // characterName is a visible leaf field
    assert.ok("characterName" in result.fields);
    // A nested leaf field
    assert.ok("experience.total" in result.fields);
  });

  it("each field entry has path property matching its key", () => {
    for (const [key, entry] of Object.entries(result.fields)) {
      assert.equal(
        entry!.path,
        key,
        `field "${key}" has mismatched path "${entry!.path}"`,
      );
    }
  });

  it("serializes RegExp patterns as .source strings", () => {
    const nameField = result.fields["characterName"]!;
    assert.equal(typeof nameField.pattern, "string");
    // The pattern should be the regex source, not a RegExp object
    assert.ok(!(nameField.pattern instanceof RegExp));
    assert.equal(nameField.pattern, /^[A-Za-z\s\-']+$/.source);
  });

  it("excludes validate functions from output", () => {
    // attributes.primary has validate: rpgValidators.attributePointsValid
    // in the schema but it should not appear in serialized output
    for (const entry of Object.values(result.fields)) {
      assert.equal(
        "validate" in entry!,
        false,
        `field "${entry!.path}" should not have validate in serialized output`,
      );
    }
  });

  it("includes object nodes with ui metadata", () => {
    // Look for any object-typed entry with ui metadata
    const objectEntries = Object.values(result.fields).filter(
      (f) => f!.type === "object" && f!.ui,
    );
    assert.ok(
      objectEntries.length > 0,
      "should have at least one object node with ui metadata",
    );
  });

  it("excludes _config key", () => {
    assert.equal("_config" in result.fields, false);
    // Also verify no field path starts with _config
    for (const key of Object.keys(result.fields)) {
      assert.ok(
        !key.startsWith("_config"),
        `field "${key}" should not start with _config`,
      );
    }
  });

  it("version matches CHARACTER_SCHEMA.schemaVersion.default", () => {
    const schemaVersionNode = (
      CHARACTER_SCHEMA as Record<string, Record<string, unknown>>
    ).schemaVersion!;
    assert.equal(result.version, schemaVersionNode.default);
  });

  it("sections matches SCHEMA_SECTIONS", () => {
    assert.deepStrictEqual(result.sections, SCHEMA_SECTIONS);
  });
});

// ── getSerializedSchema ───────────────────────────────────────────

describe("getSerializedSchema", () => {
  it("returns { json, etag, schema } structure", () => {
    const result = getSerializedSchema();
    assert.equal(typeof result.json, "string");
    assert.equal(typeof result.etag, "string");
    assert.ok(result.schema && typeof result.schema === "object");
  });

  it("json is valid JSON string", () => {
    const { json } = getSerializedSchema();
    assert.doesNotThrow(() => JSON.parse(json));
  });

  it("etag matches schema-v{N} format", () => {
    const { etag } = getSerializedSchema();
    assert.match(etag, /^"schema-v\d+"$/);
  });

  it("returns identical json and etag on repeated calls (caching)", () => {
    const first = getSerializedSchema();
    const second = getSerializedSchema();
    assert.equal(first.json, second.json);
    assert.equal(first.etag, second.etag);
    assert.equal(first.schema, second.schema);
  });

  it("JSON.parse(json) structurally matches schema", () => {
    const { json, schema } = getSerializedSchema();
    const parsed = JSON.parse(json) as typeof schema;
    assert.deepStrictEqual(parsed, schema);
  });
});
