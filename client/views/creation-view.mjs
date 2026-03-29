import * as api from "@api";
import * as nagara from "@state";
import { navigate } from "@router";
import { initPortraitUpload } from "../behaviors/portraitHandler.mjs";
import { enhanceElement } from "../behaviors/index.mjs";

import { SCHEMA } from "../validation/schema.mjs";
import { FormValidator } from "../validation/ui.mjs";
import {
  SECONDARY_ATTRIBUTES_RULES,
  PRIMARY_TO_SECONDARY,
} from "../utils/rpg.mjs";

let portraitManager = null;
let isSubmitting = false;

export async function renderCreation(container, params) {
  try {
    container.innerHTML = "<div>Loading create screen</div>";

    const html = await api.fetchView("creation");

    const fragment = document.createRange().createContextualFragment(html);

    container.setAttribute("id", "creation-view");
    container.innerHTML = "";
    container.appendChild(fragment);

    portraitManager = initPortraitUpload(container);
    attachCreationViewListeners(container, portraitManager);
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
    container.removeAttribute("id");
    portraitManager.cleanup();
    detachCreationViewListeners(container);
  };
}

function attachCreationViewListeners(container, portraitManager) {
  const form = container.querySelector("form#creation-form");

  if (form) {
    form.addEventListener("submit", handleFormSubmit);

    const attributesContainer = form.querySelector("div#primary");

    const handleUpdatePrimaryAttribute = createAttributeBudgetHandler(form);

    handleUpdatePrimaryAttribute();

    form.addEventListener("reset", () => {
      window.requestAnimationFrame(handleUpdatePrimaryAttribute);
      // setTimeout(handleUpdatePrimaryAttribute, 0);
    });

    if (attributesContainer)
      attributesContainer.addEventListener(
        "input",
        handleUpdatePrimaryAttribute,
      );
  }

  enhanceElement(container);
}

function detachCreationViewListeners(container) {
  const form = container.querySelector("form#creation-form");

  if (form) {
    form.removeEventListener("submit", handleFormSubmit);
  }
}

function createAttributeBudgetHandler(form) {
  const primaryInputs = Array.from(form.elements).filter((element) =>
    element.name?.startsWith("attributes.primary."),
  );
  const secondaryInputs = Array.from(form.elements).filter((element) =>
    element.name?.startsWith("attributes.secondary."),
  );
  const budgetOutput = form.elements["balance"];

  const primaryById = new Map();
  const secondaryById = new Map();

  primaryInputs.forEach((input) => primaryById.set(input.id, input));
  secondaryInputs.forEach((input) => secondaryById.set(input.id, input));

  if (!primaryInputs.length || !secondaryInputs.length || !budgetOutput) {
    console.warn("Something's amiss with attributes HTML elements!");
    return () => {};
  }

  return function (event) {
    const totalUsed = primaryInputs.reduce((sum, input) => {
      const value = input.valueAsNumber;
      return sum + (isNaN(value) ? 0 : value);
    }, 0);

    const remaining = 80 - totalUsed;

    window.requestAnimationFrame(() => {
      budgetOutput.value = remaining;

      budgetOutput.classList.toggle("over-budget", remaining < 0);
      budgetOutput.classList.toggle("exact-budget", remaining === 0);

      updateSecondaryAttributes(primaryById, secondaryById, event?.target?.id);
    });
  };
}

function updateSecondaryAttributes(
  primaryMap,
  secondaryMap,
  changedPrimaryId = null,
) {
  const primariesToUpdate = changedPrimaryId
    ? [changedPrimaryId]
    : Object.keys(PRIMARY_TO_SECONDARY);

  primariesToUpdate.forEach((primaryId) => {
    const primaryValue = primaryMap.get(primaryId)?.valueAsNumber || 0;
    const dependentSecondaries = PRIMARY_TO_SECONDARY[primaryId] || [];

    dependentSecondaries.forEach((secondaryId) => {
      const rule = SECONDARY_ATTRIBUTES_RULES[secondaryId];
      const secondaryInput = secondaryMap.get(secondaryId);

      if (rule && secondaryInput) {
        const newValue = rule.calculate(primaryValue);
        secondaryInput.valueAsNumber = newValue;
      }
    });
  });
}

