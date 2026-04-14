import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getNestedValue,
  setNestedValue,
  deepMerge,
  getAllFieldPaths,
  getFieldPathsByProperty,
  getWritableFieldPaths,
} from "../src/models/traversal.mts";

// ── getNestedValue ────────────────────────────────────────────────

describe("getNestedValue", () => {
  it("returns value at a deep existing path", () => {
    const obj = { a: { b: { c: 42 } } };
    assert.equal(getNestedValue(obj, "a.b.c"), 42);
  });

  it("returns undefined for a missing intermediate key", () => {
    const obj = { a: { b: 1 } };
    assert.equal(getNestedValue(obj, "a.x.y"), undefined);
  });

  it("returns undefined when intermediate is a non-object primitive", () => {
    const obj = { a: { b: 7 } };
    assert.equal(getNestedValue(obj, "a.b.c"), undefined);
  });

  it("returns undefined when intermediate is an array", () => {
    const obj = { a: [1, 2, 3] };
    assert.equal(getNestedValue(obj, "a.0"), undefined);
  });

  it("returns direct property for a single-segment path", () => {
    const obj = { foo: "bar" };
    assert.equal(getNestedValue(obj, "foo"), "bar");
  });

  it("returns undefined on an empty object", () => {
    assert.equal(getNestedValue({}, "any.path"), undefined);
  });
});

// ── setNestedValue ────────────────────────────────────────────────

describe("setNestedValue", () => {
  it("creates intermediate objects for a deep path", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "a.b.c", 99);
    assert.deepStrictEqual(obj, { a: { b: { c: 99 } } });
  });

  it("overwrites an existing leaf value", () => {
    const obj: Record<string, unknown> = { a: { b: { c: 1 } } };
    setNestedValue(obj, "a.b.c", 2);
    assert.equal(
      (obj.a as Record<string, unknown>).b &&
        ((obj.a as Record<string, unknown>).b as Record<string, unknown>).c,
      2,
    );
  });

  it("replaces a primitive intermediate with an object", () => {
    const obj: Record<string, unknown> = { a: 5 };
    setNestedValue(obj, "a.b", 10);
    assert.deepStrictEqual(obj, { a: { b: 10 } });
  });

  it("sets a single-segment path on an empty object", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "x", "hello");
    assert.equal(obj.x, "hello");
  });
});

// ── deepMerge ─────────────────────────────────────────────────────

describe("deepMerge", () => {
  it("returns a copy of target when source is null", () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, null);
    assert.deepStrictEqual(result, { a: 1, b: 2 });
    assert.notEqual(result, target);
  });

  it("returns a copy of target when source is undefined", () => {
    const target = { a: 1 };
    const result = deepMerge(target, undefined);
    assert.deepStrictEqual(result, { a: 1 });
    assert.notEqual(result, target);
  });

  it("replaces target array with source array (not concatenation)", () => {
    const target = { items: [1, 2, 3] };
    const result = deepMerge(target, { items: [4, 5] });
    assert.deepStrictEqual(result.items, [4, 5]);
  });

  it("merges nested objects recursively", () => {
    const target = { a: { x: 1, y: 2 } };
    const source = { a: { y: 3, z: 4 } };
    const result = deepMerge(target, source);
    assert.deepStrictEqual(result.a, { x: 1, y: 3, z: 4 });
  });

  it("preserves target value when skipUndefined is true and source value is undefined", () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined, b: 10 };
    const result = deepMerge(target, source, { skipUndefined: true });
    assert.equal(result.a, 1);
    assert.equal(result.b, 10);
  });

  it("overwrites target with undefined by default", () => {
    const target = { a: 1 };
    const source = { a: undefined };
    const result = deepMerge(target, source);
    assert.equal(result.a, undefined);
  });

  it("overwrites a target object with a source scalar at the same key", () => {
    const target = { a: { nested: true } };
    const source = { a: 42 };
    const result = deepMerge(target, source);
    assert.equal(result.a, 42);
  });
});

// ── getAllFieldPaths ───────────────────────────────────────────────

