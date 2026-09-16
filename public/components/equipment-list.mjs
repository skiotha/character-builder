/**
 * Equipment-list component override (ADR-017).
 *
 * `<nagara-equipment-list>` backs every schema field with
 * `ui.component: "equipment-list"`. It branches on `this.path`:
 *
 *   - `equipment.weapons` — the weapons picker: the stored list with slot
 *     badges and remove controls, plus an add row fed by the weapons
 *     catalog (`api.getWeapons()`, pinned to `CATALOG_LOCALE`). Removing a
 *     weapon re-maps `combat.carried` in the **same** PATCH so the slot
 *     tuple never dangles (ADR-014; the handler's all-or-nothing 422 keeps
 *     it atomic). `natural_weapon` is permanent and never removable.
 *   - every other path — a read-only placeholder listing the stored
 *     entries; these free-form arrays have no catalog or editor yet.
 *
 * Deps are `equipment` and `combat.carried`: the badges read the tuple and
 * the picker must re-render when either side changes. In `create` mode the
 * element renders once with no controls — pickers are view-mode-only.
 *
 * Catalog data is cached at module scope (one fetch per page life); a late
 * response checks `this.isConnected` before re-rendering.
 */

import * as api from "api";
import { setCurrentCharacter } from "../state.mjs";
import { NagaraElement, componentFactory, isWritable } from "./base.mjs";
import {
  availableCatalogEntries,
  projectCatalogWeapon,
  remapCarriedAfterRemove,
  NATURAL_WEAPON_ID,
} from "../utils/weapons.mjs";

const WEAPONS_PATH = "equipment.weapons";
const SLOT_LABELS = ["Main-hand", "Off-hand", "Own"];
const EMPTY_TEXT = "— empty —";

/** @type {object[]|null} */
let catalog = null;
/** @type {Promise<object[]>|null} */
let catalogPromise = null;
/** @type {Error|null} */
let catalogError = null;

/**
 * Fetch the weapons catalog once; a failure is remembered for the current
 * render and retried on the next one.
 * @returns {Promise<object[]>}
 */
function ensureCatalog() {
  if (catalog) return Promise.resolve(catalog);
  if (catalogPromise) return catalogPromise;

  catalogError = null;
  catalogPromise = api
    .getWeapons()
    .then((entries) => {
      catalog = Array.isArray(entries) ? entries : [];
      return catalog;
    })
    .catch((err) => {
      console.error("[equipment-list] Failed to load weapons catalog:", err);
      catalogError = err;
      catalogPromise = null;
      throw err;
    });
  return catalogPromise;
}

class EquipmentListElement extends NagaraElement {
  static deps = ["equipment", "combat.carried"];

  render(character) {
    // Private arrays are stripped server-side for roles without read; keep
    // the host empty rather than showing a placeholder for nothing.
    if (this.fieldSchema?.permissions?.[this.role]?.read === false) {
      this.rebuild();
      return;
    }

    if (this.path === WEAPONS_PATH) {
      this.#renderWeapons(character);
    } else {
      this.#renderPlaceholder(character);
    }
  }

  // ── Weapons picker ────────────────────────────────────────────

  #renderWeapons(character) {
    const weapons = Array.isArray(character?.equipment?.weapons)
      ? character.equipment.weapons
      : [];
    const carried = Array.isArray(character?.combat?.carried)
      ? character.combat.carried
      : [];
    // Decision: pickers are view-mode-only; creation shows the list bare.
    const editable =
      this.mode !== "create" &&
      isWritable(this.fieldSchema, this.role, this.mode);

