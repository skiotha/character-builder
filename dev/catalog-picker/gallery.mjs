import { CATALOG_TITLES, SCENARIOS, VIEWPORTS } from "./fixtures.mjs";

const form = document.querySelector("form");
const catalogSelect = form.elements.catalog;
const viewportSelect = form.elements.viewport;
const scenarioSelect = form.elements.scenario;
const iframe = document.querySelector("iframe");
const status = document.querySelector("#gallery-status");

function updateFrame() {
  const catalog = catalogSelect.value;
  const viewport = VIEWPORTS[viewportSelect.value];
  const scenario = scenarioSelect.value;

  iframe.width = String(viewport.width);
  iframe.height = String(viewport.height);
  iframe.title = `${CATALOG_TITLES[catalog]} picker — ${viewport.label} — ${scenario}`;
  iframe.src = `/__dev/catalog-picker/frame.html?catalog=${encodeURIComponent(catalog)}&scenario=${encodeURIComponent(scenario)}`;
  status.textContent =
    `${CATALOG_TITLES[catalog]} · ${viewport.label} viewport ` +
    `${viewport.width} × ${viewport.height} · ${scenario}`;
}

for (const scenario of SCENARIOS) {
  if (!scenarioSelect.querySelector(`option[value="${scenario}"]`)) {
    throw new Error(`Missing gallery option for scenario: ${scenario}`);
  }
}

form.addEventListener("change", updateFrame);
updateFrame();
