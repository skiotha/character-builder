import { navigate } from "router";
import { enhanceElement, cleanupBehaviors } from "../behaviors/index.mjs";

const CONTACTS = [
  {
    id: "wow",
    label: "World of Warcraft",
    term: "EU / Argent Dawn",
    url: "https://worldofwarcraft.blizzard.com/en-gb/character/eu/argent-dawn/genetta/",
    tooltip:
      "Find\u00a0him\u00a0on\u00a0the\u00a0official\u00a0armory\u00a0website",
    content: "Genetta",
    behaviors: "hint-enabled link-enabled",
  },
  {
    id: "discord",
    label: "Discord",
    tooltip:
      "Click\u00a0to\u00a0copy\u00a0that\u00a0name\u00a0to\u00a0the\u00a0clipboard",
    content: "black.feather",
    behaviors: "clipboard-enabled hint-enabled",
    clipboardText: "black.feather",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    url: "https://www.pinterest.com/outofhisdepth/aesthetics/",
    tooltip: "Have\u00a0a\u00a0look\u00a0at\u00a0his\u00a0board",
    content: "/outofhisdepth",
    behaviors: "hint-enabled link-enabled",
  },
];

export async function renderInitial(container, params) {
  container.id = "initial-view";
  container.innerHTML = "";

  container.appendChild(buildWelcomeBlock());
  container.appendChild(buildContactsBlock());
  container.appendChild(buildMenuBlock());

  enhanceElement(container);
  attachListeners(container);

  return () => {
    container.removeAttribute("id");
    cleanupBehaviors(container);
    detachListeners(container);
  };
}

function buildWelcomeBlock() {
  const article = document.createElement("article");

  const h1 = document.createElement("h1");
  h1.textContent = "NAGARA";
  article.appendChild(h1);

  const p1 = document.createElement("p");
  p1.innerHTML =
    "This here is a <em>character builder</em> for Nagara RPG. Welcome!";
  article.appendChild(p1);

  const p2 = document.createElement("p");
  p2.innerHTML =
    "If this isn\u2019t your first visit, yet you still see this page instead of your characters, try <em>Recover</em> button. Or contact me personally, that should work too.";
  article.appendChild(p2);

  return article;
}

function buildContactsBlock() {
  const aside = document.createElement("aside");
  const dl = document.createElement("dl");

  for (const contact of CONTACTS) {
    const wrapper = document.createElement("div");
    wrapper.id = `contacts__${contact.id}`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${contact.label} icon`);
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `/assets/icons/hero/icon-${contact.id}.svg`);
    svg.appendChild(use);
    wrapper.appendChild(svg);

    const dt = document.createElement("dt");
    dt.textContent = contact.label;
    wrapper.appendChild(dt);

    if (contact.term) {
      const dt2 = document.createElement("dt");
      dt2.textContent = contact.term;
      wrapper.appendChild(dt2);
    }

    const dd = document.createElement("dd");
    const a = document.createElement("a");
    a.dataset.behavior = contact.behaviors;
    if (contact.url) a.href = contact.url;
    a.dataset.tooltipText = contact.tooltip;
    if (contact.clipboardText) a.dataset.clipboardText = contact.clipboardText;
    a.textContent = contact.content;
    dd.appendChild(a);
    wrapper.appendChild(dd);

    dl.appendChild(wrapper);
  }

  aside.appendChild(dl);
  return aside;
}

function buildMenuBlock() {
  const menu = document.createElement("menu");

  const createBtn = document.createElement("button");
  createBtn.type = "button";
  createBtn.dataset.action = "create";
  createBtn.classList.add("primary");
  createBtn.setAttribute("aria-label", "Create new character");
  const createSpan = document.createElement("span");
  createSpan.textContent = "CREATE";
  createBtn.appendChild(createSpan);

  const recoverBtn = document.createElement("button");
  recoverBtn.type = "button";
  recoverBtn.dataset.action = "recover";
  recoverBtn.setAttribute(
    "aria-label",
    "Invoke modal window to help recover own characters",
  );
  const recoverSpan = document.createElement("span");
  recoverSpan.textContent = "RECOVER";
  recoverBtn.appendChild(recoverSpan);

  menu.appendChild(createBtn);
  menu.appendChild(recoverBtn);

  return menu;
}

function attachListeners(container) {
  container.addEventListener("click", handleContainerClick);
}

function detachListeners(container) {
  container.removeEventListener("click", handleContainerClick);
}

function handleContainerClick(e) {
  const button = e.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "create") {
    navigate("character/new");
  }
}
