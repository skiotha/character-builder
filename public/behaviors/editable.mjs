import * as api from "api";
import * as nagara from "state";
import { updateFieldValue } from "../utils/dom.mjs";

const pendingUpdates = new Map();
const abortControllerMap = new WeakMap();

export function initEditable(element) {
  const allowedRoles = element.dataset.roleAllowed?.split(" ") || [];
  const currentRole = nagara.getState().userRole;

  if (!allowedRoles.includes(currentRole) && !allowedRoles.includes("*")) {
    return;
  }

  const clickHandler = (e) => {
    if (e.target.tagName === "BUTTON" || e.target.closest("BUTTON")) return;

    if (!element.hasAttribute("data-editing")) {
      startEditing(element);
    }
  };

  element.addEventListener("click", clickHandler);

  element._editableCleanup = () => {
    console.log("Editable deleted");
    element.removeEventListener("click", clickHandler);
  };
}

function getFieldValue(field) {
  const tagName = field.tagName.toLowerCase();
  const type = field.type;

  if (tagName === "input") {
    if (type === "number") {
      return parseInt(field.value) || 0;
    }
    return field.value;
  }

  if (tagName === "output") {
    return parseFloat(field.value);
  }

  if (tagName === "select") {
    return field.multiple
      ? Array.from(field.selectedOptions).map((opt) => opt.value)
      : field.value;
  }

  if (tagName === "textarea") return field.value;

  return field.value || field.textContent;
}

function startEditing(element) {
  if (abortControllerMap.has(element)) {
    abortControllerMap.get(element).abort();
    abortControllerMap.delete(element);
  }

  if (pendingUpdates.has(element)) return;

  element.setAttribute("data-editing", "true");
  //   element.removeAttribute("aria-disabled");
  element.removeAttribute("readonly");

  const originalValue = getFieldValue(element);

  const saveHandler = async () => {
    // element.setAttribute("aria-disabled", "true");
    const currentValue = getFieldValue(element);

    if (currentValue === originalValue) {
      element.setAttribute("readonly", "");
      element.removeAttribute("data-editing");
      return;
    }

    element.setAttribute("readonly", "");
    element.removeAttribute("data-editing");

    await saveField(element, currentValue, originalValue);
  };

  element.addEventListener("blur", saveHandler, { once: true });
  // element.addEventListener("change", saveHandler, { once: true });
}

export async function saveField(field, newValue, originalValue) {
  const fieldPath = field.dataset.path;
  const characterId = nagara.getState().currentCharacter.id;

  updateFieldValue(field, newValue);

  pendingUpdates.set(field, true);
  field.setAttribute("aria-busy", "true");

  const controller = new AbortController();
  abortControllerMap.set(field, controller);

  try {
    const result = await api.patchCharacter(
      characterId,
      [{ field: fieldPath, value: newValue }],
      { signal: controller.signal },
    );

    if (result.success) {
      nagara.setCurrentCharacter(result.character);
    } else {
      updateFieldValue(field, originalValue);
      showFieldError(field, result.error);
    }
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    updateFieldValue(field, originalValue);
    showFieldError(field, error);
  } finally {
    pendingUpdates.delete(field);
    abortControllerMap.delete(field);
    field.removeAttribute("aria-busy");
    // field.setAttribute('aria-disabled', )
    // field.setAttribute("readonly", "");
  }
}

function showFieldError(field, error) {
  console.error(error);
}
