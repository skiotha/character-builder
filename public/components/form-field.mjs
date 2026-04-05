/**
 * Renders a single form field from schema + data.
 *
 * @param {string} path - Dotted path (e.g. "attributes.primary.strong")
 * @param {object} fieldSchema - Serialized schema field descriptor
 * @param {*} value - Current value for this field
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
export function renderField(path, fieldSchema, value, role) {
  const ui = fieldSchema.ui || {};
  const displayAs = ui.displayAs || inferDisplayAs(fieldSchema);
  const label = ui.label || labelFromPath(path);
  const writable = isWritable(fieldSchema, role);

  const wrapper = document.createElement("div");
  wrapper.classList.add(displayAs === "textarea" ? "textarea" : "input");
  wrapper.dataset.fieldPath = path;

  const labelEl = document.createElement("label");
  labelEl.setAttribute("for", `field-${path}`);
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const control = createControl(displayAs, path, fieldSchema, value, writable);
  wrapper.appendChild(control);

  return wrapper;
}

// ── Control creation by display type ──────────────────────────

function createControl(displayAs, path, fieldSchema, value, writable) {
  switch (displayAs) {
    case "textarea":
      return createTextarea(path, fieldSchema, value, writable);
    case "select":
      return createSelect(path, fieldSchema, value, writable);
    case "readonly":
      return createReadonly(path, fieldSchema, value);
    case "number":
      return createNumberInput(path, fieldSchema, value, writable);
    default:
      return createTextInput(path, fieldSchema, value, writable);
  }
}

function createTextInput(path, fieldSchema, value, writable) {
  const input = document.createElement("input");
  input.type = "text";
  input.id = `field-${path}`;
  input.name = path;
  input.dataset.path = path;
  input.value = value ?? fieldSchema.default ?? "";

  if (fieldSchema.minLength !== undefined)
    input.minLength = fieldSchema.minLength;
  if (fieldSchema.maxLength !== undefined)
    input.maxLength = fieldSchema.maxLength;
  if (fieldSchema.pattern) input.pattern = fieldSchema.pattern;
  if (fieldSchema.required) input.required = true;

  applyPlaceholder(input, fieldSchema);
  applyEditBehavior(input, writable, fieldSchema);

  return input;
}

function createNumberInput(path, fieldSchema, value, writable) {
  const input = document.createElement("input");
  input.type = "number";
  input.id = `field-${path}`;
  input.name = path;
  input.dataset.path = path;
  input.value = value ?? fieldSchema.default ?? 0;

  if (fieldSchema.min !== undefined) input.min = fieldSchema.min;
  if (fieldSchema.max !== undefined) input.max = fieldSchema.max;
  if (fieldSchema.integer) input.step = "1";

  applyPlaceholder(input, fieldSchema);
  applyEditBehavior(input, writable, fieldSchema);

  return input;
}

function createTextarea(path, fieldSchema, value, writable) {
  const textarea = document.createElement("textarea");
  textarea.id = `field-${path}`;
  textarea.name = path;
  textarea.dataset.path = path;
  textarea.value = value ?? fieldSchema.default ?? "";

  if (fieldSchema.minLength !== undefined)
    textarea.minLength = fieldSchema.minLength;
  if (fieldSchema.maxLength !== undefined)
    textarea.maxLength = fieldSchema.maxLength;

  applyPlaceholder(textarea, fieldSchema);
  applyEditBehavior(textarea, writable, fieldSchema);

  return textarea;
}

function createSelect(path, fieldSchema, value, writable) {
  const select = document.createElement("select");
  select.id = `field-${path}`;
  select.name = path;
  select.dataset.path = path;

  const options = fieldSchema.ui?.options || [];
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    if (opt === value) option.selected = true;
    select.appendChild(option);
  }

  applyEditBehavior(select, writable, fieldSchema);

  return select;
}

function createReadonly(path, fieldSchema, value) {
  const output = document.createElement("output");
  output.id = `field-${path}`;
  output.name = path;
  output.dataset.path = path;
  output.value = value ?? fieldSchema.default ?? "";
  output.textContent = value ?? fieldSchema.default ?? "";

  return output;
}

// ── Helpers ───────────────────────────────────────────────────

function applyPlaceholder(el, fieldSchema) {
  const ph = fieldSchema.ui?.placeholder;
  if (ph !== undefined) el.placeholder = ph;
}

function applyEditBehavior(el, writable, fieldSchema) {
  if (writable) {
    el.dataset.behavior = "edit-enabled";
    const roles = getAllowedWriteRoles(fieldSchema);
    if (roles.length) el.dataset.roleAllowed = roles.join(" ");
  } else {
    el.setAttribute("readonly", "");
    el.setAttribute("aria-disabled", "true");
  }
}

function isWritable(fieldSchema, role) {
  if (fieldSchema.serverControlled || fieldSchema.immutable) return false;
  if (fieldSchema.derived) return false;
  if (!fieldSchema.permissions) return false;

  const rolePerms = fieldSchema.permissions[role];
  return rolePerms && rolePerms.write === true;
}

function getAllowedWriteRoles(fieldSchema) {
  if (!fieldSchema.permissions) return [];
  const roles = [];
  for (const [role, perms] of Object.entries(fieldSchema.permissions)) {
    if (perms && perms.write) roles.push(role);
  }
  return roles;
}

function inferDisplayAs(fieldSchema) {
  if (fieldSchema.type === "number" || fieldSchema.type === "integer")
    return "number";
  return "input";
}

function labelFromPath(path) {
  const last = path.split(".").pop();
  return last.charAt(0).toUpperCase() + last.slice(1);
}
