import { renderSection } from "./section-renderer.mjs";

/**
 * Render a full character form from schema + data.
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

  // Build section lookup: id → section config
  const sectionMap = new Map();
  for (const sec of schema.sections) {
    sectionMap.set(sec.id, sec);
  }

  // Group fields into sections
  const sectionFields = groupFieldsBySections(schema.fields);

  // Sort sections by order
  const orderedSections = [...sectionMap.values()].sort(
    (a, b) => a.order - b.order,
  );

  for (const sectionConfig of orderedSections) {
    const fields = sectionFields.get(sectionConfig.id);
    if (!fields || fields.length === 0) continue;

    const sectionEl = renderSection(sectionConfig, fields, data, role);
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
