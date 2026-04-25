/**
 * Weapon-slots component override (ADR-014).
 *
 * Renders the 3-element `combat.carried` tuple as three labeled slots:
 *   - Main-hand (carried weapon, optional)
 *   - Off-hand  (carried weapon, optional)
 *   - Own       (innate weapon, required, must have `own` quality)
 *
 * Each slot has a <select> populated from `equipment.weapons[]`. The
 * main-hand and off-hand dropdowns include an "— empty —" option; the
 * own slot is filtered to weapons that carry the `own` quality (the
 * server seeds `natural_weapon` on creation so this list is never empty).
 *
 * On change the whole `combat.carried` tuple is PATCHed back. Per-slot
 * derived fields (`attackAttribute`, `baseDamage`, `bonusDamage`,
 * `qualities`) are pure recalc output — shown read-only below the
 * dropdown but never written.
 */

import * as nagara from "../state.mjs";

const SLOT_LABELS = ["Main-hand", "Off-hand", "Own"];
const EMPTY_OPTION = "— empty —";

const API_BASE = (() => {
  const { protocol, hostname, port } = window.location;
  return `${protocol}//${hostname}${port ? ":" + port : ""}/api/v1`;
})();

export function renderWeaponSlots(path, fieldSchema, value, role, _mode) {
  const carried = Array.isArray(value) ? value : [null, null, null];
  const writable = isWritable(fieldSchema, role);

  const character = nagara.getState().currentCharacter || {};
  const weapons = Array.isArray(character?.equipment?.weapons)
    ? character.equipment.weapons
    : [];

  const root = document.createElement("ol");
  root.classList.add("weapon-slots");
  root.dataset.path = path;

  for (let i = 0; i < 3; i++) {
    root.appendChild(
      renderSlot(i, carried[i], weapons, writable, character.id),
    );
  }

  return root;
}

function renderSlot(index, slot, weapons, writable, characterId) {
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
    select.addEventListener("change", () => onSlotChange(characterId, select));
  }
  li.appendChild(select);

  li.appendChild(renderDerivedDisplay(slot));
  return li;
}

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

async function onSlotChange(characterId, select) {
  const root = select.closest(".weapon-slots");
  if (!root) return;

  const selects = root.querySelectorAll("select[data-slot]");
  const carried = [null, null, null];

  for (const sel of selects) {
    const i = Number(sel.dataset.slot);
    if (sel.value === "") {
      carried[i] = null;
    } else {
      carried[i] = { weaponIndex: Number(sel.value) };
    }
  }

  await patchCarried(characterId, carried);
}

async function patchCarried(characterId, carried) {
  const headers = { "Content-Type": "application/json" };
  const playerToken = nagara.getPlayerToken();
  if (playerToken) headers["x-player-id"] = playerToken;
  const dmToken = nagara.getDMToken();
  if (dmToken) headers["x-dm-id"] = dmToken;

  try {
    const response = await fetch(`${API_BASE}/characters/${characterId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        updates: [{ field: "combat.carried", value: carried }],
      }),
    });
    const result = await response.json();
    if (result.success) {
      nagara.setCurrentCharacter(result.character);
    } else {
      console.error("[weapon-slots] PATCH failed:", result.error);
    }
  } catch (err) {
    console.error("[weapon-slots] PATCH error:", err);
  }
}

function isWritable(fieldSchema, role) {
  if (fieldSchema.serverControlled || fieldSchema.immutable) return false;
  if (fieldSchema.derived) return false;
  if (!fieldSchema.permissions) return false;
  const rolePerms = fieldSchema.permissions[role];
  return !!(rolePerms && rolePerms.write === true);
}
