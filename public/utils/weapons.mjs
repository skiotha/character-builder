/**
 * Pure helpers behind the weapons picker (`<nagara-equipment-list>`).
 *
 * DOM-free on purpose so the one non-trivial piece of the picker — keeping
 * `combat.carried` consistent with `equipment.weapons[]` when an entry is
 * removed (ADR-014 slots reference weapons by index) — is covered directly
 * by `node:test` (`test/client-weapons.test.mts`).
 *
 * Invariants:
 * - `projectCatalogWeapon` mirrors the server's engine projection: the
 *   stored entry is exactly what the H.2 catalog validator accepts.
 * - `natural_weapon` is permanent in `equipment.weapons[]`; it is never
 *   offered for adding and is the fallback target of the own slot.
 */

export const NATURAL_WEAPON_ID = "natural_weapon";
const OWN_SLOT = 2;

/**
 * Project a raw catalog entry (`GET /api/v1/weapons`) to the stored
 * `Weapon` shape: `id`, `name`, `type`, `damage`, `qualities`, plus
 * `effects` only when authored non-empty. Presentation-only fields
 * (`description`, `cost`) are dropped.
 * @param {object} entry - Catalog entry as served by the reference API
 * @returns {{ id: string, name: string, type: string, damage: number, qualities: string[], effects?: object[] }}
 */
export function projectCatalogWeapon(entry) {
  const weapon = {
    id: entry.id,
    name: typeof entry.name === "string" ? entry.name : entry.id,
    type: typeof entry.type === "string" ? entry.type : "",
    damage: typeof entry.damage === "number" ? entry.damage : 0,
    qualities: Array.isArray(entry.qualities) ? [...entry.qualities] : [],
  };
  if (Array.isArray(entry.effects) && entry.effects.length > 0) {
    weapon.effects = structuredClone(entry.effects);
  }
  return weapon;
}

/**
 * Reduce a stored `combat.carried` tuple (which carries derived per-slot
 * fields after recalc) to the writable `{ weaponIndex }` entries the
 * server accepts.
 * @param {(object|null)[]|undefined} carried
 * @returns {({ weaponIndex: number }|null)[]} Three entries
 */
export function stripCarried(carried) {
  const out = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const slot = Array.isArray(carried) ? carried[i] : null;
    if (slot && Number.isInteger(slot.weaponIndex)) {
      out[i] = { weaponIndex: slot.weaponIndex };
    }
  }
  return out;
}

/**
 * Re-map `combat.carried` after `equipment.weapons[removedIndex]` was
 * spliced out. Hand slots pointing at the removed weapon become `null`;
 * the own slot falls back to `natural_weapon` in `remainingWeapons`;
 * every index above the removed one shifts down by one.
 * @param {(object|null)[]|undefined} carried - Tuple as stored before the removal
 * @param {number} removedIndex - Index removed from `equipment.weapons`
 * @param {object[]} remainingWeapons - `equipment.weapons` after the splice
 * @returns {({ weaponIndex: number }|null)[]} Stripped tuple for the PATCH
 */
export function remapCarriedAfterRemove(
  carried,
  removedIndex,
  remainingWeapons,
) {
  const stripped = stripCarried(carried);
  const naturalIndex = remainingWeapons.findIndex(
    (weapon) => weapon?.id === NATURAL_WEAPON_ID,
  );

  return stripped.map((slot, i) => {
    if (slot === null) return null;
    if (slot.weaponIndex === removedIndex) {
      // Own slot must never be empty (decision: falls back to the natural
      // weapon); the server would 422 a null own slot.
      return i === OWN_SLOT && naturalIndex >= 0
        ? { weaponIndex: naturalIndex }
        : null;
    }
    if (slot.weaponIndex > removedIndex) {
      return { weaponIndex: slot.weaponIndex - 1 };
    }
    return slot;
  });
}

/**
 * Catalog entries the picker may offer: everything not already present in
 * `equipment.weapons[]` by `id`. Duplicates are legal for the server but
 * meaningless to the player, so they are filtered here.
 * @param {object[]} catalog - Raw catalog entries
 * @param {object[]|undefined} weapons - Stored `equipment.weapons`
 * @returns {object[]} Entries available to add, catalog order preserved
 */
export function availableCatalogEntries(catalog, weapons) {
  const owned = new Set(
    (Array.isArray(weapons) ? weapons : []).map((weapon) => weapon?.id),
  );
  return catalog.filter((entry) => !owned.has(entry.id));
}
