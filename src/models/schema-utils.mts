import { setNestedValue, getNestedValue } from "./traversal.mts";

import { CHARACTER_SCHEMA } from "./character.mts";
import { SERVER_CONTROLLED_FIELDS } from "./validation.mts";

import type { ValidationError, ValidationWarning, SchemaField } from "#types";
import type { Weapon } from "#rpg-types";

// ── Default-seed binding ──────────────────────────────────────
//
// `generateDefaultCharacter` seeds `equipment.weapons` with the catalog
// `natural_weapon` record (own-slot anchor, ADR-014) instead of an
// inline schema default, so the reference catalog stays the single
// source of truth (NB-45). The models layer must not import `#rules`
// (ADR-013 layering), so — mirroring `initCharacterService` — `app.mts`
// injects the registry-backed weapon lookup once at startup.

interface DefaultSeedDeps {
  /** Resolve a weapon catalog id to its engine `Weapon` projection. */
  lookupWeapon: (id: string) => Weapon | null;
}

let seedDeps: DefaultSeedDeps | null = null;

export function initDefaultSeeds(deps: DefaultSeedDeps): void {
  seedDeps = deps;
}

function requireSeedDeps(): DefaultSeedDeps {
  if (!seedDeps) {
    throw new Error(
      "Default seeds not initialised. Call initDefaultSeeds() at app startup.",
    );
  }
  return seedDeps;
}

export function canAccessField(
  fieldPath: string,
  userRole: string,
  operation: string = "read",
): boolean {
  const fieldSchema = getFieldSchema(fieldPath);
  if (!fieldSchema) return false;

  const rolePerm =
    fieldSchema.permissions?.[userRole as keyof typeof fieldSchema.permissions];
  if (!rolePerm || typeof rolePerm !== "object") return false;

  const perm = rolePerm as { read: boolean; write: boolean };
  return operation === "write" ? perm.write : perm.read;
}

export function validateFieldValue(
  fieldPath: string,
  value: unknown,
  allData: Record<string, unknown> = {},
): { valid: boolean; error?: string } {
  const schema = getFieldSchema(fieldPath);
  if (!schema) return { valid: false, error: `Unknown field: ${fieldPath}` };

  // `typeof null === "object"` would sail past the type check below, so
  // nulls are rejected explicitly unless the field opts in via `nullable`
  // (the armor slots, where null = "nothing equipped").
  if (value === null) {
    if (schema.nullable) return { valid: true };
    return {
      valid: false,
      error: `Field "${fieldPath}" does not accept null`,
    };
  }

  if (schema.type && typeof value !== schema.type) {
    if (!(schema.type === "array" && Array.isArray(value))) {
      return {
        valid: false,
        error: `Expected ${schema.type}, got ${typeof value}`,
      };
    }
  }

  if (schema.type === "number") {
    const numValue = value as number;
    if (schema.min !== undefined && numValue < schema.min) {
      return { valid: false, error: `Minimum value is ${schema.min}` };
    }

    if (schema.max !== undefined && numValue > schema.max) {
      return { valid: false, error: `Maximum value is ${schema.max}` };
    }

    if (schema.integer && !Number.isInteger(numValue)) {
      return { valid: false, error: "Must be an integer " };
    }
  }

  if (schema.type === "string") {
    const strValue = value as string;
    if (schema.minLength && strValue.length < schema.minLength) {
      return { valid: false, error: `Minimum length is ${schema.minLength}` };
    }

    if (schema.maxLength && strValue.length > schema.maxLength) {
      return { valid: false, error: `Maximum length is ${schema.maxLength}` };
    }

    if (schema.pattern && !schema.pattern.test(strValue)) {
      return { valid: false, error: schema.error || "Invalid format" };
    }
  }

  if (schema.validate) {
    const result = schema.validate(value, allData);

    if (result !== true) {
      return { valid: false, error: result as string };
    }
  }

  return { valid: true };
}

