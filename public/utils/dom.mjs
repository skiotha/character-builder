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
