/**
 * `<nagara-talent-list>` — learned-talents component override (ADR-017).
 *
 * Rebuilds its list on every `talents` subtree change: each talent renders
 * with its level and, when writable for the current role, a level-up
 * button; a trailing add-talent slot appears for writable roles.
 *
 * Character data shape: talents = LearnedTalent[]
 *   LearnedTalent = { id: string, level: number, source: "sin" | "boon" }
 *
 * Talent ids are shown title-cased until a talent reference endpoint is
 * wired into the client.
 *
 * No descendant carries `data-path` — the level `output` is display-only
 * here; the view's leaf binding (ADR-017 §leaf-binding) owns native
 * controls and the host carries the path.
 */

import { NagaraElement, componentFactory, isWritable } from "./base.mjs";

class TalentListElement extends NagaraElement {
  static deps = ["talents"];

  render(character) {
    const talents = Array.isArray(character?.talents) ? character.talents : [];
    const writable = isWritable(this.fieldSchema, this.role, this.mode);

    const list = document.createElement("ul");

    for (let i = 0; i < talents.length; i++) {
      list.appendChild(renderTalentItem(talents[i], i, writable));
    }

    if (writable) {
      list.appendChild(renderAddSlot(talents.length));
    }

    this.rebuild(list);
  }
}

/**
 * Render a single talent item with level display and update button.
 * @param {{ id: string, level: number, source: string }} talent
 * @param {number} index
 * @param {boolean} writable
 * @returns {HTMLLIElement}
 */
function renderTalentItem(talent, index, writable) {
  const li = document.createElement("li");
  li.classList.add("talent");
  li.dataset.talent = String(index);
  li.dataset.talentId = talent.id;

  // Talent name
  const heading = document.createElement("h5");
  heading.textContent = formatId(talent.id);
  li.appendChild(heading);

  // Level display + update button
  const levelGroup = document.createElement("div");

  const output = document.createElement("output");
  output.classList.add("inner");
  output.setAttribute("for", `talent_${index}`);
  output.textContent = String(talent.level);
  levelGroup.appendChild(output);

  if (writable) {
    const button = document.createElement("button");
    button.id = `talent_${index}`;
    button.type = "button";
    button.dataset.level = String(talent.level);
    button.dataset.action = "update-talent-level";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("role", "presentation");
    icon.setAttribute("aria-label", "Increase talent level");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "/common/icons/icon-up-2.svg");
    icon.appendChild(use);
    button.appendChild(icon);

    levelGroup.appendChild(button);
  }

  li.appendChild(levelGroup);

  return li;
}

/**
 * Render an add-talent button slot.
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function renderAddSlot(index) {
  const li = document.createElement("li");
  li.classList.add("talent");
  li.id = "talent-add";
  li.dataset.talent = String(index);

  const button = document.createElement("button");
  button.id = `talent_${index}`;
  button.type = "button";
  button.dataset.action = "talent-add";
  button.setAttribute("aria-label", "Add talent");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "/common/icons/icon-plus-2.svg");
  icon.appendChild(use);
  button.appendChild(icon);

  li.appendChild(button);
  return li;
}

// ── Helpers ───────────────────────────────────────────────────

function formatId(id) {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

customElements.define("nagara-talent-list", TalentListElement);

export const renderTalentList = componentFactory(TalentListElement);
