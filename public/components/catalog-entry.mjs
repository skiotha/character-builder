/**
 * Catalog picker entries — the reusable presentation of one list item in
 * the catalog dialog (`catalog-dialog.mjs`), built from a display view.
 *
 * Callers turn reference data into the view: formatted names, cumulative
 * costs, effect text with its attribute words marked, availability and its
 * reason. This module holds no RPG rules; it lays the view out and reports
 * selection through `onSelect`.
 *
 * Trait entry: name, description and meta lines, then the three stacked
 * rank blocks. Each rank head is a toggle `<button>` and the rest of the
 * block forwards clicks to it. The ranks up to the selected one draw the
 * bar, the selection's one signal (DS §focus): Selected, then Included
 * before it. An Unavailable rank stays focusable (`aria-disabled`, its
 * reason beside it and tied by `aria-describedby`) and never selects.
 * The DOM shape doesn't depend on the selection, so the dialog can
 * restore focus by position after it rebuilds the card.
 *
 * Talent entry: name, level pick, description and optional check metadata.
 * Multiple levels use native radios; a single-level entry uses a name
 * button with whole-card click forwarding and a decorative level disc.
 * Clicking elsewhere in an unselected multi-level entry picks its first
 * level; whole-card clicks never replace an already selected level.
 * Costs and gains are display strings supplied by the caller.
 */

const TIER_ICONS = {
  novice: "/assets/icons/grade-novice.svg",
  adept: "/assets/icons/grade-adept.svg",
  master: "/assets/icons/grade-master.svg",
};

const LEVEL_ICONS = {
  1: "/assets/icons/level-1.svg",
  2: "/assets/icons/level-2.svg",
  3: "/assets/icons/level-3.svg",
};

const ACTION_MARKS = {
  reaction: { icon: "/assets/icons/reaction.svg", label: "Reaction" },
  specialAttack: {
    icon: "/assets/icons/special-attack.svg",
    label: "Special attack",
  },
};

const OUTSIDE_TRADITIONS_LABEL =
  "Outside your traditions: learning it costs permanent Corruption.";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Effect text: plain, or a check attribute word emphasised where it stands.
 * @typedef {string | { attribute: string }} TextRun
 */

/**
 * @typedef {object} MetaLine
 * @property {string} label - Fact name, e.g. "Equipment"
 * @property {string} value - Display text, e.g. "Battle Heels"
 * @property {boolean} [outsideTraditions] - Draw the outside-traditions
 *   mark after the value (Traditions lines only)
 */

/**
 * @typedef {object} ActionLine
 * @property {"reaction" | "specialAttack"} kind
 * @property {string} name
 * @property {string} [conditions] - When it applies, e.g. "when knocked
 *   prone"; drawn in parentheses after the name
 * @property {string} description - TODO(picker-tooltips): shown by the
 *   name's term tooltip; not drawn yet
 */

/**
 * @typedef {object} RankView
 * @property {string} tier - "novice" | "adept" | "master": picks the grade
 *   disc and is what `onSelect` receives
 * @property {string} label - Rank name, e.g. "Novice"
 * @property {string} cost - Cumulative cost text, e.g. "30 XP"
 * @property {string} [unavailable] - Why the rank can't be chosen, e.g.
 *   "5 short"; its presence makes the rank Unavailable
 * @property {Array<string | TextRun[]>} effects
 * @property {ActionLine[]} [actions]
 */

/**
 * @typedef {object} TraitEntryView
 * @property {string} id - Entry id; scopes the element ids it creates
 * @property {"ability" | "spell"} kind
 * @property {string} name
 * @property {string} description
 * @property {MetaLine[]} [meta] - Equipment, attributes, traditions
 * @property {RankView[]} ranks - Novice first
 */

/**
 * Build a trait entry with its stacked rank blocks. `selectedTier` marks
 * that rank Selected and the ranks before it Included. Activating an
 * available rank calls `onSelect(tier)`; an Unavailable rank ignores
 * click, Enter and Space.
 * @param {TraitEntryView} view
 * @param {{ selectedTier?: string | null, onSelect: (tier: string) => void }} options
 * @returns {HTMLElement}
 */