describe("getAllFieldPaths", () => {
  it("returns simple keys for a flat object", () => {
    const result = getAllFieldPaths({ a: 1, b: "two", c: true });
    assert.deepStrictEqual(result, ["a", "b", "c"]);
  });

  it("returns dotted paths for nested objects", () => {
    const result = getAllFieldPaths({ a: { b: { c: 1 } } });
    assert.deepStrictEqual(result, ["a.b.c"]);
  });

  it("treats array values as leaf nodes", () => {
    const result = getAllFieldPaths({ list: [1, 2, 3], name: "x" });
    assert.deepStrictEqual(result, ["list", "name"]);
  });

  it("returns empty array for an empty object", () => {
    assert.deepStrictEqual(getAllFieldPaths({}), []);
  });
});

// ── getFieldPathsByProperty ───────────────────────────────────────

describe("getFieldPathsByProperty", () => {
  it("finds required fields in CHARACTER_SCHEMA", () => {
    const paths = getFieldPathsByProperty("required", true);
    assert.ok(paths.includes("characterName"), "should include characterName");
    assert.ok(paths.includes("attributes"), "should include attributes");
    assert.ok(paths.includes("id"), "should include id");
  });

  it("finds serverControlled fields", () => {
    const paths = getFieldPathsByProperty("serverControlled", true);
    assert.ok(paths.includes("id"));
    assert.ok(paths.includes("backupCode"));
    assert.ok(paths.includes("portrait.path"));
    assert.ok(paths.includes("portrait.status"));
  });

  it("skips _config key", () => {
    const paths = getFieldPathsByProperty("required", true);
    const configPaths = paths.filter((p) => p.startsWith("_config"));
    assert.equal(configPaths.length, 0);
  });

  it("recurses into type:object nodes", () => {
    const paths = getFieldPathsByProperty("required", true);
    assert.ok(
      paths.includes("attributes.primary"),
      "should recurse into attributes to find primary",
    );
  });

  it("works with a custom schema", () => {
    const schema = {
      foo: { type: "string", custom: true },
      bar: { type: "string", custom: false },
      _hidden: { type: "string", custom: true },
    };
    const paths = getFieldPathsByProperty("custom", true, schema);
    assert.deepStrictEqual(paths, ["foo"]);
  });

  it("finds fields that have a validate function (propertyValue: undefined)", () => {
    const paths = getFieldPathsByProperty("validate", undefined);
    assert.ok(
      paths.includes("attributes"),
      "attributes has rpgValidators.attributePointsValid",
    );
    assert.ok(
      paths.includes("attributes.secondary.toughness.current"),
      "toughness.current has rpgValidators.currentHealthValid",
    );
    assert.ok(
      paths.includes("attributes.secondary.defense"),
      "defense has rpgValidators.defenseValid",
    );
    assert.ok(
      paths.includes("attributes.secondary.painThreshold"),
      "painThreshold has rpgValidators.painThresholdValid",
    );
    assert.ok(
      paths.includes("attributes.secondary.corruptionThreshold"),
      "corruptionThreshold has rpgValidators.corruptionThresholdValid",
    );
    // Exactly the 5 schema fields with validate functions
    assert.equal(paths.length, 5);
  });
});

// ── getWritableFieldPaths ─────────────────────────────────────────

describe("getWritableFieldPaths", () => {
  it("returns a Set", () => {
    const result = getWritableFieldPaths("owner");
    assert.ok(result instanceof Set);
  });

  it("owner excludes serverControlled, generated, immutable, and derived fields", () => {
    const paths = getWritableFieldPaths("owner");
    assert.ok(!paths.has("id"));
    assert.ok(!paths.has("backupCode"));
    assert.ok(!paths.has("created"));
    assert.ok(!paths.has("lastModified"));
    assert.ok(!paths.has("schemaVersion"));
    assert.ok(!paths.has("attributes.secondary.defense"));
  });

  it("dm has at least as many writable paths as owner", () => {
    const ownerPaths = getWritableFieldPaths("owner");
    const dmPaths = getWritableFieldPaths("dm");
    assert.ok(dmPaths.size >= ownerPaths.size);
  });

  it("public has a narrow writable set", () => {
    const publicPaths = getWritableFieldPaths("public");
    const ownerPaths = getWritableFieldPaths("owner");
    assert.ok(publicPaths.size < ownerPaths.size);
  });
});
