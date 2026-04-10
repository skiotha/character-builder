/**
 * Trait list component override.
 * Renders the character's learned traits with tier indicators,
 * or an empty add-button slot when the list is empty.
 *
 * Character data shape: traits = LearnedTrait[]
 *   LearnedTrait = { id: string, tier: "novice" | "adept" | "master", source: "ability" | "spell" }
 *
 * Reference data (full name, descriptions) is fetched lazily from
 * GET /api/v1/abilities and cached in module scope.
 *
 * @param {string} path - Schema field path (e.g. "traits")
 * @param {object} fieldSchema - Serialized schema field descriptor
 * @param {Array} value - Array of learned traits or undefined
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
let traitLibrary = null;
let libraryPromise = null;

/**
 * Fetch and cache the full trait reference library.
 * @returns {Promise<Map<string, object>>}
 */
async function ensureLibrary() {
  if (traitLibrary) return traitLibrary;
  if (libraryPromise) return libraryPromise;

  libraryPromise = fetch("/api/v1/abilities")
    .then((res) => {
      if (!res.ok) throw new Error(`Abilities fetch failed: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      traitLibrary = new Map();
      for (const trait of data) {
        traitLibrary.set(trait.id, trait);
      }
      return traitLibrary;
    })
    .catch((err) => {
      console.error("[trait-list] Failed to load library:", err);
      libraryPromise = null;
      return new Map();
    });

  return libraryPromise;
}

export function renderTraitList(path, fieldSchema, value, role, mode) {
  const traits = Array.isArray(value) ? value : [];
  const writable = isWritable(fieldSchema, role);

  const list = document.createElement("ul");
  list.dataset.path = path;

  for (let i = 0; i < traits.length; i++) {
    list.appendChild(renderTraitItem(traits[i], i));
  }

  if (writable) {
    list.appendChild(renderAddSlot(traits.length));
  }

  // Kick off library fetch to enrich names asynchronously
  if (traits.length > 0) {
    ensureLibrary().then((lib) => enrichTraitNames(list, lib));
  }

  return list;
}

/**
 * Render a single trait item with tier indicators.
 * @param {{ id: string, tier: string, source: string }} trait
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function renderTraitItem(trait, index) {
  const li = document.createElement("li");
  li.classList.add("trait");
  li.dataset.trait = String(index);
  li.dataset.traitId = trait.id;

  const heading = document.createElement("h4");
  heading.classList.add("trait-name");
  // Display id as title-case until library resolves the real name
  heading.textContent = formatId(trait.id);
  li.appendChild(heading);

  const tierList = document.createElement("ol");
  tierList.classList.add("trait-tiers");

  const activeTierIndex = TIER_ORDER.indexOf(trait.tier);

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
 * Render an add-trait button slot.
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function renderAddSlot(index) {
  const li = document.createElement("li");
  li.id = "trait-add";
  li.classList.add("trait");
  li.dataset.trait = String(index);

  const button = document.createElement("button");
  button.id = `trait_${index}`;
  button.type = "button";
  button.dataset.action = "trait-add";
  button.setAttribute("aria-label", "Add trait");

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
 * After the trait library loads, update displayed names and tier descriptions.
 * @param {HTMLElement} container
 * @param {Map<string, object>} lib
 */
function enrichTraitNames(container, lib) {
  const items = container.querySelectorAll("li.trait[data-trait-id]");

  for (const item of items) {
    const id = item.dataset.traitId;
    const ref = lib.get(id);
    if (!ref) continue;

    // Update name
    const heading = item.querySelector(".trait-name");
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
