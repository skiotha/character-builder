/**
 * Armor-slot component override (ADR-017).
 *
 * `<nagara-armor-slot>` backs `equipment.armor.body` and
 * `equipment.armor.plug` (schema `ui.component: "armor-slot"`). Each host
 * is one slot: a <select> fed by the armor catalog (`api.getArmor()`,
 * pinned to `CATALOG_LOCALE`) filtered to entries whose `slot` matches the
 * host's path, plus a read-only summary of the stored piece.
 *
 * Choosing an option PATCHes the projected catalog entry (or `null` for
 * "— none —") to the slot path; the element re-renders from the response
 * via its deps (ADR-017 §deps). `qualitiesEffective` on the stored piece
 * is recalc output — displayed, never written.
 *
 * Plug pieces carry `armor: 0`: the engine reads mitigation only from the
 * body piece (ES §secondaries), so a plug contributes solely through its
 * qualities (registry effects, ES §armor-conditions).
 *
 * Deps are `equipment.armor` only — neither weapons nor slots move when a
 * piece changes. In `create` mode the element renders once with a disabled
 * control — pickers are view-mode-only.
 */

import * as api from "api";
import { setCurrentCharacter } from "../state.mjs";
import { NagaraElement, componentFactory, isWritable } from "./base.mjs";
import { createCatalogCache } from "../utils/catalog-cache.mjs";
import {
  armorSlotFromPath,
  catalogEntriesForSlot,
  projectCatalogArmor,
} from "../utils/armor.mjs";

const NONE_OPTION = "— none —";

const armorCatalog = createCatalogCache(api.getArmor, "armor");

class ArmorSlotElement extends NagaraElement {
  static deps = ["equipment.armor"];

  render(character) {
    const slot = armorSlotFromPath(this.path);
    const piece = character?.equipment?.armor?.[slot] ?? null;
    // Decision: pickers are view-mode-only; creation shows the control bare.
    const editable =
      this.mode !== "create" &&
      isWritable(this.fieldSchema, this.role, this.mode);

    const nodes = [this.#renderPicker(slot, piece, editable)];
    const status = this.#renderCatalogStatus();
    if (status) nodes.push(status);
    nodes.push(renderPieceSummary(piece));
    this.rebuild(...nodes);
  }

  #renderPicker(slot, piece, editable) {
    // TODO(armor-acquisition): equipping straight from the catalog is an
    // interim path — the intended model equips from an inventory filled by
    // creation grants, a shop, or DM grants (docs/roadmap.md, Phase 8
    // "Armor acquisition model: inventory → equip").
    const label = document.createElement("label");
    label.classList.add("armor-slot-picker");
    label.append(`${this.fieldSchema?.ui?.label ?? slot} `);

    const select = document.createElement("select");
    select.classList.add("armor-slot-select");
    select.dataset.slot = slot;

    const catalog = armorCatalog.value;
    const entries = catalogEntriesForSlot(catalog, slot);
    const storedId = typeof piece?.id === "string" ? piece.id : null;

    const none = document.createElement("option");
    none.value = "";
    none.textContent =
      catalog && entries.length === 0
        ? `— no ${slot} pieces in catalog —`
        : NONE_OPTION;
    none.selected = storedId === null;
    select.appendChild(none);

    let storedKnown = storedId === null;
    for (const entry of entries) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = describeEntry(entry);
      if (entry.id === storedId) {
        option.selected = true;
        storedKnown = true;
      }
      select.appendChild(option);
    }

    // A stored id the catalog no longer offers (or a catalog still loading)
    // must stay visible and selected rather than silently reading as none.
    if (!storedKnown) {
      const unknown = document.createElement("option");
      unknown.value = storedId;
      unknown.textContent = catalog
        ? `(unknown: ${storedId})`
        : (piece?.name ?? storedId);
      unknown.disabled = Boolean(catalog);
      unknown.selected = true;
      select.appendChild(unknown);
    }

    select.disabled = !editable || !catalog || entries.length === 0;
    if (editable) {
      select.addEventListener("change", () => this.#onChange(select.value));
    }

    label.appendChild(select);
    return label;
  }

  /**
   * Loading / unavailable note while the catalog is not in hand; kicks off
   * the fetch and re-renders once it settles.
   * @returns {HTMLParagraphElement|null}
   */
  #renderCatalogStatus() {
    if (armorCatalog.value) return null;
    const note = document.createElement("p");
    note.classList.add("armor-catalog-status");
    if (armorCatalog.error) {
      note.textContent = "Armor catalog unavailable — choosing is disabled.";
      note.dataset.status = "error";
    } else {
      note.textContent = "Loading armor catalog…";
      note.dataset.status = "loading";
      const rerender = () => {
        if (this.isConnected) this.render(this.character);
      };
      armorCatalog.get().then(rerender, rerender);
    }
    return note;
  }

  async #onChange(catalogId) {
    let value = null;
    if (catalogId !== "") {
      const entry = armorCatalog.value?.find((e) => e.id === catalogId);
      if (!entry) return;
      value = projectCatalogArmor(entry);
    }

    try {
      const result = await api.patchCharacter(this.character.id, [
        { field: this.path, value },
      ]);
      // The sheet may have been torn down (and its state cleared) meanwhile.
      if (!this.isConnected) return;
      if (result.success) {
        setCurrentCharacter(result.character);
      } else {
        console.error("[armor-slot] PATCH failed:", result.error);
      }
    } catch (err) {
      console.error("[armor-slot] PATCH error:", err);
    }
  }
}

customElements.define("nagara-armor-slot", ArmorSlotElement);

/**
 * Registry factory for the `armor-slot` override.
 * @type {(path: string, fieldSchema: object, value: *, role: string, mode: string, data: object) => ArmorSlotElement}
 */
export const renderArmorSlot = componentFactory(ArmorSlotElement);

// ── Helpers ─────────────────────────────────────────────────────

function describeEntry(entry) {
  const qualities = Array.isArray(entry.qualities) ? entry.qualities : [];
  const parts = [`armor ${entry.armor ?? 0}`];
  if (qualities.length > 0) parts.push(qualities.join(", "));
  return `${entry.name ?? entry.id} (${parts.join(" · ")})`;
}

function renderPieceSummary(piece) {
  const dl = document.createElement("dl");
  dl.classList.add("armor-slot-derived");

  const qualities = Array.isArray(piece?.qualitiesEffective)
    ? piece.qualitiesEffective
    : Array.isArray(piece?.qualities)
      ? piece.qualities
      : [];
  const fields = [
    ["Armor", piece ? (piece.armor ?? 0) : "—"],
    ["Qualities", qualities.length > 0 ? qualities.join(", ") : "—"],
  ];

  for (const [label, value] of fields) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  return dl;
}