    const list = document.createElement("ul");
    list.classList.add("weapon-list");
    weapons.forEach((weapon, index) => {
      list.appendChild(this.#renderWeaponRow(weapon, index, carried, editable));
    });
    if (weapons.length === 0) list.appendChild(emptyItem());

    const nodes = [list];
    if (editable) nodes.push(this.#renderAddRow(weapons));
    this.rebuild(...nodes);
  }

  #renderWeaponRow(weapon, index, carried, editable) {
    const li = document.createElement("li");
    li.classList.add("weapon-row");
    li.dataset.weaponIndex = String(index);

    const name = document.createElement("strong");
    name.classList.add("weapon-name");
    name.textContent = weapon?.name || weapon?.id || `(weapon ${index})`;
    li.appendChild(name);

    const meta = document.createElement("small");
    meta.classList.add("weapon-meta");
    const qualities = Array.isArray(weapon?.qualities) ? weapon.qualities : [];
    meta.textContent = [
      weapon?.type || "?",
      `dmg ${weapon?.damage ?? "?"}`,
      qualities.length > 0 ? qualities.join(", ") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    li.appendChild(meta);

    for (let slot = 0; slot < SLOT_LABELS.length; slot++) {
      if (carried[slot]?.weaponIndex !== index) continue;
      const badge = document.createElement("span");
      badge.classList.add("weapon-slot-badge");
      badge.dataset.slot = String(slot);
      badge.textContent = SLOT_LABELS[slot];
      li.appendChild(badge);
    }

    if (editable && weapon?.id !== NATURAL_WEAPON_ID) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.classList.add("weapon-remove");
      remove.dataset.action = "remove";
      remove.setAttribute("aria-label", `Remove ${name.textContent}`);
      remove.textContent = "Remove";
      remove.addEventListener("click", () => this.#removeWeapon(index));
      li.appendChild(remove);
    }

    return li;
  }

  #renderAddRow(weapons) {
    // TODO(weapon-acquisition): adding straight from the catalog is an
    // interim path — the intended model equips from an inventory filled by
    // creation grants, a shop, or DM grants (docs/roadmap.md, Phase 8
    // "Weapon acquisition model: inventory → equip").
    const row = document.createElement("div");
    row.classList.add("weapon-add");

    if (!catalog) {
      const note = document.createElement("p");
      note.classList.add("weapon-catalog-status");
      if (catalogError) {
        note.textContent = "Weapon catalog unavailable — adding is disabled.";
        note.dataset.status = "error";
      } else {
        note.textContent = "Loading weapon catalog…";
        note.dataset.status = "loading";
        ensureCatalog()
          .then(() => {
            if (this.isConnected) this.render(this.character);
          })
          .catch(() => {
            if (this.isConnected) this.render(this.character);
          });
      }
      row.appendChild(note);
      return row;
    }

    const available = availableCatalogEntries(catalog, weapons);

    const label = document.createElement("label");
    label.textContent = "Add weapon ";
    const select = document.createElement("select");
    select.classList.add("weapon-add-select");
    select.disabled = available.length === 0;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent =
      available.length === 0 ? "— all weapons owned —" : "— choose —";
    placeholder.selected = true;
    select.appendChild(placeholder);

    for (const [type, entries] of groupByType(available)) {
      const group = document.createElement("optgroup");
      group.label = type;
      for (const entry of entries) {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = `${entry.name} (${entry.damage})`;
        group.appendChild(option);
      }
      select.appendChild(group);
    }
    label.appendChild(select);
    row.appendChild(label);

    const add = document.createElement("button");
    add.type = "button";
    add.classList.add("weapon-add-button");
    add.dataset.action = "add";
    add.textContent = "Add";
    add.disabled = true;
    select.addEventListener("change", () => {
      add.disabled = select.value === "";
    });
    add.addEventListener("click", () => {
      if (select.value === "") return;
      this.#addWeapon(select.value);
    });
    row.appendChild(add);

    return row;
  }

  async #addWeapon(catalogId) {
    const entry = catalog?.find((e) => e.id === catalogId);
    if (!entry) return;
    const weapons = Array.isArray(this.character?.equipment?.weapons)
      ? this.character.equipment.weapons
      : [];
    if (weapons.some((w) => w?.id === catalogId)) return;

    await this.#patch([
      {
        field: WEAPONS_PATH,
        value: [...weapons, projectCatalogWeapon(entry)],
      },
    ]);
  }

  async #removeWeapon(index) {
    const weapons = Array.isArray(this.character?.equipment?.weapons)
      ? this.character.equipment.weapons
      : [];
    const target = weapons[index];
    if (!target || target.id === NATURAL_WEAPON_ID) return;

    const remaining = weapons.filter((_, i) => i !== index);
    const carried = remapCarriedAfterRemove(
      this.character?.combat?.carried,
      index,
      remaining,
    );

    await this.#patch([
      { field: WEAPONS_PATH, value: remaining },
      { field: "combat.carried", value: carried },
    ]);
  }

  /**
   * Send one PATCH and adopt the server's character on success; the state
   * update re-renders this host and `<nagara-weapon-slots>` via deps.
   * @param {{ field: string, value: * }[]} updates
   */
  async #patch(updates) {
    try {
      const result = await api.patchCharacter(this.character.id, updates);
      // The sheet may have been torn down (and its state cleared) meanwhile.
      if (!this.isConnected) return;
      if (result.success) {
        setCurrentCharacter(result.character);
      } else {
        console.error("[equipment-list] PATCH failed:", result.error);
      }
    } catch (err) {
      console.error("[equipment-list] PATCH error:", err);
    }
  }

  // ── Free-form placeholder ─────────────────────────────────────

  #renderPlaceholder(character) {
    // TODO(equipment-catalogs): these arrays are display-only until they
    // get catalogs or structured editors (docs/roadmap.md, Phase 8
    // "Catalogs or structured editors for the free-form equipment
    // arrays"); the runes catalog specifically is NB-14.
    const value = getNestedValue(character, this.path);
    const entries = Array.isArray(value) ? value : [];

    const list = document.createElement("ul");
    list.classList.add("equipment-placeholder");
    for (const entry of entries) {
      const li = document.createElement("li");
      li.textContent = describeEntry(entry);
      list.appendChild(li);
    }
    if (entries.length === 0) list.appendChild(emptyItem());

    const note = document.createElement("p");
    note.classList.add("equipment-placeholder-note");
    note.textContent = "Not editable yet.";

    this.rebuild(list, note);
  }
}

customElements.define("nagara-equipment-list", EquipmentListElement);

/**
 * Registry factory for the `equipment-list` override.
 * @type {(path: string, fieldSchema: object, value: *, role: string, mode: string, data: object) => EquipmentListElement}
 */
export const renderEquipmentList = componentFactory(EquipmentListElement);

// ── Helpers ─────────────────────────────────────────────────────

function emptyItem() {
  const li = document.createElement("li");
  li.classList.add("empty");
  li.textContent = EMPTY_TEXT;
  return li;
}

function describeEntry(entry) {
  if (entry === null || entry === undefined) return EMPTY_TEXT;
  if (typeof entry !== "object") return String(entry);
  return entry.name || entry.id || JSON.stringify(entry);
}

function groupByType(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const type = entry.type || "other";
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(entry);
  }
  return groups;
}

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((cur, key) => cur && cur[key], obj);
}
