/**
 * Component: character-name
 * Renders the character name banner with a styled input.
 *
 * @param {string} path - "characterName"
 * @param {object} fieldSchema - Schema descriptor
 * @param {*} value - Current character name
 * @param {string} role - "dm" | "owner" | "public"
 * @param {string} mode - "view" | "create"
 * @returns {HTMLElement}
 */
export function renderCharacterName(path, fieldSchema, value, role, mode) {
  const wrapper = document.createElement("div");
  wrapper.id = "character-name";

  const writable =
    mode === "create"
      ? !fieldSchema.serverControlled && !fieldSchema.derived
      : (fieldSchema.permissions?.[role]?.write ?? false);

  const input = document.createElement("input");
  input.type = "text";
  input.id = `field-${path}`;
  input.name = path;
  input.value = value ?? "";
  input.dataset.path = path;
  input.placeholder = fieldSchema.ui?.placeholder ?? "";
  input.setAttribute("aria-disabled", String(!writable));

  if (fieldSchema.minLength !== undefined)
    input.minLength = fieldSchema.minLength;
  if (fieldSchema.maxLength !== undefined)
    input.maxLength = fieldSchema.maxLength;
  if (fieldSchema.required) input.required = true;

  if (writable && mode !== "create") {
    input.dataset.behavior = "edit-enabled";
  }

  wrapper.appendChild(input);
  return wrapper;
}
