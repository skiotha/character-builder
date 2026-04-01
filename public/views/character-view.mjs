import * as api from "api";
import * as sse from "../sse/characterStream.mjs";
import { enhanceElement, cleanupBehaviors } from "../behaviors/index.mjs";
import { subscribeField, setPlayerRole } from "../state.mjs";
import { updateFieldValue } from "../template-engine.mjs";

export async function renderCharacter(container, params) {
  try {
    container.innerHTML = "<div>Loading character screen</div>";

    const characterId = params.id;

    const html = await api.fetchView("character", characterId);

    const fragment = document.createRange().createContextualFragment(html);

    container.setAttribute("id", "character-view");
    container.innerHTML = "";
    container.appendChild(fragment);

    setRole(container);
    attachCharacterViewListeners(container);
    enhanceElement(container);
    sse.connectCharacterStream(characterId);
  } catch (error) {
    console.error("Failed to render character cretaion view:", error);
    container.innerHTML = `
      <div class="error">
        <h2>Failed to load</h2>
        <p>${error.message}</p>
      </div>
    `;
  }
  return () => {
    setRole();
    detachCharacterViewListeners(container);
    cleanupBehaviors(container);
    sse.disconnectCharacterStream();
  };
}

function setRole(container) {
  if (!container) setPlayerRole("public");

  const form = container.querySelector("form");

  if (form && form.dataset.role) {
    setPlayerRole(form.dataset.role);
  }
}

function attachCharacterViewListeners(container) {
  bindFieldsToState(container);
}

function detachCharacterViewListeners(container) {
  container.querySelectorAll("[data-path]").forEach((field) => {
    if (field._unsubscribe) {
      field._unsubscribe();
      delete field._unsubscribe;
    }
  });
}

function showErrorMessage(form, message) {
  const existingError = form.querySelector(".error-message");
  if (existingError) existingError.remove();

  const errorEL = document.createElement("div");
  errorEL.className = "error-message";
  errorEL.textContent = `Error: ${message}`;

  form.appendChild(errorEL);
}

function showBusyIndicator(field) {
  return true;
}

function bindFieldsToState(container) {
  const fields = container.querySelectorAll("[data-path]");

  fields.forEach((field) => {
    const path = field.dataset.path;

    if (field._unsubscribe) field._unsubscribe();

    const unsubscribe = subscribeField(path, (newValue, path, fullCharacter) =>
      updateFieldValue(field, newValue),
    );

    field._unsubscribe = unsubscribe;
  });
}
