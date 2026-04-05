/**
 * Talent list component override.
 * Renders the character's talents with level indicators and management buttons,
 * or empty add-button slots.
 *
 * Character data shape: talents = LearnedTalent[]
 *   LearnedTalent = { id: string, level: number, source: "sin" | "boon" }
 *
 * Reference data (talent names, descriptions) is fetched lazily from
 * the reference file. For now, the talent id is used as a display name
 * until a reference endpoint exists.
 *
 * @param {string} path - Schema field path (e.g. "talents")
 * @param {object} fieldSchema - Serialized schema field descriptor
 * @param {Array} value - Array of learned talents or undefined
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
export function renderTalentList(path, fieldSchema, value, role) {
  const talents = Array.isArray(value) ? value : [];
  const writable = isWritable(fieldSchema, role);

  const list = document.createElement("ul");
  list.dataset.path = path;

  for (let i = 0; i < talents.length; i++) {
    list.appendChild(renderTalentItem(talents[i], i, writable));
  }

  if (writable) {
    list.appendChild(renderAddSlot(talents.length));
  }

  return list;
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
