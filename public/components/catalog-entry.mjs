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
 */

const TIER_ICONS = {
  novice: "/assets/icons/grade-novice.svg",
  adept: "/assets/icons/grade-adept.svg",
  master: "/assets/icons/grade-master.svg",
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
 * Build the label / value fact lines as one `<dl>` grid, so the labels
 * share the width of the longest one (DS §controls).
 * @param {MetaLine[]} lines
 * @returns {HTMLDListElement}
 */
function renderMeta(lines) {
  const list = document.createElement("dl");
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

  // The whole block is the click target; the head button stays the one
  // control. A drag that selected text inside the block is not a click.
  item.addEventListener("click", (event) => {
    if (button.contains(/** @type {Node} */ (event.target))) return;
    const text = getSelection();
    if (text && !text.isCollapsed && item.contains(text.anchorNode)) return;
    button.click();
  });

  const body = document.createElement("div");
  body.dataset.part = "body";
  for (const effect of rank.effects) body.append(renderEffect(effect));
  for (const action of rank.actions ?? []) body.append(renderAction(action));

  item.append(head, body);
  return item;
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