export function generateDefaultCharacter(
  playerId: string,
  playerName: string = "Unknown",
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  function traverse(schema: Record<string, unknown>, path: string = ""): void {
    for (const [key, fieldSchema] of Object.entries(schema)) {
      if (key.startsWith("_")) continue;

      const fullPath = path ? `${path}.${key}` : key;
      const field = fieldSchema as Record<string, unknown>;

      if (SERVER_CONTROLLED_FIELDS.includes(fullPath)) {
        continue;
      }

      if (field.default !== undefined) {
        setNestedValue(defaults, fullPath, field.default);
      } else if (field.type === "object") {
        traverse(field, fullPath);
      }
    }
  }

  traverse(CHARACTER_SCHEMA);

  // Own-slot anchor (ADR-014): seeded from the weapon catalog through
  // the injected lookup — the schema carries no inline default (NB-45).
  // Clone so each new character owns its arrays.
  const natural = requireSeedDeps().lookupWeapon("natural_weapon");
  if (!natural) {
    throw new Error(
      "[models] Weapon lookup has no 'natural_weapon' entry — required " +
        "to seed the own-slot anchor (ADR-014, NB-45).",
    );
  }
  setNestedValue(defaults, "equipment.weapons", [
    {
      ...natural,
      qualities: [...natural.qualities],
      ...(natural.effects ? { effects: structuredClone(natural.effects) } : {}),
    },
  ]);

  defaults.playerId = playerId;
  defaults.player = playerName;
  defaults.created = new Date().toISOString();
  defaults.lastModified = new Date().toISOString();

  return defaults;
}

export function getFieldSchema(
  fieldPath: string,
  _schema?: Record<string, unknown>,
): SchemaField | null {
  const parts = fieldPath.split(".");
  let current: Record<string, unknown> = CHARACTER_SCHEMA;

  for (const part of parts) {
    if (current[part] && typeof current[part] === "object") {
      current = current[part] as Record<string, unknown>;
    } else {
      return null;
    }
  }

  const { primary, secondary, ...schema } = current;
  return schema as unknown as SchemaField;
}

export function checkRequiredFields(
  data: Record<string, unknown>,
  errors: ValidationError[],
  requiredPaths: string[],
  serverControlledFields: string[],
): void {
  for (const fieldPath of requiredPaths) {
    if (serverControlledFields.includes(fieldPath)) {
      continue;
    }

    const value = getNestedValue(data, fieldPath);

    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) {
      errors.push({
        field: fieldPath,
        error: `Required field "${fieldPath}" is missing`,
        code: "REQUIRED",
      });
    }
  }
}

export function checkServerControlledField(
  fieldPath: string,
  warnings: ValidationWarning[],
  serverControlledPaths: string[],
): boolean {
  if (serverControlledPaths.includes(fieldPath)) {
    warnings.push({
      field: fieldPath,
      message: `Field "${fieldPath}" is server-controlled and will be ignored`,
    });

    return true;
  }

  return false;
}

export function validateCrossFieldRules(
  characterData: Record<string, unknown>,
  fieldsWithValidation: string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const fieldPath of fieldsWithValidation) {
    const schema = getFieldSchema(fieldPath);

    if (schema?.validate) {
      const value = getNestedValue(
        characterData as Record<string, unknown>,
        fieldPath,
      );
      const result = schema.validate(value, characterData);

      if (result !== true) {
        errors.push({
          field: fieldPath,
          error: (result as string) || schema.error || "Validation failed",
          code: "CROSS_FIELD_VALIDATION",
        });
      }
    }
  }

  return errors;
}

export function validateRPGRules(
  characterData: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const charData = characterData as Record<string, Record<string, unknown>>;

  if (
    (charData.experience as Record<string, number> | undefined)?.unspent !==
      undefined &&
    (charData.experience as Record<string, number>).unspent! < 0
  ) {
    errors.push({
      field: "experience.total",
      error: "Can't have negative experience",
      code: "BUSINESS_RULE",
    });
  }

  // The primary-attribute budget rule (sum exactly 80, ES §primaries)
  // lives on the `attributes` schema field as
  // `rpgValidators.attributePointsValid` and fires through the
  // cross-field pass — at creation and on the merged-update pass.

  return errors;
}

export function isFieldWritable(
  fieldPath: string,
  role: string,
  schema: Record<string, unknown> = CHARACTER_SCHEMA,
): boolean {
  const fieldSchema = getFieldSchema(fieldPath, schema);

  if (!fieldSchema) return false;

  if (
    fieldSchema.serverControlled ||
    fieldSchema.generated ||
    fieldSchema.immutable ||
    fieldSchema.derived
  ) {
    return false;
  }

  return canAccessField(fieldPath, role, "write");
}

export function applyFieldUpdate(
  character: Record<string, unknown>,
  fieldPath: string,
  value: unknown,
  operation: string = "set",
): void {
  const keys = fieldPath.split(".");
  let current: Record<string, unknown> = character;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (!current[key]) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1]!;

  switch (operation) {
    case "set":
      current[lastKey] = value;
      break;
    case "increment":
      current[lastKey] =
        ((current[lastKey] as number) || 0) + (value as number);
      break;
    case "push":
      if (!Array.isArray(current[lastKey])) current[lastKey] = [];
      (current[lastKey] as unknown[]).push(value);
      break;
  }
}
