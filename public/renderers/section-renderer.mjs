import { renderField } from "../components/form-field.mjs";
import { getComponent } from "./component-registry.mjs";

/**
 * Render a single section: heading + fields.
 *
 * @param {object} sectionConfig - { id, label, order }
 * @param {object[]} fields - Array of { path, schema } for fields in this section
 * @param {object} data - Full character data
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
export function renderSection(sectionConfig, fields, data, role) {
  const section = document.createElement("section");
  section.classList.add("schema-section");
  section.dataset.section = sectionConfig.id;

  const heading = document.createElement("h2");
  heading.textContent = sectionConfig.label;
  section.appendChild(heading);

  const content = document.createElement("div");
  content.classList.add("section-content");

  // Sort fields by ui.order (fallback to 999)
  const sorted = [...fields].sort(
    (a, b) => (a.schema.ui?.order ?? 999) - (b.schema.ui?.order ?? 999),
  );

  for (const { path, schema } of sorted) {
    const value = getNestedValue(data, path);

    // Component override takes priority
    const componentName = schema.ui?.component;
    if (componentName) {
      const componentFn = getComponent(componentName);
      if (componentFn) {
        content.appendChild(componentFn(path, schema, value, role));
        continue;
      }
    }

    content.appendChild(renderField(path, schema, value, role));
  }

  section.appendChild(content);
  return section;
}

// ── Utility ───────────────────────────────────────────────────

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((cur, key) => cur && cur[key], obj);
}
