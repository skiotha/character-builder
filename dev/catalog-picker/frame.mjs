import { openCatalogDialog } from "/components/catalog-dialog.mjs";
import { renderTalentEntry, renderTraitEntry } from "/components/catalog-entry.mjs";

import {
  CATALOG_FIXTURES,
  CATALOG_TITLES,
  PICKER_PRESENTATIONS,
  TALENT_CARDS,
  TRAIT_CARDS,
  TRAIT_RANKS,
} from "/__dev/catalog-picker/fixtures.mjs";

/**
 * @typedef {object} FixtureSelection
 * @property {{ id: string, name: string }} entry
 * @property {{ tier?: string, level?: number }} detail
 */

const INITIAL_CHOICES = new Map([
  ["traits", "acrobatics:adept"],
  ["talents", "cartographer:2"],
  ["rituals", "rite-of-opening-and-sealing"],
]);

const SOURCE_FILTERS = {
  traits: [["Ability", "ability"], ["Spell", "spell"]],
  talents: [["Boon", "boon"], ["Sin", "sin"]],
  rituals: [],
};

const params = new URLSearchParams(location.search);
const requestedCatalog = params.get("catalog");
const requestedScenario = params.get("scenario");
const catalog = Object.hasOwn(CATALOG_FIXTURES, requestedCatalog)
  ? requestedCatalog
  : "traits";
const scenario = requestedScenario ?? "browse";
const sourceEntries = CATALOG_FIXTURES[catalog];

// The unavailable scenario's stand-in for eligibility: Master ranks close.
const UNAVAILABLE_REASON = "not at creation";

/**
 * Build a trait entry from its fixture display data. Each rank button
 * carries `data-fixture-choice` so the scenarios can preselect it.
 * @param {import("./fixtures.mjs").CatalogFixture} entry
 * @param {(detail?: object) => void} select
 * @param {FixtureSelection|null} selection
 * @returns {HTMLElement}
 */
function buildTraitCard(entry, select, selection) {
  const card = TRAIT_CARDS[entry.id];
  if (!card) throw new Error(`Missing trait card fixture: ${entry.id}`);

  const element = renderTraitEntry(
    {
      id: entry.id,
      kind: entry.source,
      name: entry.name,
      description: entry.description,
      meta: card.meta,
      ranks: entry.tiers.map((tier) => ({
        tier,
        ...TRAIT_RANKS[tier],
        ...card.ranks[tier],
        ...(scenario === "unavailable" && tier === "master"
          ? { unavailable: UNAVAILABLE_REASON }
          : {}),
      })),
    },
    {
      selectedTier: selection?.detail.tier,
      onSelect: (tier) => select({ tier }),
    },
  );
  for (const rank of element.querySelectorAll("li[data-tier]")) {
    rank.querySelector("button").dataset.fixtureChoice =
      `${entry.id}:${rank.dataset.tier}`;
  }
  return element;
}

/**
 * Adapt a talent fixture to the reusable entry without calculating prices.
 * @param {import("./fixtures.mjs").CatalogFixture} entry
 * @param {(detail?: object) => void} select
 * @param {FixtureSelection|null} selection
 * @returns {HTMLElement}
 */
function buildTalentCard(entry, select, selection) {
  const card = TALENT_CARDS[entry.id];
  if (!card) throw new Error(`Missing talent card fixture: ${entry.id}`);
  const element = renderTalentEntry(
    {
      id: entry.id,
      kind: entry.source,
      name: entry.name,
      description: entry.description,
      ...card,
    },
    {
      selectedLevel: selection?.detail.level,
      onSelect: (level) => select({ level }),
    },
  );
  for (const control of element.querySelectorAll("[data-level]")) {
    control.dataset.fixtureChoice = `${entry.id}:${control.dataset.level}`;
  }
  return element;
}

function buildRitualCard(entry, select, selection) {
  const card = document.createElement("article");
  card.className = "fixture-card";

  const heading = document.createElement("h3");
  heading.textContent = entry.name;
  card.append(heading);

  const description = document.createElement("p");
  description.textContent = entry.description;
  card.append(description);

  if (entry.traditions?.length) {
    const traditions = document.createElement("p");
    traditions.textContent = `Traditions: ${entry.traditions.join(", ")}`;
    card.append(traditions);

    if (
      entry.traditions.every((tradition) => tradition !== "order")
    ) {
      const badge = document.createElement("p");
      badge.className = "fixture-note";
      badge.textContent = "Outside your traditions";
      card.append(badge);
    }
  }

  const choose = document.createElement("button");
  choose.type = "button";
  choose.dataset.fixtureChoice = entry.id;
  choose.textContent = "Select ritual";
  choose.setAttribute("aria-pressed", String(selection !== null));
  choose.addEventListener("click", () => select());
  card.append(choose);

  return card;
}

function buildPreview(selection) {
  const preview = document.createElement("article");
  preview.className = "fixture-card";
  const heading = document.createElement("h4");
  heading.textContent = selection.entry.name;
  preview.append(heading);

  const detail = Object.entries(selection.detail)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
  if (detail) {
    const selected = document.createElement("p");
    selected.textContent = detail;
    preview.append(selected);
  }

  return preview;
}

/**
 * Return the fixed display data for one fixture selection.
 * @param {FixtureSelection|null} selection
 * @returns {{ before: string, after?: string, limit?: string, kind: string, projection?: string, summary?: string }}
 */
