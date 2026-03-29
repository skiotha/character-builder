import { CHARACTER_SCHEMA } from "./character.mjs";
import { isFieldWritable } from "./utils.mjs";

export function getFieldPathsByProperty(
  propertyName,
  propertyValue = true,
  schema = CHARACTER_SCHEMA,
  path = "",
) {
  const results = [];

  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;

    const currentPath = path ? `${path}.${key}` : key;

    if (fieldSchema[propertyName] === propertyValue) {
      results.push(currentPath);
    }

    if (fieldSchema.type === "object" && !Array.isArray(fieldSchema)) {
      const nestedFields = Object.keys(fieldSchema).filter(
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
            { [nestedKey]: fieldSchema[nestedKey] },
            currentPath,
          ),
        );
      }
    }
  }

  return results;
}

export function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

export function setNestedValue(obj, fieldPath, value) {
  const keys = fieldPath.split(".");
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }

    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

export function getAllFieldPaths(data, prefix = "") {
  const paths = [];

  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...getAllFieldPaths(value, path));
    } else {
      paths.push(path);
    }
  }

  return paths;
}

export function deepMerge(target, source, options = {}) {
  const output = Array.isArray(target) ? [...target] : { ...target };

  if (!source) return output;

  const isArray = (obj) => Array.isArray(obj);

  const isPlainObject = (obj) =>
    obj && typeof obj === "object" && !isArray(obj) && obj !== null;

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key];
    const targetValue = target[key];

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

  return output;
}

export function getWritableFieldPaths(
  role,
  schema = CHARACTER_SCHEMA,
  basePath = "",
  results = [],
) {
  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith("_")) continue;

    const currentPath = basePath ? `${basePath}.${key}` : key;

    if (value.type && !["object", "array"].includes(value.type)) {
      if (isFieldWritable(currentPath, role, schema)) {
        results.push(currentPath);
      }
    } else if (value.type === "object" || value.type === "array") {
      const nestedKeys = Object.keys(value).filter(
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
          { [nestedKey]: value[nestedKey] },
          currentPath,
          results,
        );
      }
    }
  }

  return new Set(results);
}