export function renderTraitEntry(view, { selectedTier = null, onSelect }) {
  const entry = document.createElement("article");
  entry.className = "trait-entry";
  entry.dataset.kind = view.kind;

  const head = document.createElement("header");
  const name = document.createElement("h3");
  name.textContent = view.name;
  const description = document.createElement("p");
  description.textContent = view.description;
  head.append(name, description);
  if (view.meta?.length) head.append(renderMeta(view.meta));

  const ranks = document.createElement("ol");
  const selectedIndex = view.ranks.findIndex(
    (rank) => rank.tier === selectedTier,
  );
  view.ranks.forEach((rank, index) => {
    const selection =
      index === selectedIndex
        ? "selected"
        : index < selectedIndex
          ? "included"
          : null;
    ranks.append(renderRank(view.id, rank, selection, onSelect));
  });

  entry.append(head, ranks);
  return entry;
}

/**
 * @typedef {object} TalentLevelView
 * @property {1 | 2 | 3} level
 * @property {string} label - Accessible level name, e.g. "Level II"
 * @property {string} cost - Cumulative cost or gain, e.g. "10 XP", "+5 XP"
 */

/**
 * @typedef {object} TalentEntryView
 * @property {string} id - Entry id; scopes the radio group and element ids
 * @property {"boon" | "sin"} kind
 * @property {string} name
 * @property {string} description
 * @property {MetaLine[]} [meta] - Check attributes, when present
 * @property {string} cost - Unselected cost text, e.g. "5 / 10 / 15 XP"
 * @property {TalentLevelView[]} levels - One or three levels, lowest first
 */

/**
 * Build a talent entry. A selected level lights its disc and preceding
 * discs; only that level's radio is checked. Single-level talents expose
 * one name button instead of a redundant one-option radio group. Clicking
 * outside a radio group selects its first level only while unselected.
 * @param {TalentEntryView} view
 * @param {{ selectedLevel?: number | null, onSelect: (level: number) => void }} options
 * @returns {HTMLElement}
 */
export function renderTalentEntry(view, { selectedLevel = null, onSelect }) {
  const entry = document.createElement("article");
  entry.className = "talent-entry";
  entry.dataset.kind = view.kind;
  const selectedIndex = view.levels.findIndex(
    ({ level }) => level === selectedLevel,
  );
  if (selectedIndex >= 0) entry.dataset.selected = "";

  const name = document.createElement("h3");
  const body = document.createElement("div");
  body.dataset.part = "body";
  const content = document.createElement("div");
  const row = document.createElement("div");
  row.dataset.part = "levels";
  const cost = document.createElement("span");
  cost.dataset.part = "cost";
  cost.id = `talent-entry-${view.id}-cost`;
  cost.textContent = view.levels[selectedIndex]?.cost ?? view.cost;

  if (view.levels.length === 1) {
    entry.dataset.singleLevel = "";
    const level = view.levels[0];
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.level = String(level.level);
    button.textContent = view.name;
    button.setAttribute("aria-pressed", String(selectedIndex >= 0));
    button.setAttribute("aria-describedby", cost.id);
    button.addEventListener("click", () => onSelect(level.level));
    name.append(button);
    row.append(icon(LEVEL_ICONS[level.level]));
    forwardClicks(entry, button);
  } else {
    name.textContent = view.name;
    const levels = document.createElement("fieldset");
    levels.setAttribute("aria-label", `${view.name} level`);
    view.levels.forEach((level, index) => {
      const label = document.createElement("label");
      if (index <= selectedIndex) {
        label.dataset.selection =
          index === selectedIndex ? "selected" : "included";
      }
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `talent-entry-${view.id}-level`;
      input.value = String(level.level);
      input.dataset.level = String(level.level);
      input.checked = index === selectedIndex;
      input.setAttribute("aria-label", `${level.label} — ${level.cost}`);
      input.addEventListener("change", () => {
        if (input.checked) onSelect(level.level);
      });
      label.append(input, icon(LEVEL_ICONS[level.level]));
      levels.append(label);
      if (index === 0 && selectedIndex < 0) {
        forwardClicks(entry, input, levels);
      }
    });
    row.append(levels);
  }

  const description = document.createElement("p");
  description.textContent = view.description;
  row.append(cost);
  content.append(row, description);
  if (view.meta?.length) content.append(renderMeta(view.meta));
  body.append(content);
  entry.append(name, body);
  return entry;
}

/**
 * Build the label / value fact lines as one `<dl>` grid, so the labels
 * share the width of the longest one (DS §controls).
 * @param {MetaLine[]} lines
 * @returns {HTMLDListElement}
 */
