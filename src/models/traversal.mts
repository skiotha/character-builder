import { isFieldWritable } from "./schema-utils.mts";

import { CHARACTER_SCHEMA } from "./character.mts";

export function getFieldPathsByProperty(
  propertyName: string,
  propertyValue: unknown,
  schema: Record<string, unknown> = CHARACTER_SCHEMA,
  path: string = "",
): string[] {
  const results: string[] = [];

  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;

    const currentPath = path ? `${path}.${key}` : key;
    const field = fieldSchema as Record<string, unknown>;

    const matches =
      propertyValue === undefined
        ? field[propertyName] !== undefined
        : field[propertyName] === propertyValue;

    if (matches) {
      results.push(currentPath);
    }

    if (field.type === "object" && !Array.isArray(field)) {
      const nestedFields = Object.keys(field).filter(
        (k) =>
          ![
            "type",
            "required",
            "serverControlled",
            "permissions",
            "default",
            "validate",
            "error",
          ].includes(k),
      );

      for (const nestedKey of nestedFields) {
        results.push(
          ...getFieldPathsByProperty(
            propertyName,
            propertyValue,
            { [nestedKey]: field[nestedKey] } as Record<string, unknown>,
            currentPath,
          ),
        );
      }
    }
  }

  return results;
}

export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function setNestedValue(
  obj: Record<string, unknown>,
  fieldPath: string,
  value: unknown,
): void {
  const keys = fieldPath.split(".");
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;

    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]!] = value;
}

export function getAllFieldPaths(
  data: Record<string, unknown>,
  prefix: string = "",
): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...getAllFieldPaths(value as Record<string, unknown>, path));
    } else {
      paths.push(path);
    }
  }

  return paths;
}

interface DeepMergeOptions {
  skipUndefined?: boolean;
}

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown> | null | undefined,
  options: DeepMergeOptions = {},
): T {
  const output: Record<string, unknown> = { ...target };

  if (!source) return output as T;

  const isArray = (obj: unknown): obj is unknown[] => Array.isArray(obj);

  const isPlainObject = (obj: unknown): obj is Record<string, unknown> =>
    obj !== null && typeof obj === "object" && !isArray(obj);

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = (target as Record<string, unknown>)[key];

    if (options.skipUndefined && sourceValue === undefined) {
      return;
    }

    if (isArray(sourceValue)) {
      output[key] = [...sourceValue];
    } else if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      output[key] = deepMerge(targetValue, sourceValue, options);
    } else {
      output[key] = sourceValue;
    }
  });

  return output as T;
}

export function getWritableFieldPaths(
  role: string,
  schema: Record<string, unknown> = CHARACTER_SCHEMA,
  basePath: string = "",
  results: string[] = [],
): Set<string> {
  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;

    const currentPath = basePath ? `${basePath}.${key}` : key;
    const field = value as Record<string, unknown>;

    if (field.type && !["object", "array"].includes(field.type as string)) {
      if (isFieldWritable(currentPath, role, schema)) {
        results.push(currentPath);
      }
    } else if (field.type === "object" || field.type === "array") {
      const nestedKeys = Object.keys(field).filter(
        (k) =>
          ![
            "type",
            "required",
            "serverControlled",
            "generated",
            "immutable",
            "permissions",
            "default",
            "validate",
            "error",
            "ui",
            "sanitize",
            "min",
            "max",
            "minLength",
            "maxLength",
            "pattern",
            "integer",
            "derived",
          ].includes(k),
      );

      for (const nestedKey of nestedKeys) {
        getWritableFieldPaths(
          role,
          { [nestedKey]: field[nestedKey] } as Record<string, unknown>,
          currentPath,
          results,
        );
      }
    }
  }

  return new Set(results);
}
