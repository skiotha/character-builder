import { scaleCropForContainer } from "../utils/portrait.mjs";

const CREATION_SIZE = { width: 300, height: 450 };
const CARD_SIZE = { width: 120, height: 200 };

const STATS = [
  { key: "health", term: "HP" },
  { key: "corruption", term: "CP" },
  { key: "money", term: "Reales" },
  { key: "experience", term: "EXP" },
  { key: "location", term: "Loc" },
];

/**
 * Create a dashboard character card element.
 * @param {object} character — raw character JSON from the API
 * @returns {HTMLLIElement}
 */
export function createCharacterCard(character) {
  const stats = {
    health: character.attributes?.secondary?.toughness?.current ?? 0,
    corruption:
      (character.corruption?.permanent ?? 0) +
      (character.corruption?.temporary ?? 0),
    money: character.equipment?.money ?? 0,
    experience: character.experience?.unspent ?? 0,
    location: character.location ?? "",
  };

  const li = document.createElement("li");
  li.setAttribute("role", "gridcell");

  li.appendChild(renderPortrait(character));
  li.appendChild(renderStats(character.characterName, stats));
  li.appendChild(renderMenu(character.id));

  return li;
}

/**
 * Create the "add new character" card.
 * @returns {HTMLLIElement}
 */
export function createNewCharacterCard() {
  const li = document.createElement("li");
  li.id = "dashboard-create";
  li.setAttribute("role", "gridcell");

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "create";
  button.setAttribute("aria-label", "Create new character");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("role", "presentation");
  svg.setAttribute("aria-label", "Icon with a plus sign");

  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "/common/icons/icon-plus-1.svg");
  svg.appendChild(use);

  button.appendChild(svg);
  li.appendChild(button);

  return li;
}

// --- Internal helpers ---

function renderPortrait(character) {
  const picture = document.createElement("picture");
  const hasPortrait =
    character.portrait?.path && character.portrait?.status === "uploaded";

  const img = document.createElement("img");
  img.loading = "lazy";

  if (!hasPortrait) {
    img.alt = "Default portrait";
    img.height = 200;
    img.width = 120;
    picture.appendChild(img);
    return picture;
  }

  const crop = character.portrait.crop;
  const { x, y, scale } = scaleCropForContainer(
    crop,
    CREATION_SIZE,
    CARD_SIZE,
  );

  img.src = character.portrait.path;
  img.alt = `Portrait of ${character.characterName}`;
  img.style.transform = `translate(-50%, -50%) translate(${x + 20}px, ${y}px) scale(${scale})`;

  picture.appendChild(img);
  return picture;
}

function renderStats(name, stats) {
  const group = document.createElement("div");
  group.setAttribute("role", "group");

  const h3 = document.createElement("h3");
  h3.setAttribute("role", "presentation");
  h3.textContent = name;
  group.appendChild(h3);

  const dl = document.createElement("dl");
  for (const { key, term } of STATS) {
    const wrapper = document.createElement("div");
    wrapper.dataset.attribute = key;

    const dt = document.createElement("dt");
    dt.textContent = term;
    wrapper.appendChild(dt);

    const dd = document.createElement("dd");
    dd.textContent = String(stats[key] ?? "");
    wrapper.appendChild(dd);

    dl.appendChild(wrapper);
  }
  group.appendChild(dl);

  return group;
}

function renderMenu(characterId) {
  const menu = document.createElement("menu");

  const viewBtn = document.createElement("button");
  viewBtn.dataset.action = "view";
  viewBtn.dataset.characterId = characterId;
  const viewSpan = document.createElement("span");
  viewSpan.textContent = "VIEW";
  viewBtn.appendChild(viewSpan);

  const editBtn = document.createElement("button");
  editBtn.dataset.action = "edit";
  editBtn.dataset.characterId = characterId;
  editBtn.classList.add("primary");
  const editSpan = document.createElement("span");
  editSpan.textContent = "EDIT";
  editBtn.appendChild(editSpan);

  menu.appendChild(viewBtn);
  menu.appendChild(editBtn);

  return menu;
}
