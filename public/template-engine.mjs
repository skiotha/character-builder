export function parseTemplate(templateString, data = {}) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(templateString, "text/html");
  const element = doc.body.firstElementChild;

  hydrate(element, data);

  return element;
}

function hydrate(element, data) {
  element.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    const value = getNestedValue(data, key);

    if (value !== undefined) {
      if (el.dataset.bindAs === "html") {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }
  });

  element.querySelectorAll("[data-if]").forEach((el) => {
    const condition = evalCondition(el.dataset.if, data);

    if (!condition) {
      el.remove();
    }
  });
}

export function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => {
    return current && current[key];
  }, obj);
}

function evalCondition(expression, data) {
  const evalString = expression.replace(/\w+(\.\w+)*/g, (match) => {
    const value = getNestedValue(data, match);
    return value !== undefined ? JSON.stringify(value) : match;
  });

  try {
    return new Function(`return ${evalString}`)();
  } catch {
    return false;
  }
}

// Re-export from canonical location for backwards compatibility.
// This file is deleted in Phase 3 Session 4.
export { updateFieldValue } from "./utils/dom.mjs";
