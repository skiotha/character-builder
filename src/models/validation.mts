import {
  applyFieldUpdate,
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
import { validateCatalogRefs } from "./reference-validation.mts";
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

    validUpdates.push(update);
  }

  // Merged-state pass: apply the valid updates to a clone and re-run the
  // cross-field hooks, business rules, and strict catalog-membership
  // checks against the merged character. Per-field validation cannot see
  // aggregates (e.g. the exact-80 primary budget when a single leaf
  // changes, ES §primaries) or ids inside PATCHed arrays.
  //
  // Both re-runs are scoped to the subtrees the PATCH touched: the hooks
  // and the catalog checks are INPUT-shape validators, while untouched
  // stored state legitimately carries recalc output they would reject
  // (e.g. the derived per-slot fields on a saved `combat.carried`).
  // Runs only when every per-field check passed — the handler rejects
  // the batch on any error, so partial-merge diagnostics would just add
  // noise.
  if (errors.length === 0 && validUpdates.length > 0) {
    const merged = structuredClone(character);
    for (const update of validUpdates) {
      applyFieldUpdate(merged, update.field, update.value, update.operation);
    }
    const touched = validUpdates.map((u) => u.field);
    const affectedHooks = FIELDS_WITH_VALIDATION.filter((root) =>
      touchesSubtree(touched, root),
    );
    errors.push(...validateCrossFieldRules(merged, affectedHooks));
    errors.push(...validateRPGRules(merged));
    errors.push(...(await validateCatalogRefs(merged, touched)));
  }

  return { validUpdates, errors };
}

/**
 * True when any updated field path and the given root address the same
 * subtree — the update sits under the root (`attributes.primary.strong`
 * vs `attributes`), at it, or above it (`equipment` wholesale vs
 * `equipment.weapons`). Used to scope merged-state re-validation to what
 * a PATCH actually touched.
 */
function touchesSubtree(touched: string[], root: string): boolean {
  return touched.some(
    (field) =>
      field === root ||
      field.startsWith(`${root}.`) ||
      root.startsWith(`${field}.`),
  );
}

export function skipOnCreation(fieldPath: string, userRole: string): boolean {
  const schema = getFieldSchema(fieldPath);
  if (!schema) return false;

  if (schema.serverControlled) return false;

  if (userRole === "owner") {
    // Fields the owner may seed at creation despite being read-only (or
    // DM-only) afterwards. Secondary attributes are NOT listed: they are
    // server-controlled recalc output — client-supplied values warn and
    // are ignored, never written.
    const creationOverrides = [
      "experience.total",
      "experience.unspent",
      "corruption.temporary",
      "attributes.primary.accurate",
      "attributes.primary.cunning",
      "attributes.primary.discreet",
      "attributes.primary.appealing",
      "attributes.primary.quick",
      "attributes.primary.strong",
      "attributes.primary.vigilant",
      "attributes.primary.resolute",
    ];

    if (creationOverrides.includes(fieldPath)) {
      return true;
    }
  }

  return canAccessField(fieldPath, userRole, "write");
}
