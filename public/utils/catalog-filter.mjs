/**
 * Catalog picker filtering — pure search / filter / exclude logic behind
 * `openCatalogDialog` (`public/components/catalog-dialog.mjs`), kept
 * DOM-free so `node:test` covers it.
 *
 * Semantics:
 *   - Search: the query splits on whitespace; every token must occur
 *     (substring) in at least one searchable string of the entry. Both
 *     sides are case- and diacritic-folded, so `"ecole"` finds `"École"`
 *     and `"еж"` finds `"Ёж"`. An empty query matches everything.
 *   - Filters: active predicates are grouped; options are OR-ed within a
 *     group, groups are AND-ed, and an empty group does not restrict.
 *   - Exclude: entries whose `id` is in the set are dropped entirely.
 *
 * The dialog builds each entry's haystack once (`searchHaystack`) and
 * re-runs only `matchesQuery` / `matchesFilters` per keystroke or toggle.
 */

/**
 * @typedef {string | ((entry: object) => unknown)} SearchField
 *   An entry key, or an accessor returning a string or string array
 */

/**
 * Fold text for matching: decompose, strip combining marks, lower-case.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Split a raw query into folded tokens; empty for a blank query.
 * @param {string} query
 * @returns {string[]}
 */
export function parseQuery(query) {
  return normalizeText(query).split(/\s+/u).filter(Boolean);
}

/**
 * Collect an entry's folded searchable strings. Keys read `entry[key]`;
 * accessors are called with the entry. String values are taken as-is,
 * arrays contribute their string elements, anything else is ignored.
 * @param {object} entry
 * @param {SearchField[]} fields
 * @returns {string[]}
 */
export function searchHaystack(entry, fields) {
  /** @type {string[]} */
  const haystack = [];
  for (const field of fields) {
    const value =
      typeof field === "function"
        ? field(entry)
        : /** @type {Record<string, unknown>} */ (entry)[field];
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (typeof item === "string" && item) haystack.push(normalizeText(item));
    }
  }
  return haystack;
}

/**
 * Whether every token occurs in some haystack string.
 * @param {string[]} haystack - From `searchHaystack`
 * @param {string[]} tokens - From `parseQuery`
 * @returns {boolean}
 */
export function matchesQuery(haystack, tokens) {
  return tokens.every((token) => haystack.some((text) => text.includes(token)));
}

/**
 * Whether an entry passes the active filter groups: each non-empty group
 * needs at least one passing predicate.
 * @param {object} entry
 * @param {Array<Array<(entry: object) => boolean>>} groups - Predicates of
 *   the checked options, one array per group
 * @returns {boolean}
 */
export function matchesFilters(entry, groups) {
  return groups.every(
    (predicates) =>
      predicates.length === 0 ||
      predicates.some((predicate) => predicate(entry)),
  );
}

/**
 * Drop entries whose `id` is excluded. Returns a new array in the original
 * order; the input is not mutated.
 * @template {{ id?: unknown }} T
 * @param {T[]} entries
 * @param {Iterable<string> | undefined} exclude
 * @returns {T[]}
 */
export function excludeEntries(entries, exclude) {
  const excluded = new Set(exclude ?? []);
  if (excluded.size === 0) return [...entries];
  return entries.filter(
    (entry) => !(typeof entry.id === "string" && excluded.has(entry.id)),
  );
}