function renderMeta(lines) {
  const list = document.createElement("dl");
  list.className = "entry-meta";
  for (const line of lines) {
    const label = document.createElement("dt");
    label.textContent = line.label;
    const value = document.createElement("dd");
    value.textContent = line.value;
    if (line.outsideTraditions) {
      // TODO(picker-tooltips): the mark becomes a real control that opens
      // a tooltip with the same text (DS §focus).
      value.append(icon(
        "/assets/icons/outside-traditions.svg",
        OUTSIDE_TRADITIONS_LABEL,
      ));
    }
    list.append(label, value);
  }
  return list;
}

/**
 * Build one rank block: the head button (disc, name, cumulative cost), the
 * Unavailable reason beside it, then the effects and action lines.
 * @param {string} entryId
 * @param {RankView} rank
 * @param {"selected" | "included" | null} selection
 * @param {(tier: string) => void} onSelect
 * @returns {HTMLLIElement}
 */
function renderRank(entryId, rank, selection, onSelect) {
  const item = document.createElement("li");
  item.dataset.tier = rank.tier;
  if (selection) item.dataset.selection = selection;

  const head = document.createElement("div");
  head.dataset.part = "head";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-pressed", String(selection === "selected"));

  const name = document.createElement("span");
  name.dataset.part = "name";
  name.textContent = rank.label;
  const cost = document.createElement("span");
  cost.dataset.part = "cost";
  cost.textContent = rank.cost;
  // Flex items collapse the whitespace between them, but the accessible
  // name keeps it: "Novice 10 XP", not "Novice10 XP".
  button.append(icon(TIER_ICONS[rank.tier]), name, " ", cost);
  head.append(button);

  if (rank.unavailable) {
    item.dataset.unavailable = "";
    const reason = document.createElement("span");
    reason.dataset.part = "reason";
    reason.id = `trait-entry-${entryId}-${rank.tier}-reason`;
    reason.textContent = rank.unavailable;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-describedby", reason.id);
    head.append(reason);
  }

  button.addEventListener("click", () => {
    if (!rank.unavailable) onSelect(rank.tier);
  });

  forwardClicks(item, button);

  const body = document.createElement("div");
  body.dataset.part = "body";
  for (const effect of rank.effects) body.append(renderEffect(effect));
  for (const action of rank.actions ?? []) body.append(renderAction(action));

  item.append(head, body);
  return item;
}

/**
 * Forward whole-card clicks without intercepting native control / label
 * activation or text selection. A radio forwards only until its group
 * has a selection, including before the caller rebuilds the view.
 * @param {HTMLElement} target
 * @param {HTMLButtonElement | HTMLInputElement} control
 * @param {HTMLElement} [controls] - Native controls excluded from forwarding
 * @returns {void}
 */
function forwardClicks(target, control, controls = control) {
  target.addEventListener("click", (event) => {
    if (controls.contains(/** @type {Node} */ (event.target))) return;
    if (
      control.matches("input[type=radio]") && controls.querySelector(":checked")
    ) return;
    const text = getSelection();
    if (text && !text.isCollapsed && target.contains(text.anchorNode)) return;
    control.click();
  });
}

/**
 * Build one effect paragraph from its text runs.
 * @param {string | TextRun[]} effect
 * @returns {HTMLParagraphElement}
 */
function renderEffect(effect) {
  const paragraph = document.createElement("p");
  for (const run of typeof effect === "string" ? [effect] : effect) {
    if (typeof run === "string") {
      paragraph.append(run);
    } else {
      const word = document.createElement("b");
      word.textContent = run.attribute;
      paragraph.append(word);
    }
  }
  return paragraph;
}

/**
 * Build one action line: the kind mark, the name and its conditions.
 * @param {ActionLine} action
 * @returns {HTMLParagraphElement}
 */
function renderAction(action) {
  const mark = ACTION_MARKS[action.kind];
  const line = document.createElement("p");
  line.dataset.action = action.kind;

  const text = document.createElement("span");
  const name = document.createElement("span");
  name.dataset.part = "term";
  name.textContent = action.name;
  text.append(name);
  if (action.conditions) {
    const conditions = document.createElement("span");
    conditions.dataset.part = "conditions";
    conditions.textContent = `(${action.conditions})`;
    text.append(" ", conditions);
  }

  line.append(icon(mark.icon, mark.label), text);
  return line;
}

/**
 * Build an `<svg><use>` icon (DS §assets). Without a label it is
 * decorative and hidden from assistive technology.
 * @param {string} href
 * @param {string} [label]
 * @returns {SVGSVGElement}
 */
function icon(href, label) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("focusable", "false");
  if (label) {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", label);
  } else {
    svg.setAttribute("aria-hidden", "true");
  }
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", href);
  svg.append(use);
  return svg;
}
