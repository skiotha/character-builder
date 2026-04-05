import { renderField } from "../components/form-field.mjs";
import { getComponent } from "./component-registry.mjs";

/**
 * Render a parent section: <section> with <h3>, direct fields, then children.
 *
 * @param {object} config - Parent section config { id, label, order }
 * @param {object[]} directFields - Fields where ui.section === config.id
 * @param {object[]} children - Child section configs (sorted by order)
 * @param {Map} sectionFields - Map of sectionId → field array
 * @param {object} data - Full character data
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
export function renderParentSection(
  config,
  directFields,
  children,
  sectionFields,
  data,
  role,
) {
  const section = document.createElement("section");

  // Portrait component owns the section — skip ID on parent
  if (config.id !== "portrait") {
    section.id = config.id;
  }

  const heading = document.createElement("h3");
  heading.textContent = config.label;
  section.appendChild(heading);

  // Render direct fields (fields assigned to the parent, not to a child)
  renderFields(section, directFields, data, role);

  // Render children in order
  for (const childConfig of children) {
    const childFields = sectionFields.get(childConfig.id) || [];
    if (childFields.length === 0) continue;

    const childEl = renderChildSection(childConfig, childFields, data, role);
    section.appendChild(childEl);
  }

  return section;
}

/**
 * Render a child section.
 * - If config.label is non-empty → <section> with <h4>
 * - If config.label is empty → <div> (pure layout grouping)
 * ID comes from config.displayId, falling back to last segment of config.id.
 *
 * @param {object} config - Child section config { id, label, order, parent, displayId }
 * @param {object[]} fields - Fields in this child section
 * @param {object} data - Full character data
 * @param {string} role - "dm" | "owner" | "public"
 * @returns {HTMLElement}
 */
function renderChildSection(config, fields, data, role) {
  const hasHeading = config.label && config.label.length > 0;
  const el = document.createElement(hasHeading ? "section" : "div");

  el.id = config.displayId || config.id.split(".").pop();

  if (hasHeading) {
    const heading = document.createElement("h4");
    heading.textContent = config.label;
    el.appendChild(heading);
  }

  renderFields(el, fields, data, role);
  return el;
}

// ── Shared field rendering ────────────────────────────────────

function renderFields(container, fields, data, role) {
  const sorted = [...fields].sort(
    (a, b) => (a.schema.ui?.order ?? 999) - (b.schema.ui?.order ?? 999),
  );

  for (const { path, schema } of sorted) {
    const value = getNestedValue(data, path);

    const componentName = schema.ui?.component;
    if (componentName) {
      const componentFn = getComponent(componentName);
      if (componentFn) {
        container.appendChild(componentFn(path, schema, value, role));
        continue;
      }
    }

    container.appendChild(renderField(path, schema, value, role));
  }
}

// ── Utility ───────────────────────────────────────────────────

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((cur, key) => cur && cur[key], obj);
}
