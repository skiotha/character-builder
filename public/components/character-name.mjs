/**
 * `<nagara-character-name>` — name banner component override (ADR-017).
 *
 * Renders once: a single native text input carrying `data-path` so the
 * view's leaf binding (ADR-017 §leaf-binding) owns its value — including
 * SSE updates, which `updateFieldValue()` skips while the input is
 * `data-editing`. The element therefore declares no `deps`; taking a
 * `characterName` subscription here would just race the binding.
 *
 * In `view` mode a writable input gets the `edit-enabled` behavior, wired
 * by the element's own `rebuild()` (the view-level sweep skips host
 * subtrees).
 */

import { NagaraElement, componentFactory, isWritable } from "./base.mjs";

class CharacterNameElement extends NagaraElement {
  static deps = [];

  render(character) {
    const { path, fieldSchema, role, mode } = this;
    const writable = isWritable(fieldSchema, role, mode);

    const wrapper = document.createElement("div");
    wrapper.id = "character-name";

    const input = document.createElement("input");
    input.type = "text";
    input.id = `field-${path}`;
    input.name = path;
    input.value = character?.[path] ?? "";
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
      // initEditable() bails without the allowed-role list (same contract
      // form-field.mjs fulfils); omitting it left the name uneditable.
      const roles = Object.entries(fieldSchema.permissions ?? {})
        .filter(([, perms]) => perms?.write)
        .map(([r]) => r);
      if (roles.length) input.dataset.roleAllowed = roles.join(" ");
    }

    wrapper.appendChild(input);
    this.rebuild(wrapper);
  }
}

customElements.define("nagara-character-name", CharacterNameElement);

export const renderCharacterName = componentFactory(CharacterNameElement);
