/**
 * Weapon-slots component override (ADR-014, ADR-017).
 *
 * `<nagara-weapon-slots>` renders the 3-element `combat.carried` tuple as
 * three labeled slots:
 *   - Main-hand (carried weapon, optional)
 *   - Off-hand  (carried weapon, optional)
 *   - Own       (innate weapon, required, must have `own` quality)
 *
 * Each slot has a <select> populated from `equipment.weapons[]`. The
 * main-hand and off-hand dropdowns include an "— empty —" option; the
 * own slot is filtered to weapons that carry the `own` quality (the
 * server seeds `natural_weapon` on creation so this list is never empty).
 *
 * On change the whole `combat.carried` tuple is PATCHed back as stripped
 * `{ weaponIndex }` entries; the element re-renders from the response via
 * its deps (ADR-017 §deps). Per-slot derived fields (`attackAttribute`,
 * `baseDamage`, `bonusDamage`, `qualities`) are pure recalc output — shown
 * read-only below the dropdown but never written.
 */

import * as api from "api";
import { setCurrentCharacter } from "../state.mjs";
import { NagaraElement, componentFactory, isWritable } from "./base.mjs";

const SLOT_LABELS = ["Main-hand", "Off-hand", "Own"];
const EMPTY_OPTION = "— empty —";

class WeaponSlotsElement extends NagaraElement {
  static deps = ["combat.carried", "equipment.weapons"];

  render(character) {
    const carried = Array.isArray(character?.combat?.carried)
      ? character.combat.carried
      : [null, null, null];
    const weapons = Array.isArray(character?.equipment?.weapons)
      ? character.equipment.weapons
      : [];
    const writable = isWritable(this.fieldSchema, this.role, this.mode);

    const list = document.createElement("ol");
    list.classList.add("weapon-slots");

    for (let i = 0; i < 3; i++) {
      list.appendChild(this.#renderSlot(i, carried[i], weapons, writable));
    }

    this.rebuild(list);
  }

  #renderSlot(index, slot, weapons, writable) {
    const li = document.createElement("li");
    li.classList.add("weapon-slot");
    li.dataset.slot = String(index);

    const heading = document.createElement("h4");
    heading.textContent = SLOT_LABELS[index];
    li.appendChild(heading);

    const select = document.createElement("select");
    select.dataset.slot = String(index);
    if (!writable) select.disabled = true;

    const isOwnSlot = index === 2;

    if (!isOwnSlot) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = EMPTY_OPTION;
      if (slot === null || slot === undefined) empty.selected = true;
      select.appendChild(empty);
    }

    for (let w = 0; w < weapons.length; w++) {
      const weapon = weapons[w] || {};
      const qualities = Array.isArray(weapon.qualities) ? weapon.qualities : [];
      if (isOwnSlot && !qualities.includes("own")) continue;

      const option = document.createElement("option");
      option.value = String(w);
      option.textContent = weapon.name || `(weapon ${w})`;
      if (slot && slot.weaponIndex === w) option.selected = true;
      select.appendChild(option);
    }

    if (writable) {
      select.addEventListener("change", () => this.#onSlotChange());
    }
    li.appendChild(select);

    li.appendChild(renderDerivedDisplay(slot));
    return li;
  }

  async #onSlotChange() {
    const carried = [null, null, null];

    for (const sel of this.querySelectorAll("select[data-slot]")) {
      const i = Number(sel.dataset.slot);
      carried[i] = sel.value === "" ? null : { weaponIndex: Number(sel.value) };
    }

    try {
      const result = await api.patchCharacter(this.character.id, [
        { field: "combat.carried", value: carried },
      ]);
      // The sheet may have been torn down (and its state cleared) meanwhile.
      if (!this.isConnected) return;
      if (result.success) {
        setCurrentCharacter(result.character);
      } else {
        console.error("[weapon-slots] PATCH failed:", result.error);
      }
    } catch (err) {
      console.error("[weapon-slots] PATCH error:", err);
    }
  }
}

customElements.define("nagara-weapon-slots", WeaponSlotsElement);

/**
 * Registry factory for the `weapon-slots` override.
 * @type {(path: string, fieldSchema: object, value: *, role: string, mode: string, data: object) => WeaponSlotsElement}
 */
export const renderWeaponSlots = componentFactory(WeaponSlotsElement);

function renderDerivedDisplay(slot) {
  const dl = document.createElement("dl");
  dl.classList.add("weapon-slot-derived");

  const fields = [
    ["Attack", slot?.attackAttribute ?? "—"],
    ["Base damage", slot?.baseDamage ?? "—"],
    ["Bonus damage", slot?.bonusDamage ?? 0],
    [
      "Qualities",
      Array.isArray(slot?.qualities) && slot.qualities.length > 0
        ? slot.qualities.join(", ")
        : "—",
    ],
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
