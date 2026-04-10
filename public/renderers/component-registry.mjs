/**
 * Component override registry.
 * Maps component names (from schema ui.component) to render functions.
 * Each function: (path, fieldSchema, value, role, mode) → HTMLElement
 *
 * Session 1: all stubs. Real implementations arrive in Session 2.
 */

import { renderPortrait } from "../components/portrait.mjs";
import { renderTraitList } from "../components/trait-list.mjs";
import { renderTalentList } from "../components/talent-list.mjs";
import { renderCharacterName } from "../components/character-name.mjs";

const registry = new Map();

/**
 * Register a component override renderer.
 * @param {string} name - Component name matching schema ui.component value
 * @param {Function} renderFn - (path, fieldSchema, value, role, mode) → HTMLElement
 */
export function registerComponent(name, renderFn) {
  registry.set(name, renderFn);
}

/**
 * Get a registered component renderer, or null.
 * @param {string} name
 * @returns {Function|null}
 */
export function getComponent(name) {
  return registry.get(name) || null;
}

/**
 * Check if a component override exists.
 * @param {string} name
 * @returns {boolean}
 */
export function hasComponent(name) {
  return registry.has(name);
}

// ── Stub placeholder for unimplemented components ─────────────

function stubComponent(path, fieldSchema, value, role, mode) {
  const el = document.createElement("div");
  el.classList.add("component-stub");
  el.dataset.component = fieldSchema.ui?.component || "unknown";
  el.dataset.path = path;
  el.textContent = `[${fieldSchema.ui?.component || path}]`;
  return el;
}

// ── Register stubs for unimplemented component overrides ──────

const STUB_COMPONENTS = [
  "ritual-list",
  "tradition-list",
  "weapon-slots",
  "effect-list",
  "equipment-list",
  "armor-slot",
  "affiliation-list",
  "notes-list",
];

for (const name of STUB_COMPONENTS) {
  registerComponent(name, stubComponent);
}

// ── Register real component implementations ───────────────────

registerComponent("portrait", renderPortrait);
registerComponent("trait-list", renderTraitList);
registerComponent("talent-list", renderTalentList);
registerComponent("character-name", renderCharacterName);
