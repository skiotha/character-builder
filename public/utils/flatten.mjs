export function flatten(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, key) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      typeof obj[key] === "object" &&
      obj[key] !== null &&
      !Array.isArray(obj[key])
    ) {
      Object.assign(acc, flatten(obj[key], path));
    } else {
      acc[path] = obj[key];
    }

    return acc;
  }, {});
}