const handleFormSubmit = async (e) => {
  if (isSubmitting) {
    console.warn("Form is already being submitted");
    return;
  }

  e.preventDefault();
  isSubmitting = true;

  try {
    const state = nagara.getState();
    // const formData = new FormData(e.target);

    const formValidator = new FormValidator(e.target, SCHEMA);
    // formValidator.debugSchemaPaths();
    const { errors, isValid } = formValidator.validateAll();

    if (!isValid) {
      // showErrorMessage(e.target, "Please fix the errors before saving");
      console.warn("=== VALIDATION ERRORS ===");
      console.warn(errors);
      return;
    }

    const validatedCharacterData = formValidator.getFormData();

    const characterData = await prepareCharacterData(
      validatedCharacterData,
      state,
    );

    const character = await createCharacter(characterData, state.playerToken);

    await updateAppStateAfterCreation(character, state);

    console.log("Character created:", character);

    await uploadCharacterPortraitIfExists(character.id);

    navigate(`/character/${character.id}`);
  } catch (error) {
    console.error("Failed to create character:", error);
    showErrorMessage(e.target, error.message);
  } finally {
    isSubmitting = false;
  }
};

async function prepareCharacterData(formData, state) {
  const payload = formData;

  if (state.playerToken) {
    payload.playerId = state.playerToken;
  }

  const portraitData = portraitManager.getPortraitData();

  if (portraitData?.crop && portraitData?.originalSize) {
    payload.portrait = {
      crop: portraitData.crop,
      dimensions: portraitData.originalSize,
    };
  }

  return payload;
}

async function createCharacter(characterData, playerToken) {
  const response = await fetch("/api/v1/characters", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(playerToken && { "x-player-id": playerToken }),
    },
    body: JSON.stringify(characterData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create character: ${response.status} ${errorText}`,
    );
  }

  return await response.json();
}

async function updateAppStateAfterCreation(character, currentState) {
  console.log("from character", character.playerId);
  console.log("from state", currentState.playerToken);
  if (character.playerId && !currentState.playerToken) {
    await nagara.setPlayerToken(character.playerId);
  }

  console.log("After", nagara.getState());
  nagara.setCurrentCharacter(character);

  const updatedCharacters = [...currentState.characters, character];
  nagara.setCharacters(updatedCharacters);
}

async function uploadCharacterPortraitIfExists(characterId) {
  const portraitData = portraitManager.getPortraitData();

  if (!portraitData?.file) {
    console.warn("No portrait file to upload");
    return;
  }

  try {
    console.log("Uploading portrait file, please stand by...");
    const result = await uploadCharacterPortrait(
      characterId,
      portraitData.file,
    );
    console.log("Portrait uploaded:", result.message);

    if (result.portraitPath) {
      updateCharacterPortraitPath(characterId, result.portraitPath);
    }
  } catch (error) {
    console.warn("Portrait upload failed (but character was created:", error);
  }
}

async function uploadCharacterPortrait(characterId, portraitFile) {
  if (!portraitFile) throw new Error("No portrait file provided");

  const formData = new FormData();
  formData.append("portrait", portraitFile);

  const response = await fetch(
    `/api/v1/characters/${characterId}/portrait`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Portrait upload failed: ${response.status} ${errorText}`);
  }

  return await response.json();
}

function updateCharacterPortraitPath(charcterId, portraitPath) {
  const state = nagara.getState();
  const updatedCharacters = state.characters.map((char) => {
    char.id === charcterId
      ? { ...char, portrait: { ...char.portrait, path: portraitPath } }
      : char;
  });
  nagara.setCharacters(updatedCharacters);

  if (state.currentCharacter?.id === charcterId) {
    nagara.setCurrentCharacter({
      ...state.currentCharacter,
      portrait: { ...state.currentCharacter.portrait, path: portraitPath },
    });
  }
}

function transformFormData(formData) {
  const result = {};

  for (const [key, value] of formData.entries()) {
    const keys = key.split(".");
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = current[keys[i]] || {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  return result;
}

function showErrorMessage(form, message) {
  const existingError = form.querySelector(".error-message");
  if (existingError) existingError.remove();

  const errorEL = document.createElement("div");
  errorEL.className = "error-message";
  errorEL.textContent = `Error: ${message}`;

  form.appendChild(errorEL);
}
