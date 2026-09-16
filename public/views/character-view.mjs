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

    setCurrentCharacter(characterData);
    setPlayerRole(role);

    const form = renderCharacterForm(schema, characterData, role, "view");

    container.setAttribute("id", "character-view");
    container.innerHTML = "";

    // Nav for anchor positioning (character-name uses --main)
    container.appendChild(createViewNav());

    container.appendChild(form);

    const unsubscribes = bindFieldsToState(container);
    enhanceElement(container);
    sse.connectCharacterStream(characterId);

    // Teardown order matters: the DOM goes before the state is cleared so
    // hosts disconnect (ADR-017 §deps) instead of rendering the null character.
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      cleanupBehaviors(container);
      container.replaceChildren();
      container.removeAttribute("id");
      sse.disconnectCharacterStream();
      setCurrentCharacter(null);
      setPlayerRole("public");
    };
  } catch (error) {
    console.error("Failed to render character view:", error);
    container.innerHTML = `
      <div class="error">
        <h2>Failed to load</h2>
        <p>${error.message}</p>
      </div>
    `;
    return () => {
      container.removeAttribute("id");
      setCurrentCharacter(null);
      setPlayerRole("public");
    };
  }
}

/**
 * Subscribe every native leaf control to its `data-path`.
 * @param {HTMLElement} container
 * @returns {Array<() => void>} Unsubscribe functions, released by the view's cleanup
 */
function bindFieldsToState(container) {
  const fields = container.querySelectorAll(LEAF_CONTROL_SELECTOR);

  return Array.from(fields, (field) =>
    subscribeField(field.dataset.path, (newValue) =>
      updateFieldValue(field, newValue),
    ),
  );
}
