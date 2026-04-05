/**
 * Ability list component override.
 * Renders the character's learned abilities with tier indicators,
 * or an empty add-button slot when the list is empty.
 *
 * Character data shape: abilities = LearnedAbility[]
 *   LearnedAbility = { id: string, tier: "novice" | "adept" | "master" }
 *
 * Reference data (full name, descriptions) is fetched lazily from
 * GET /api/v1/abilities and cached in module scope.
 *
 * @param {string} path - Schema field path (e.g. "abilities")
 * @param {object} fieldSchema - Serialized schema field descriptor
 * @param {Array} value - Array of learned abilities or undefined
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */

const TIER_ORDER = ["novice", "adept", "master"];
const TIER_ICONS = {
  novice: "/common/icons/icon-grade-novice.svg",
  adept: "/common/icons/icon-grade-adept.svg",
  master: "/common/icons/icon-grade-master.svg",
};

/** @type {Map<string, object>|null} */
let abilityLibrary = null;
let libraryPromise = null;

/**
 * Fetch and cache the full ability reference library.
 * @returns {Promise<Map<string, object>>}
 */
async function ensureLibrary() {
  if (abilityLibrary) return abilityLibrary;
  if (libraryPromise) return libraryPromise;

  libraryPromise = fetch("/api/v1/abilities")
    .then((res) => {
      if (!res.ok) throw new Error(`Abilities fetch failed: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      abilityLibrary = new Map();
      for (const ability of data) {
        abilityLibrary.set(ability.id, ability);
      }
      return abilityLibrary;
    })
    .catch((err) => {
      console.error("[ability-list] Failed to load library:", err);
      libraryPromise = null;
      return new Map();
    });

  return libraryPromise;
}

export function renderAbilityList(path, fieldSchema, value, role) {
  const container = document.createElement("div");
  container.classList.add("ability-list");
  container.dataset.path = path;

  const abilities = Array.isArray(value) ? value : [];
  const writable = isWritable(fieldSchema, role);

  if (abilities.length === 0) {
    container.appendChild(renderEmptyState(writable, 0));
  } else {
    const list = document.createElement("ul");

    for (let i = 0; i < abilities.length; i++) {
      list.appendChild(renderAbilityItem(abilities[i], i));
    }

    if (writable) {
      list.appendChild(renderAddSlot(abilities.length));
    }

    container.appendChild(list);
  }

  // Kick off library fetch to enrich names asynchronously
  if (abilities.length > 0) {
    ensureLibrary().then((lib) => enrichAbilityNames(container, lib));
  }

  return container;
}

/**
 * Render a single ability item with tier indicators.
 * @param {{ id: string, tier: string }} ability
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function renderAbilityItem(ability, index) {
  const li = document.createElement("li");
  li.classList.add("ability");
  li.dataset.ability = String(index);
  li.dataset.abilityId = ability.id;

  const heading = document.createElement("h4");
  heading.classList.add("ability-name");
  // Display id as title-case until library resolves the real name
  heading.textContent = formatId(ability.id);
  li.appendChild(heading);

  const tierList = document.createElement("ol");
  tierList.classList.add("ability-tiers");

  const activeTierIndex = TIER_ORDER.indexOf(ability.tier);

  for (let t = 0; t < TIER_ORDER.length; t++) {
    const tierName = TIER_ORDER[t];
    const tierItem = document.createElement("li");
    const isActive = t <= activeTierIndex;

    if (!isActive) {
      tierItem.classList.add("inactive");
    }

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", `${tierName} tier`);

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", TIER_ICONS[tierName]);
    icon.appendChild(use);
    tierItem.appendChild(icon);

    // Tier description placeholder — enriched after library loads
    const desc = document.createElement("p");
    desc.classList.add("tier-description");
    desc.dataset.tier = tierName;
    tierItem.appendChild(desc);

    tierList.appendChild(tierItem);
  }

  li.appendChild(tierList);
  return li;
}

/**
 * Render an empty state with an add button.
 * @param {boolean} writable
 * @param {number} index
 * @returns {HTMLElement}
 */
function renderEmptyState(writable, index) {
  if (!writable) {
    const empty = document.createElement("p");
    empty.classList.add("empty-state");
    empty.textContent = "No abilities learned";
    return empty;
  }
  const list = document.createElement("ul");
  list.appendChild(renderAddSlot(index));
  return list;
}

/**
 * Render an add-ability button slot.
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function renderAddSlot(index) {
  const li = document.createElement("li");
  li.id = "ability-add";
  li.classList.add("ability");
  li.dataset.ability = String(index);

  const button = document.createElement("button");
  button.id = `ability_${index}`;
  button.type = "button";
  button.dataset.action = "ability-add";
  button.setAttribute("aria-label", "Add ability");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "/common/icons/icon-plus-3.svg");
  icon.appendChild(use);
  button.appendChild(icon);

  li.appendChild(button);
  return li;
}

/**
 * After the ability library loads, update displayed names and tier descriptions.
 * @param {HTMLElement} container
 * @param {Map<string, object>} lib
 */
function enrichAbilityNames(container, lib) {
  const items = container.querySelectorAll("li.ability[data-ability-id]");

  for (const item of items) {
    const id = item.dataset.abilityId;
    const ref = lib.get(id);
    if (!ref) continue;

    // Update name
    const heading = item.querySelector(".ability-name");
    if (heading && ref.name) {
      heading.textContent = ref.name;
    }

    // Update tier descriptions
    if (ref.tiers) {
      for (const tierName of TIER_ORDER) {
        const tierData = ref.tiers[tierName];
        const descEl = item.querySelector(
          `.tier-description[data-tier="${tierName}"]`,
        );
        if (descEl && tierData?.description) {
          descEl.textContent = tierData.description;
        }
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────

function isWritable(fieldSchema, role) {
  if (fieldSchema.serverControlled || fieldSchema.immutable) return false;
  if (fieldSchema.derived) return false;
  if (!fieldSchema.permissions) return false;
  const rolePerms = fieldSchema.permissions[role];
  return rolePerms && rolePerms.write === true;
}

function formatId(id) {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
