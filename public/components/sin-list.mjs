/**
 * Sin list component override.
 * Renders the character's sins with level indicators and management buttons,
 * or empty add-button slots.
 *
 * Character data shape: sins = LearnedSin[]
 *   LearnedSin = { id: string, level: number }
 *
 * Reference data (sin names, descriptions) is fetched lazily from
 * the reference file. For now, the sin id is used as a display name
 * until a reference endpoint exists.
 *
 * @param {string} path - Schema field path (e.g. "sins")
 * @param {object} fieldSchema - Serialized schema field descriptor
 * @param {Array} value - Array of learned sins or undefined
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
export function renderSinList(path, fieldSchema, value, role) {
  const container = document.createElement("div");
  container.classList.add("sin-list");
  container.dataset.path = path;

  const sins = Array.isArray(value) ? value : [];
  const writable = isWritable(fieldSchema, role);

  const list = document.createElement("ul");

  for (let i = 0; i < sins.length; i++) {
    list.appendChild(renderSinItem(sins[i], i, writable));
  }

  // Always show at least one add slot if writable
  if (writable) {
    list.appendChild(renderAddSlot(sins.length));
  }

  if (sins.length === 0 && !writable) {
    const empty = document.createElement("p");
    empty.classList.add("empty-state");
    empty.textContent = "No sins";
    container.appendChild(empty);
  } else {
    container.appendChild(list);
  }

  return container;
}

/**
 * Render a single sin item with level display and update button.
 * @param {{ id: string, level: number }} sin
 * @param {number} index
 * @param {boolean} writable
 * @returns {HTMLLIElement}
 */
function renderSinItem(sin, index, writable) {
  const li = document.createElement("li");
  li.classList.add("sin");
  li.dataset.sin = String(index);
  li.dataset.sinId = sin.id;

  // Sin name
  const heading = document.createElement("h5");
  heading.textContent = formatId(sin.id);
  li.appendChild(heading);

  // Level display + update button
  const levelGroup = document.createElement("div");

  const output = document.createElement("output");
  output.classList.add("inner");
  output.setAttribute("for", `sin_${index}`);
  output.textContent = String(sin.level);
  levelGroup.appendChild(output);

  if (writable) {
    const button = document.createElement("button");
    button.id = `sin_${index}`;
    button.type = "button";
    button.dataset.level = String(sin.level);
    button.dataset.action = "update-sin-level";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("role", "presentation");
    icon.setAttribute("aria-label", "Increase sin level");
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
 * Render an add-sin button slot.
 * @param {number} index
 * @returns {HTMLLIElement}
 */
function renderAddSlot(index) {
  const li = document.createElement("li");
  li.classList.add("sin");
  li.id = "sin-add";
  li.dataset.sin = String(index);

  const button = document.createElement("button");
  button.id = `sin_${index}`;
  button.type = "button";
  button.dataset.action = "sin-add";
  button.setAttribute("aria-label", "Add sin");

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
