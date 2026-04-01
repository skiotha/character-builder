const TEXTS = {
  welcome: {
    article: {
      title: "NAGARA",
      welcomeText:
        "This here is a <em>character builder</em> for Nagara RPG. Welcome!",
      description:
        "If this isn&rsquo;t your first visit, yet you still see this page instead of your characters, try <em>Recover</em> button. Or contact me personally, that should work too.",
    },
    contacts: {
      wow: {
        label: "World of Warcraft",
        term: "EU &sol; Argent Dawn",
        url: "https://worldofwarcraft.blizzard.com/en-gb/character/eu/argent-dawn/genetta/",
        tooltip:
          "Find&nbsp;him&nbsp;on&nbsp;the&nbsp;official&nbsp;armory&nbsp;website",
        content: "Genetta",
      },
      discord: {
        label: "Discord",
        tooltip:
          "Click&nbsp;to&nbsp;copy&nbsp;that&nbsp;name&nbsp;to&nbsp;the&nbsp;clipboard",
        content: "black.feather",
      },
      pinterest: {
        label: "Pinterest",
        url: "https://www.pinterest.com/outofhisdepth/aesthetics/",
        tooltip: "Have&nbsp;a&nbsp;look&nbsp;at&nbsp;his&nbsp;board",
        content: "&sol;outofhisdepth",
      },
      flist: {},
    },
    create: {
      content: "CREATE",
      css: ["primary"],
      type: "button",
      action: "create",
      label: "Create new character",
    },
    recover: {
      content: "RECOVER",
      css: [],
      type: "button",
      action: "recover",
      label: "Invoke modal window to help recover own characters",
    },
  },
};

const BEHAVIOR_MAP = {
  discord: ["clipboard-enabled", "hint-enabled"],
  pinterest: ["hint-enabled", "link-enabled"],
  wow: ["hint-enabled", "link-enabled"],
};

export function renderInitial() {
  return `
    ${renderWelcomeBlock()}

    ${renderContactsBlock()}

    ${renderMenuBlock()}

    ${addDialogContent()}
  `;
}

function renderWelcomeBlock() {
  return `
    <article>
      <h1>${TEXTS.welcome.article.title}</h1>

      <p>${TEXTS.welcome.article.welcomeText}</p>

      <p>${TEXTS.welcome.article.description}</p>
    </article>
  `;
}

function renderContactsBlock() {
  return `
    <aside>
      <dl>
        ${renderContactsRow("wow")}

        ${renderContactsRow("discord", 'data-clipboard-text="black.feather"')}

        ${renderContactsRow("pinterest")}
      </dl>
    </aside>
  `;
}

function renderMenuBlock() {
  return `
    <menu>
      ${renderCreateButton()}

      ${renderRecoverButton()}
    </menu>
  `;
}

function renderContactsRow(contactName, customAttribute = "") {
  const contact = TEXTS.welcome.contacts[contactName];

  const behaviorKeys = [...BEHAVIOR_MAP[contactName]].join(" ");

  return `
    <div id="contacts__${contactName}">
      <svg role="img" aria-label="${contact.label} icon">
        <use href="/assets/icons/hero/icon-${contactName}.svg"></use>
      </svg>

      <dt>${escapeHtml(contact.label)}</dt>
      ${contact.term ? `<dt>${escapeHtml(contact.term)}</dt>` : ""}
      <dd>
        <a
          data-behavior="${behaviorKeys}"
          ${contact.url ? `href="${escapeHtml(contact.url)}"` : ""}
          data-tooltip-text="${escapeHtml(contact.tooltip)}"
          ${customAttribute}
          >${escapeHtml(contact.content)}</a
        >
      </dd>
    </div>
  `;
}

function renderCreateButton() {
  return `
    <button
      type="${TEXTS.welcome.create.type}"
      data-action="${TEXTS.welcome.create.action}"
      class="${TEXTS.welcome.create.css.join(" ")}"
      aria-label:"${TEXTS.welcome.create.label}"
    >
      <span>${TEXTS.welcome.create.content}</span>
    </button>
  `;
}

function renderRecoverButton() {
  return `
    <button
      type="${TEXTS.welcome.recover.type}"
      data-action="${TEXTS.welcome.recover.action}"
      command="show-modal"
      commandfor="recover"
      aria-label:"${TEXTS.welcome.recover.label}"
    >
      <span>${TEXTS.welcome.recover.content}</span
    </button>
  `;
}

function addDialogContent() {
  return `
    <form id='portal' name='recover' method='dialog'>
        Recover form placeholder
    </form>
  `;
}

//@TODO: add trusted types support on the client
function escapeHtml(unsafe) {
  return unsafe;
  return unsafe.replace(
    /[&<>"']/g,
    (m) =>
      ({
        // "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}
