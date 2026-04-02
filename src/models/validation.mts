import {
  canAccessField,
  generateDefaultCharacter,
  getFieldSchema,
  checkRequiredFields,
  checkServerControlledField,
  validateRPGRules,
  validateFieldValue,
  validateCrossFieldRules,
  isFieldWritable,
} from "./schema-utils.mts";
import {
  deepMerge,
  getAllFieldPaths,
  getFieldPathsByProperty,
  getNestedValue,
  setNestedValue,
} from "./traversal.mts";
import type {
  ValidationResult,
  UpdateValidationResult,
  FieldUpdate,
} from "#types";

const REQUIRED_FIELDS: string[] = getFieldPathsByProperty("required", true);
const FIELDS_WITH_VALIDATION: string[] = getFieldPathsByProperty(
  "validate",
  undefined,
);
export const SERVER_CONTROLLED_FIELDS: string[] = getFieldPathsByProperty(
  "serverControlled",
  true,
);

export function validateCharacterCreation(
  data: Record<string, unknown>,
  playerId: string,
  playerName: string,
): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];
  const validatedData: Record<string, unknown> = {};

  const defaultCharacter = generateDefaultCharacter(playerId, playerName);

  const mergedCharacter = deepMerge(defaultCharacter, data, {
    skipUndefined: true,
  });

  checkRequiredFields(data, errors, REQUIRED_FIELDS, SERVER_CONTROLLED_FIELDS);

  const userProvidedPaths = getAllFieldPaths(data);

  for (const fieldPath of userProvidedPaths) {
    if (
      checkServerControlledField(fieldPath, warnings, SERVER_CONTROLLED_FIELDS)
    )
      continue;

    const userValue = getNestedValue(data, fieldPath);
    const schema = getFieldSchema(fieldPath);

    if (!schema) {
      errors.push({
        field: fieldPath,
        error: `Unknown field: "${fieldPath}"`,
        code: "UNKNOWN_FIELD",
      });

      continue;
    }

    const canSet = skipOnCreation(fieldPath, "owner");

    // if (!canAccessField(fieldPath, "owner", "write")) {
    if (!canSet) {
      errors.push({
        field: fieldPath,
        error: `You don't have permission to set "${fieldPath}" during character creation...`,
        code: "PERMISSION_DENIED",
      });

      continue;
    }

    const validation = validateFieldValue(
      fieldPath,
      userValue,
      mergedCharacter as Record<string, unknown>,
    );
    if (!validation.valid) {
      errors.push({
        field: fieldPath,
        error: validation.error || "Validation failed",
        code: "VALIDATION",
      });

      continue;
    }

    setNestedValue(validatedData, fieldPath, userValue);
  }

  const crossFieldErrors = validateCrossFieldRules(
    mergedCharacter,
    FIELDS_WITH_VALIDATION,
  );
  errors.push(...crossFieldErrors);

  const businessErrors = validateRPGRules(mergedCharacter);
  errors.push(...businessErrors);

  return {
    success: errors.length === 0,
    validatedData:
      errors.length === 0
        ? {
            ...deepMerge(defaultCharacter, validatedData, {
              skipUndefined: true,
            }),
            playerId,
            player: playerName || "Unknown",
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          }
        : null,
    errors,
    warnings,
  };
}

export async function validateCharacterUpdate(
  updates: FieldUpdate[],
  character: Record<string, unknown>,
  role: string,
  _options?: Record<string, unknown>,
): Promise<UpdateValidationResult> {
  const errors: UpdateValidationResult["errors"] = [];
  const validUpdates: FieldUpdate[] = [];

  for (const update of updates) {
    const { field, value, operation = "set" } = update;

    if (!isFieldWritable(field, role)) {
      errors.push({
        field,
        error: `Not allowed to edit ${field}`,
        code: "FORBIDDEN",
      });
      continue;
    }

    const validation = validateFieldValue(field, value, character);
    if (!validation.valid) {
      errors.push({
        field,
        error: validation.error || "Validation failed",
        code: "VALIDATION",
      });
      continue;
    }

    if (operation === "increment" && field === "abilities") {
      // const requiredXP = calculateXPForNextRank(character);
      // if (value < requiredXP) {
      //   errors.push({
      //     field,
      //     error: `Need ${requiredXP} XP for the next rank`,
      //     code: `BUSINESS_RULE`,
      //   });
      //   continue;
      // }
    }

    if (update.field === "traits" && update.operation === "push") {
      const ability = update.value as Record<string, unknown>;
      const cost = (ability.cost as number[])[0]!;
      const unspent = (character as Record<string, Record<string, unknown>>)
        .experience?.unspent as number;

      if (unspent < cost) {
        errors.push({
          field: "experience.unspent",
          error: "Not enough XP",
          code: "INSUFFICIENT_XP",
        });
        continue;
      }
    }

    validUpdates.push(update);
  }

  return { validUpdates, errors };
}

export function skipOnCreation(fieldPath: string, userRole: string): boolean {
  const schema = getFieldSchema(fieldPath);
  if (!schema) return false;

  if (schema.serverControlled) return false;

  if (userRole === "owner") {
    const creationOverrides = [
      "experience.total",
      "experience.unspent",
      "corruption.temporary",
      "attributes.primary.accurate",
      "attributes.primary.cunning",
      "attributes.primary.discreet",
      "attributes.primary.alluring",
      "attributes.primary.quick",
      "attributes.primary.strong",
      "attributes.primary.vigilant",
      "attributes.primary.resolute",
      "attributes.secondary.toughness.max",
      "attributes.secondary.painThreshold",
      "attributes.secondary.corruptionThreshold",
      "attributes.secondary.defense",
    ];

    if (creationOverrides.includes(fieldPath)) {
      return true;
    }
  }

  return canAccessField(fieldPath, userRole, "write");
}
