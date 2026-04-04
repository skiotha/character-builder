import { CHARACTER_SCHEMA, SCHEMA_SECTIONS } from "./character.mts";

import type { SchemaField, SchemaSection } from "#types";

// ── Known schema-field property keys (non-child fields) ───────

const SCHEMA_PROPS = new Set([
  "type",
  "required",
  "serverControlled",
  "generated",
  "immutable",
  "derived",
  "default",
  "min",
  "max",
  "minLength",
  "maxLength",
  "integer",
  "pattern",
  "sanitize",
  "error",
  "permissions",
  "validate",
  "ui",
]);

// ── Type guard: is this node a leaf schema field? ─────────────

function isSchemaField(node: Record<string, unknown>): node is SchemaField {
  return typeof node.type === "string" && node.type !== "object";
}

// ── Serialize a single field to JSON-safe form ────────────────

function serializeField(
  field: SchemaField,
  path: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = { path };

  if (field.type !== undefined) out.type = field.type;
  if (field.required) out.required = true;
  if (field.serverControlled) out.serverControlled = true;
  if (field.generated) out.generated = true;
  if (field.immutable) out.immutable = true;
  if (field.derived) out.derived = true;
  if (field.default !== undefined) out.default = field.default;
  if (field.min !== undefined) out.min = field.min;
  if (field.max !== undefined) out.max = field.max;
  if (field.minLength !== undefined) out.minLength = field.minLength;
  if (field.maxLength !== undefined) out.maxLength = field.maxLength;
  if (field.integer) out.integer = true;
  if (field.pattern instanceof RegExp) out.pattern = field.pattern.source;
  if (field.error) out.error = field.error;
  if (field.permissions) out.permissions = field.permissions;
  if (field.ui) out.ui = field.ui;

  return out;
}

// ── Walk the schema tree and collect all leaf fields ──────────

function walkSchema(
  node: Record<string, unknown>,
  prefix: string,
  result: Record<string, Record<string, unknown>>,
): void {
  for (const [key, value] of Object.entries(node)) {
    if (key === "_config") continue;
    if (SCHEMA_PROPS.has(key)) continue;
    if (value === null || typeof value !== "object") continue;

    const child = value as Record<string, unknown>;
    const childPath = prefix ? `${prefix}.${key}` : key;

    if (isSchemaField(child)) {
      result[childPath] = serializeField(child as SchemaField, childPath);
    } else if (child.type === "object" || typeof child.type === "undefined") {
      // Object node with ui metadata gets a field entry (for component overrides)
      if (child.ui && typeof child.ui === "object") {
        const fieldEntry: Record<string, unknown> = {
          path: childPath,
          type: child.type ?? "object",
        };
        if (child.permissions) fieldEntry.permissions = child.permissions;
        if (child.derived) fieldEntry.derived = true;
        fieldEntry.ui = child.ui;
        result[childPath] = fieldEntry;
      }
      // Recurse into children
      walkSchema(child, childPath, result);
    }
  }
}

// ── Public: serialize the full schema for the client ──────────

export interface SerializedSchema {
  fields: Record<string, Record<string, unknown>>;
  sections: SchemaSection[];
  version: number;
}

export function serializeSchema(): SerializedSchema {
  const fields: Record<string, Record<string, unknown>> = {};

  walkSchema(CHARACTER_SCHEMA as Record<string, unknown>, "", fields);

  const version =
    (CHARACTER_SCHEMA as Record<string, unknown>).schemaVersion &&
    typeof (
      (CHARACTER_SCHEMA as Record<string, unknown>).schemaVersion as Record<
        string,
        unknown
      >
    ).default === "number"
      ? ((
          (CHARACTER_SCHEMA as Record<string, unknown>).schemaVersion as Record<
            string,
            unknown
          >
        ).default as number)
      : 1;

  return {
    fields,
    sections: SCHEMA_SECTIONS,
    version,
  };
}

// ── Pre-compute and cache ─────────────────────────────────────

let cachedSchema: SerializedSchema | null = null;
let cachedJson: string | null = null;
let cachedETag: string | null = null;

export function getSerializedSchema(): {
  json: string;
  etag: string;
  schema: SerializedSchema;
} {
  if (!cachedSchema) {
    cachedSchema = serializeSchema();
    cachedJson = JSON.stringify(cachedSchema);
    // Simple version-based ETag — schema only changes on deploy
    cachedETag = `"schema-v${cachedSchema.version}"`;
  }

  return {
    json: cachedJson!,
    etag: cachedETag!,
    schema: cachedSchema,
  };
}
