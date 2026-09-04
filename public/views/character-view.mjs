import * as api from "api";
import * as sse from "../sse/characterStream.mjs";
import { enhanceElement, cleanupBehaviors } from "../behaviors/index.mjs";
import { renderCharacterForm } from "../renderers/form-renderer.mjs";
import {
  subscribeField,
  setPlayerRole,
  setCurrentCharacter,
} from "../state.mjs";
import { updateFieldValue, createViewNav } from "../utils/dom.mjs";

// Only native controls are bound to the leaf update path (ADR-017 §leaf-binding);
// component hosts manage their own updates.
const LEAF_CONTROL_SELECTOR =
  "input[data-path], select[data-path], textarea[data-path], output[data-path]";

export async function renderCharacter(container, params) {
  try {
    container.innerHTML = "<div>Loading character screen</div>";

    const characterId = params.id;

    const [schema, characterData] = await Promise.all([
      api.getSchema(),
      api.getCharacter(characterId),
    ]);

    const role = characterData._permissions?.role || "public";
    const form = renderCharacterForm(schema, characterData, role, "view");

    container.setAttribute("id", "character-view");
    container.innerHTML = "";

    // Nav for anchor positioning (character-name uses --main)
    container.appendChild(createViewNav());

    container.appendChild(form);

    setCurrentCharacter(characterData);
    setPlayerRole(role);
    bindFieldsToState(container);
    enhanceElement(container);
    sse.connectCharacterStream(characterId);
  } catch (error) {
    console.error("Failed to render character view:", error);
    container.innerHTML = `
      <div class="error">
        <h2>Failed to load</h2>
        <p>${error.message}</p>
      </div>
    `;
  }
  return () => {
    setPlayerRole("public");
    detachCharacterViewListeners(container);
    cleanupBehaviors(container);
    sse.disconnectCharacterStream();
  };
}

function detachCharacterViewListeners(container) {
  container.querySelectorAll(LEAF_CONTROL_SELECTOR).forEach((field) => {
    if (field._unsubscribe) {
      field._unsubscribe();
      delete field._unsubscribe;
    }
  });
}

function bindFieldsToState(container) {
  const fields = container.querySelectorAll(LEAF_CONTROL_SELECTOR);

  fields.forEach((field) => {
    const path = field.dataset.path;

    if (field._unsubscribe) field._unsubscribe();

    const unsubscribe = subscribeField(path, (newValue, path, fullCharacter) =>
      updateFieldValue(field, newValue),
    );

    field._unsubscribe = unsubscribe;
  });
}
