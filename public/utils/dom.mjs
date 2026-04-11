/**
 * Set a field's value, normalizing across input types.
 * Adds a brief "updated" visual flash for UX feedback.
 *
 * @param {HTMLElement} field - The form control or output element
 * @param {*} newValue - Value to set
 */
export function updateFieldValue(field, newValue) {
  const tagName = field.tagName.toUpperCase();
  const type = field.type;

  if (tagName === "INPUT" || tagName === "SELECT" || tagName === "TEXTAREA") {
    if (type === "number") {
      field.value = newValue ?? 0;
    } else if (type === "checkbox") {
      field.checked = Boolean(newValue);
    } else {
      field.value = newValue ?? "";
    }
  } else {
    field.textContent = newValue ?? "";
  }

  field.classList.add("updated");
  setTimeout(() => field.classList.remove("updated"), 200);
}

const VIEW_NAV_LABELS = ["BIO", "INVENTORY", "DESCRIPTION"];

/**
 * Build the shared `<nav>` used by character and creation views.
 * @returns {HTMLElement}
 */
export function createViewNav() {
  const nav = document.createElement("nav");
  const ul = document.createElement("ul");
  for (const label of VIEW_NAV_LABELS) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = label;
    a.href = "#";
    li.appendChild(a);
    ul.appendChild(li);
  }
  nav.appendChild(ul);
  return nav;
}
