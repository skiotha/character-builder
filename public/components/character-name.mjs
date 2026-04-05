/**
 * Component: character-name
 * Renders the character name banner with a styled input.
 *
 * @param {string} path - "characterName"
 * @param {object} fieldSchema - Schema descriptor
 * @param {*} value - Current character name
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
export function renderCharacterName(path, fieldSchema, value, role) {
  const wrapper = document.createElement("div");
  wrapper.id = "character-name";

  const permissions = fieldSchema.permissions?.[role];
  const writable = permissions?.write ?? false;

  const input = document.createElement("input");
  input.type = "text";
  input.id = `field-${path}`;
  input.name = path;
  input.value = value ?? "";
  input.dataset.path = path;
  input.placeholder = fieldSchema.ui?.placeholder ?? "";
  input.setAttribute("aria-disabled", String(!writable));

  if (writable) {
    input.dataset.behavior = "edit-enabled";
  }

  wrapper.appendChild(input);
  return wrapper;
}