function getPickerPresentation(selection) {
  const fixture = PICKER_PRESENTATIONS[catalog];
  const baseline = {
    before: fixture.balance,
    ...(fixture.limit ? { limit: fixture.limit } : {}),
    kind: fixture.kind,
  };
  if (!selection) return baseline;
  if (scenario === "blocked" || scenario === "ritual-limit") {
    return { ...baseline, ...fixture.blocked };
  }

  const detail = selection.detail.tier ?? selection.detail.level ?? "entry";
  const key = `${selection.entry.id}:${detail}`;
  const choice = fixture.choices[key];
  if (!choice) {
    throw new Error(`Missing picker presentation fixture: ${catalog}/${key}`);
  }
  return { ...baseline, ...choice };
}

/**
 * Render the current counter from fixed gallery presentation values.
 * @param {FixtureSelection|null} selection
 * @param {true|string|false} verdict
 * @returns {HTMLOutputElement}
 */
function renderCounter(selection, verdict) {
  const presentation = getPickerPresentation(selection);
  const counter = document.createElement("output");
  counter.className = "picker-counter";
  counter.dataset.kind = presentation.kind;
  counter.dataset.projection =
    presentation.projection ?? (selection ? "projected" : "none");
  counter.dataset.commitState = !selection
    ? "empty"
    : verdict === true
      ? "ready"
      : "blocked";

  const unit = presentation.kind === "count" ? "rituals" : "XP";
  counter.setAttribute(
    "aria-label",
    selection
      ? presentation.kind === "count"
        ? `${presentation.before} ritual${presentation.before === "1" ? "" : "s"}; ${presentation.after} of ${presentation.limit} after selection`
        : `${presentation.before} XP before selection; ${presentation.after} XP after selection`
      : presentation.kind === "count"
        ? `${presentation.before} of ${presentation.limit} rituals known`
        : `${presentation.before} ${unit} left`,
  );

  const before = document.createElement("span");
  before.dataset.part = "before";
  before.textContent = presentation.before;
  counter.append(before);

  if (selection) {
    const arrow = document.createElement("span");
    arrow.dataset.part = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    const after = document.createElement("span");
    after.dataset.part = "after";
    after.textContent = presentation.after ?? "";
    counter.append(arrow, after);
  }

  if (presentation.limit) {
    const limit = document.createElement("span");
    limit.dataset.part = "limit";
    limit.textContent = `/ ${presentation.limit}`;
    counter.append(limit);
  }

  return counter;
}

/**
 * Render the fixture's Empty, Ready or Blocked footer text.
 * @param {FixtureSelection|null} selection
 * @param {true|string|false} verdict
 * @returns {HTMLSpanElement}
 */
function renderSelectionStatus(selection, verdict) {
  const status = document.createElement("span");
  if (!selection) {
    status.textContent = PICKER_PRESENTATIONS[catalog].emptyHint;
  } else if (typeof verdict === "string") {
    status.textContent = verdict;
  } else {
    status.textContent = getPickerPresentation(selection).summary ?? "";
  }
  return status;
}

/**
 * Build a static header node for the backwards-compatibility scenario.
 * @returns {HTMLOutputElement}
 */
function buildStaticHeader() {
  const counter = document.createElement("output");
  counter.setAttribute("aria-label", "70 XP left");
  counter.textContent = "70";
  return counter;
}

function selectInitialFixture() {
  const initialChoice = INITIAL_CHOICES.get(catalog);
  const choice = document.querySelector(
    `[data-fixture-choice="${initialChoice}"]`,
  );
  choice?.click();
}

let entries = sourceEntries;
if (scenario === "loading") {
  entries = new Promise(() => {});
} else if (scenario === "error") {
  entries = Promise.reject(new Error("Fixture load failure"));
} else if (scenario === "empty") {
  entries = [];
}

const dialogPromise = openCatalogDialog({
  title: CATALOG_TITLES[catalog],
  header: scenario === "static-header" ? buildStaticHeader() : renderCounter,
  entries,
  reload: () => sourceEntries,
  search: {
    fields: ["name", "description", "tags"],
    placeholder: "Name, text or tag",
  },
  filters: SOURCE_FILTERS[catalog].length
    ? [{
        legend: "Source",
        options: SOURCE_FILTERS[catalog].map(([label, source]) => ({
          label,
          predicate: (entry) => entry.source === source,
        })),
      }]
    : [],
  renderCard: catalog === "traits"
    ? buildTraitCard
    : catalog === "talents"
      ? buildTalentCard
      : buildRitualCard,
  renderPreview: buildPreview,
  previewHint: catalog === "talents"
    ? "Select a talent to see it here."
    : catalog === "rituals"
      ? "Select a ritual to see it here."
      : undefined,
  commitLabel: catalog === "rituals" ? "Learn" : catalog === "talents" ? "Take" : "Choose",
  renderSelectionStatus:
    scenario === "static-header" ? undefined : renderSelectionStatus,
  canCommit: () => {
    if (scenario === "blocked") {
      return catalog === "rituals"
        ? "Ritual limit reached."
        : "Not enough experience for this choice.";
    }
    if (scenario === "ritual-limit") return "Ritual limit reached.";
    return true;
  },
});

if (scenario === "no-matches") {
  const search = document.querySelector('input[type="search"]');
  search.value = "no fixture matches this query";
  search.dispatchEvent(new Event("input", { bubbles: true }));
}

if (
  ["selected", "blocked", "ritual-limit", "static-header"].includes(scenario)
) {
  selectInitialFixture();
}

dialogPromise.catch((error) => {
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = `Gallery fixture error: ${error.message}`;
  document.body.append(message);
});
