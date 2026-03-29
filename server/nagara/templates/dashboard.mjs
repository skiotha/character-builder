import { scaleCropForContainer } from "../utils/general.mjs";

const TEXTS = {
  dashboard: {
    article: {
      title: "NAGARA",
      description:
        "All your characters are here. Click on any one or Create new.",
    },
    stats: {
      attributes: {
        health: {
          term: "HP",
          statPath: "attributes.secondary.toughness.current",
        },
        corruption: {
          term: "CP",
          statPath: "corruption.permanent",
        },
        money: {
          term: "Reales",
          statPath: "equipment.money",
        },
        experience: {
          term: "EXP",
          statPath: "experience.unspent",
        },
        location: {
          term: "Loc",
          statPath: "location",
        },
      },
    },
    menu: {
      edit: {
        label: "EDIT",
        isPrimary: true,
      },
      view: {
        label: "VIEW",
      },
    },
    createCard: {
      button: {
        type: "button",
        action: "create",
        label: "Create new character",
      },
      icon: {
        name: "icon-plus-1",
        label: "Icon with a plus sign",
        tooltip: "Create new character!",
      },
    },
  },
};

export function renderDashboard(characters) {
  const dashboardCharacters = characters.map((char) => ({
    name: char.characterName,
    id: char.id,
    portrait: char.portrait,
    health: char.attributes?.secondary?.toughness?.current || 0,
    corruption:
      (char.corruption?.permanent || 0) + (char.corruption?.temporary || 0),
    money: char.equipment?.money,
    experience: char.experience?.unspent,
    location: char.location,
  }));

  return `
    ${renderWelcomeBlock()}

    ${renderDashboardBlock(dashboardCharacters)}

    ${addScriptElement(characters)}
  `;
}

function renderWelcomeBlock() {
  return `
    <article>
      <h1>${TEXTS.dashboard.article.title}</h1>

      <p>
        ${escapeHtml(TEXTS.dashboard.article.description).replace("Create", "<em>Create</em>")}
      </p>
    </article>
  `;
}

function renderDashboardBlock(characters) {
  return `
    <ul role="grid" aria-label="Character list">
      ${characters.map((character) => `${renderCharacterCard(character)}`).join(" ")}
      ${characters.length < 6 && renderCreateCharacterCard()} 
    </ul>
  `;
}

function renderCharacterCard(character) {
  return `
    <li role="gridcell">
      ${renderCharacterCardPortrait(character)}

      ${renderCharacterCardStats(character)}

      ${renderCharacterCardMenu(character.id)}
    </li>
  `;
}

function renderCharacterCardPortrait(character) {
  const hasPortrait =
    character.portrait?.path && character.portrait?.status === "uploaded";

  if (!hasPortrait) {
    return `
      <picture">
        <img src="/public/default-avatar.jpg"
             alt="Default portrait"
             loading="lazy"
             height="200"
             width="120" />
      </picture>
    `;
  }

  const creationSize = { width: 300, height: 450 };
  const cardSize = { width: 120, height: 200 };

  const originalCrop = character.portrait.crop;

  const { x, y, scale } = scaleCropForContainer(
    originalCrop,
    creationSize,
    cardSize,
  );

  const transform = `translate(-50%, -50%) translate(${x + 20}px, ${y}px) scale(${scale})`;

  return `
    <picture>
      <img
        src="${escapeHtml(character.portrait.path)}"
        alt="Portrait of ${escapeHtml(character.name)}"
        style="transform: ${transform};"
        loading="lazy"
       />
    </picture>
  `;
}

function renderCharacterCardStats(character) {
  return `
    <div role="group">
      <h3 role="presentation">${escapeHtml(character.name)}</h3>
      <dl>
        ${renderAttribute(character, "health")}

        ${renderAttribute(character, "corruption")}

        ${renderAttribute(character, "money")}

        ${renderAttribute(character, "experience")}

        ${renderAttribute(character, "location")}
      </dl>
    </div>
  `;
}

function renderAttribute(character, attr) {
  const attributeName = TEXTS.dashboard.stats.attributes[attr];

  return `
    <div data-attribute="${attr}">
      <dt>${attributeName.term}</dt>
      <dd>${character[attr]}</dd>
    </div>
  `;
}

function renderCharacterCardMenu(characterId) {
  return `
    <menu>
      ${renderButton("view", characterId)}

      ${renderButton("edit", characterId)}
    </menu>
  `;
}

function renderButton(action, characterId) {
  return `
    <button
      data-action="${action}"
      ${TEXTS.dashboard.menu[action].isPrimary ? 'class="primary"' : ""}
      data-character-id="${escapeHtml(characterId)}"
    >
      <span>${TEXTS.dashboard.menu[action].label}</span>
    </button>
  `;
}

function renderCreateCharacterCard() {
  return `
    <li id="dashboard-create" role="gridcell">
      ${renderDashboardCharacterCreateButton()}
    </li>
  `;
}

function renderDashboardCharacterCreateButton() {
  return `
    <button
      type="${TEXTS.dashboard.createCard.button.type}"
      data-action="${TEXTS.dashboard.createCard.button.action}"
      aria-label="${TEXTS.dashboard.createCard.button.label}"
    >
      ${renderDashboardCreateIcon()}
    </button>
  `;
}

function renderDashboardCreateIcon() {
  return `
    <svg role="presentation" aria-label="${TEXTS.dashboard.createCard.icon.label}">
      <use href="/common/icons/${TEXTS.dashboard.createCard.icon.name}.svg"></use>
    </svg>
  `;
}

function addScriptElement(characters) {
  return `
    <script type="application/json">
      ${JSON.stringify(characters)}
    </script>
  `;
}

function escapeHtml(unsafe) {
  return unsafe;
  return unsafe.replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}
