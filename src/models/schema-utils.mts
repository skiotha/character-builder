import { setNestedValue, getNestedValue } from "./traversal.mts";

import { CHARACTER_SCHEMA } from "./character.mts";
import { SERVER_CONTROLLED_FIELDS } from "./validation.mts";

import type { ValidationError, ValidationWarning, SchemaField } from "#types";

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
        // skipped during default character generation
      }

      if (field.default !== undefined) {
        setNestedValue(defaults, fullPath, field.default);
      } else if (field.type === "object") {
        traverse(field, fullPath);
      }
    }
  }

  traverse(CHARACTER_SCHEMA);

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

  if ((charData.attributes as Record<string, unknown> | undefined)?.primary) {
    const primary = (charData.attributes as Record<string, unknown>)
      .primary as Record<string, number>;
    const primaryTotal = Object.values(primary).reduce(
      (sum, val) => sum + (val || 0),
      0,
    );

    if (primaryTotal > 80) {
      errors.push({
        field: "attributes.primary",
        error: `Total primary attributes (${primaryTotal}) exceed budget of 80`,
        code: "BUSINESS_RULE",
      });
    }
  }

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
