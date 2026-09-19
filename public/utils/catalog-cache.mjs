/**
 * Module-scope catalog cache shared by the equipment pickers.
 *
 * Each reference catalog (`GET /api/v1/weapons`, `/armor`, …) is fetched
 * once per page life and held for every host that needs it. A failed fetch
 * is remembered in `error` for the current render — so the picker can show
 * an "unavailable" state — and retried on the next `get()`.
 *
 * Consumers read `value` synchronously while rendering and call `get()` to
 * kick off (or await) the fetch; a late resolution must check
 * `this.isConnected` before re-rendering (ADR-017 §render-arg).
 */

/**
 * Create a cache around a catalog fetcher.
 * @param {() => Promise<object[]>} fetcher - e.g. `api.getWeapons`
 * @param {string} label - Human-readable catalog name for error logs
 * @returns {{ get: () => Promise<object[]>, readonly value: object[]|null, readonly error: Error|null }}
 */
export function createCatalogCache(fetcher, label) {
  /** @type {object[]|null} */
  let value = null;
  /** @type {Promise<object[]>|null} */
  let pending = null;
  /** @type {Error|null} */
  let error = null;

  return {
    get() {
      if (value) return Promise.resolve(value);
      if (pending) return pending;

      error = null;
      pending = fetcher()
        .then((entries) => {
          value = Array.isArray(entries) ? entries : [];
          return value;
        })
        .catch((err) => {
          console.error(
            `[catalog-cache] Failed to load ${label} catalog:`,
            err,
          );
          error = err;
          pending = null;
          throw err;
        });
      return pending;
    },
    get value() {
      return value;
    },
    get error() {
      return error;
    },
  };
}
