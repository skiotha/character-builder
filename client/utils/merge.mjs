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
    } else if (!isArray(sourceValue) && isArray(targetValue)) {
      output[key] = [sourceValue];
    } else {
      output[key] = sourceValue;
    }
  });

  return output;
}
