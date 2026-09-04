/**
 * Structural change detection for character state (ADR-017 §structural-diff).
 *
 * DOM-free on purpose: `state.mjs` feeds every incoming character through
 * `changedPaths` to decide which subscribers to notify, and the module is
 * covered directly by `node:test` (`test/client-diff.test.mts`).
 *
 * Invariants:
 * - Leaves are compared structurally, so fresh JSON with identical content
 *   produces no changes (the SSE echo of an own PATCH is a no-op).
 * - Arrays are leaves: a change anywhere inside an array reports the array's
 *   path, never an index path.
 * - Every changed leaf bubbles to all of its ancestors and to the root `""`,
 *   each reported once, so subtree subscribers hear about deep changes.
 * - Top-level `_`-prefixed keys are transport metadata and never diffed.
 */

/**
 * Deep structural equality over JSON values.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const key of aKeys) {
    if (!Object.hasOwn(b, key) || !deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Collect the dotted paths of leaves that differ between two subtrees.
 * @param {*} oldValue
 * @param {*} newValue
 * @param {string} prefix
 * @param {string[]} out
 */
function collectChangedLeaves(oldValue, newValue, prefix, out) {
  const oldIsObject = isPlainObject(oldValue);
  const newIsObject = isPlainObject(newValue);

  if (oldIsObject || newIsObject) {
    // A subtree that appears, vanishes or is replaced by a primitive still
    // reports its leaves, so leaf subscribers beneath it are notified.
    const oldObj = oldIsObject ? oldValue : {};
    const newObj = newIsObject ? newValue : {};
    const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

    if (keys.size === 0) {
      if (!deepEqual(oldValue, newValue)) out.push(prefix);
      return;
    }

    for (const key of keys) {
      if (prefix === "" && key.startsWith("_")) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      collectChangedLeaves(oldObj[key], newObj[key], path, out);
    }
    return;
  }

  if (!deepEqual(oldValue, newValue)) out.push(prefix);
}

/**
 * Compute the notification set for a state transition: every changed leaf
 * path, then every ancestor of a changed leaf (deepest first), then the
 * root `""`. Empty when nothing changed.
 * @param {object | null | undefined} oldChar - Previous character (may be absent)
 * @param {object} newChar - Incoming character
 * @returns {string[]} Ordered, de-duplicated paths
 */
export function changedPaths(oldChar, newChar) {
  const leaves = [];
  collectChangedLeaves(oldChar ?? {}, newChar ?? {}, "", leaves);

  if (leaves.length === 0) return [];

  const ancestors = new Map();
  for (const leaf of leaves) {
    const parts = leaf.split(".");
    for (let depth = parts.length - 1; depth > 0; depth--) {
      const ancestor = parts.slice(0, depth).join(".");
      if (!ancestors.has(ancestor)) ancestors.set(ancestor, depth);
    }
  }

  const orderedAncestors = [...ancestors.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([path]) => path);

  return [...leaves, ...orderedAncestors, ""];
}
