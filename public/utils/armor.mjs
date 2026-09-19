/**
 * Pure helpers behind the armor-slot picker (`<nagara-armor-slot>`).
 *
 * DOM-free so the projection and slot filtering are covered directly by
 * `node:test` (`test/client-armor.test.mts`).
 *
 * Invariants:
 * - `projectCatalogArmor` mirrors the server's engine projection: the
 *   stored piece is exactly what the catalog validator accepts
 *   (`id`, `name`, `armor`, `qualities`, optional `effects`).
 * - Plug pieces carry `armor: 0` by convention — the engine reads
 *   mitigation only from the body piece (ES §secondaries); a plug
 *   contributes solely through its qualities.
 */

/**
 * Project a raw catalog entry (`GET /api/v1/armor`) to the stored
 * `ArmorPiece` shape. Presentation-only fields (`description`, `cost`,
 * `slot`) are dropped; `effects` is kept only when authored non-empty.
 * @param {object} entry - Catalog entry as served by the reference API
 * @returns {{ id: string, name: string, armor: number, qualities: string[], effects?: object[] }}
 */
export function projectCatalogArmor(entry) {
  const piece = {
    id: entry.id,
    name: typeof entry.name === "string" ? entry.name : entry.id,
    armor: typeof entry.armor === "number" ? entry.armor : 0,
    qualities: Array.isArray(entry.qualities) ? [...entry.qualities] : [],
  };
  if (Array.isArray(entry.effects) && entry.effects.length > 0) {
    piece.effects = structuredClone(entry.effects);
  }
  return piece;
}

/**
 * Derive the armor slot (`body` | `plug`) from a schema path such as
 * `equipment.armor.body` — the last dotted segment.
 * @param {string|undefined} path
 * @returns {string}
 */
export function armorSlotFromPath(path) {
  const segments = String(path ?? "").split(".");
  return segments[segments.length - 1] ?? "";
}

/**
 * Catalog entries authored for the given slot, in catalog order.
 * @template T
 * @param {T[]|null|undefined} catalog
 * @param {string} slot
 * @returns {T[]}
 */
export function catalogEntriesForSlot(catalog, slot) {
  if (!Array.isArray(catalog)) return [];
  return catalog.filter(
    (entry) => /** @type {{ slot?: string }|null} */ (entry)?.slot === slot,
  );
}
