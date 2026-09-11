/**
 * `<nagara-trait-list>` — learned-traits component override (ADR-017).
 *
 * Rebuilds its list on every `traits` subtree change: each trait renders
 * with tier indicators, followed by an add-trait slot when the field is
 * writable for the current role.
 *
 * Character data shape: traits = LearnedTrait[]
 *   LearnedTrait = { id: string, tier: "novice" | "adept" | "master", source: "ability" | "spell" }
 *
 * Reference data (full name, tier descriptions) is fetched lazily from
 * GET /api/v1/traits?locale=… and cached in module scope; names render as
 * title-cased ids until the library resolves, then are enriched in place.
 * Enrichment re-runs after every rebuild so live updates keep real names.
 *
 * No descendant carries `data-path` — the view's leaf binding
 * (ADR-017 §leaf-binding) owns native controls; the host carries the path.
 */

import { NagaraElement, componentFactory, isWritable } from "./base.mjs";

const TIER_ORDER = ["novice", "adept", "master"];
const TIER_ICONS = {
  novice: "/common/icons/icon-grade-novice.svg",
  adept: "/common/icons/icon-grade-adept.svg",
  master: "/common/icons/icon-grade-master.svg",
};

function currentLocale() {
  const primary = (navigator.language || "en").split("-")[0].toLowerCase();
  return primary === "ru" ? "ru" : "en";
}

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

  libraryPromise = fetch(`/api/v1/traits?locale=${currentLocale()}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Traits fetch failed: ${res.status}`);
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

class TraitListElement extends NagaraElement {
  static deps = ["traits"];

  render(character) {
    const traits = Array.isArray(character?.traits) ? character.traits : [];
    const writable = isWritable(this.fieldSchema, this.role, this.mode);

    const list = document.createElement("ul");

    for (let i = 0; i < traits.length; i++) {
      list.appendChild(renderTraitItem(traits[i], i));
    }

    if (writable) {
      list.appendChild(renderAddSlot(traits.length));
    }

    this.rebuild(list);

    if (traits.length > 0) {
      ensureLibrary().then((lib) => {
        // A later rebuild may have replaced the list; enrich only if still live.
        if (list.isConnected) enrichTraitNames(list, lib);
      });
    }
  }
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

function formatId(id) {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

customElements.define("nagara-trait-list", TraitListElement);

export const renderTraitList = componentFactory(TraitListElement);
