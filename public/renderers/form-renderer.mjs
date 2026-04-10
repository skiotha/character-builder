import { renderParentSection } from "./section-renderer.mjs";

/**
 * Render a full character form from schema + data.
 *
 * Two-pass algorithm:
 * 1. Separate sections into parents (no `parent`) and children (has `parent`).
 * 2. Group children by parent ID.
 * 3. For each parent in order: create <section> with <h3>,
 *    render parent-level fields, then render children in order.
 *
 * @param {object} schema - Serialized schema { fields, sections, version }
 * @param {object} data - Character data object
 * @param {string} role - "dm" | "owner" | "public"
 * @param {string} mode - "view" | "create"
 * @returns {HTMLFormElement}
 */
export function renderCharacterForm(schema, data, role, mode) {
  const form = document.createElement("form");
  form.id = "character-form";
  form.dataset.mode = mode;
  form.dataset.role = role;

  if (data?.id) {
    form.dataset.characterId = data.id;
  }

  // Pass 1: separate parents from children
  const parents = [];
  const childrenByParent = new Map();

  for (const sec of schema.sections) {
    if (sec.parent) {
      if (!childrenByParent.has(sec.parent))
        childrenByParent.set(sec.parent, []);
      childrenByParent.get(sec.parent).push(sec);
    } else {
      parents.push(sec);
    }
  }

  // Sort parents by order
  parents.sort((a, b) => a.order - b.order);

  // Sort children within each parent by order
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.order - b.order);
  }

  // Group fields by their ui.section
  const sectionFields = groupFieldsBySections(schema.fields);

  // Pass 2: render parents with their children
  for (const parentConfig of parents) {
    const directFields = sectionFields.get(parentConfig.id) || [];
    const children = childrenByParent.get(parentConfig.id) || [];

    // Skip parents that have no fields and no children with fields
    const hasDirectFields = directFields.length > 0;
    const hasChildFields = children.some(
      (child) => (sectionFields.get(child.id) || []).length > 0,
    );
    if (!hasDirectFields && !hasChildFields) continue;

    const sectionEl = renderParentSection(
      parentConfig,
      directFields,
      children,
      sectionFields,
      data,
      role,
      mode,
    );
    form.appendChild(sectionEl);
  }

  return form;
}

// ── Group schema fields by their ui.section ───────────────────

function groupFieldsBySections(fields) {
  const map = new Map();

  for (const [path, schema] of Object.entries(fields)) {
    const ui = schema.ui;
    if (!ui) continue;
    if (ui.hidden) continue;

    const sectionId = ui.section;
    if (!sectionId) continue;

    if (!map.has(sectionId)) map.set(sectionId, []);
    map.get(sectionId).push({ path, schema });
  }

  return map;
}
