import * as api from "api";
import {
  getPlayerToken,
  getState,
  setCurrentCharacter,
  setCharacters,
  setPlayerToken,
} from "../state.mjs";
import { navigate } from "router";
import { initPortraitUpload } from "../behaviors/portraitHandler.mjs";
import { renderCharacterForm } from "../renderers/form-renderer.mjs";
import { createViewNav } from "../utils/dom.mjs";
import {
  DEFAULT_CHARACTER,
  SECONDARY_ATTRIBUTES_RULES,
  PRIMARY_TO_SECONDARY,
} from "../utils/rpg.mjs";

const BUDGET = 80;

let portraitManager = null;
let isSubmitting = false;

export async function renderCreation(container, params) {
  try {
    container.innerHTML = "<div>Loading create screen</div>";

    const schema = await api.getSchema();
    const form = renderCharacterForm(
      schema,
      DEFAULT_CHARACTER,
      "owner",
      "create",
    );

    container.setAttribute("id", "creation-view");
    container.innerHTML = "";

    container.appendChild(createViewNav());
    container.appendChild(form);

    // Hidden submit button — enables implicit submission (Enter key)
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.hidden = true;
    form.appendChild(submitBtn);

    // Inject budget output into section#attributes (between heading and children)
    const attributesSection = form.querySelector("section#attributes");
    if (attributesSection) {
      const budgetOutput = document.createElement("output");
      budgetOutput.id = "balance";
      budgetOutput.value = String(BUDGET);
      budgetOutput.textContent = String(BUDGET);

      const heading = attributesSection.querySelector(":scope > h3");
      if (heading) {
        heading.after(budgetOutput);
      } else {
        attributesSection.prepend(budgetOutput);
      }
    }

    // Wire attribute budget + secondary calculation
    const budgetHandler = createBudgetHandler(form);
    budgetHandler();

    const primaryContainer = form.querySelector("#primary");
    if (primaryContainer) {
      primaryContainer.addEventListener("input", budgetHandler);
    }

    // Hidden input for experience.total (not rendered by schema, required by server)
    const expInput = document.createElement("input");
    expInput.type = "hidden";
    expInput.name = "experience.total";
    expInput.value = "50";
    form.appendChild(expInput);

    // Wire portrait
    portraitManager = initPortraitUpload(container);

    // Wire submission
    form.addEventListener("submit", handleFormSubmit);
  } catch (error) {
    console.error("Failed to render character creation view:", error);
    container.innerHTML = `
      <div class="error">
        <h2>Failed to load</h2>
        <p>${error.message}</p>
      </div>
    `;
  }

  return () => {
    container.removeAttribute("id");
    if (portraitManager) portraitManager.cleanup();
    const form = container.querySelector("form#character-form");
    if (form) form.removeEventListener("submit", handleFormSubmit);
  };
}

// ── Attribute budget + secondary calculation ──────────────────

function createBudgetHandler(form) {
  const primaryInputs = form.querySelectorAll(
    'input[name^="attributes.primary."]',
  );
  const budgetOutput = form.querySelector("output#balance");

  return function budgetHandler() {
    let total = 0;
    for (const input of primaryInputs) {
      const v = input.valueAsNumber;
      total += isNaN(v) ? 0 : v;
    }

    const remaining = BUDGET - total;

    if (budgetOutput) {
      budgetOutput.value = String(remaining);
      budgetOutput.textContent = String(remaining);
      budgetOutput.classList.toggle("over-budget", remaining < 0);
      budgetOutput.classList.toggle("exact-budget", remaining === 0);
    }

    updateSecondaryAttributes(form);
  };
}

function updateSecondaryAttributes(form) {
  for (const [primaryName, secondaryIds] of Object.entries(
    PRIMARY_TO_SECONDARY,
  )) {
    const primaryInput = form.querySelector(
      `input[name="attributes.primary.${primaryName}"]`,
    );
    if (!primaryInput) continue;

    const primaryValue = primaryInput.valueAsNumber;

    for (const secondaryId of secondaryIds) {
      const rule = SECONDARY_ATTRIBUTES_RULES[secondaryId];
      if (!rule) continue;

      const newValue = rule.calculate(primaryValue);

      // Secondary fields are <output> elements with name attributes
      const el = form.querySelector(
        `[name="attributes.secondary.${secondaryId}"]`,
      );
      if (!el) continue;

      el.value = String(newValue);
      el.textContent = String(newValue);
    }
  }
}

// ── Form submission ───────────────────────────────────────────

const handleFormSubmit = async (e) => {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  const form = e.target;

  try {
    // HTML5 constraint validation
    if (!form.reportValidity()) return;

    // Budget check
    const primaryInputs = form.querySelectorAll(
      'input[name^="attributes.primary."]',
    );
    let total = 0;
    for (const input of primaryInputs) {
      const v = input.valueAsNumber;
      total += isNaN(v) ? 0 : v;
    }
    if (total > BUDGET) {
      showErrorMessage(
        form,
        `Attribute points exceed budget (${total}/${BUDGET})`,
      );
      return;
    }

    // Collect form data
    const characterData = collectFormData(form);

    // Attach player ID
    const playerToken = getPlayerToken();
    if (playerToken) {
      characterData.playerId = playerToken;
    }

    // Attach portrait crop data
    if (portraitManager) {
      const portraitData = portraitManager.getPortraitData();
      if (portraitData?.crop && portraitData?.originalSize) {
        characterData.portrait = {
          crop: portraitData.crop,
          dimensions: portraitData.originalSize,
        };
      }
    }

    // Submit
    const character = await api.createCharacter(characterData);

    // Update app state
    const state = getState();
    if (character.playerId && !state.playerToken) {
      await setPlayerToken(character.playerId);
    }
    setCurrentCharacter(character);
    setCharacters([...state.characters, character]);

    // Upload portrait if exists
    if (portraitManager) {
      const portraitData = portraitManager.getPortraitData();
      if (portraitData?.file) {
        try {
          await uploadPortrait(character.id, portraitData.file);
        } catch (err) {
          console.warn("Portrait upload failed (character was created):", err);
        }
      }
    }

    navigate(`/character/${character.id}`);
  } catch (error) {
    console.error("Failed to create character:", error);
    showErrorMessage(form, error.message);
  } finally {
    isSubmitting = false;
  }
};

// ── Data collection ───────────────────────────────────────────

function collectFormData(form) {
  const data = {};

  for (const field of form.elements) {
    const path = field.name;
    if (!path || field.type === "submit") continue;

    const keys = path.split(".");
    let current = data;

    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    const tag = field.tagName;

    if (field.type === "number" || field.type === "hidden") {
      const n = Number(field.value);
      if (!Number.isNaN(n)) current[lastKey] = n;
    } else if (tag === "OUTPUT") {
      const v = field.value;
      if (v === "") continue;
      const n = Number(v);
      current[lastKey] = Number.isNaN(n) ? v : n;
    } else {
      const v = field.value;
      if (v !== "") current[lastKey] = v;
    }
  }

  return data;
}

// ── Portrait upload ───────────────────────────────────────────

async function uploadPortrait(characterId, file) {
  const formData = new FormData();
  formData.append("portrait", file);

  const headers = {};
  const playerToken = getPlayerToken();
  if (playerToken) headers["x-player-id"] = playerToken;

  const response = await fetch(`/api/v1/characters/${characterId}/portrait`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Portrait upload failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

// ── UI helpers ────────────────────────────────────────────────

function showErrorMessage(form, message) {
  const existing = form.querySelector(".error-message");
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.className = "error-message";
  el.textContent = `Error: ${message}`;
  form.appendChild(el);
}
