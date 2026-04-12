import * as api from "api";
import { setCharacters } from "state";
import { navigate } from "router";
import {
  createCharacterCard,
  createNewCharacterCard,
} from "../components/character-card.mjs";

const MAX_CHARACTERS = 6;

export async function renderDashboard(container, params) {
  try {
    container.innerHTML = "<div>Loading dashboard</div>";

    const characters = await api.getCharacters();
    setCharacters(characters);

    container.id = "dashboard-view";
    container.innerHTML = "";
    container.appendChild(buildWelcomeBlock());
    container.appendChild(buildCharacterGrid(characters));

    attachListeners(container);

    return () => {
      container.removeAttribute("id");
      detachListeners(container);
    };
  } catch (error) {
    console.error("Error rendering dashboard:", error);

    container.innerHTML = "";
    const errorBlock = document.createElement("div");
    errorBlock.classList.add("error-state");

    const heading = document.createElement("h2");
    heading.textContent = "Error Loading Dashboard";
    errorBlock.appendChild(heading);

    const message = document.createElement("p");
    message.textContent = error.message;
    errorBlock.appendChild(message);

    const retry = document.createElement("button");
    retry.textContent = "Retry";
    retry.addEventListener("click", () => renderDashboard(container, params));
    errorBlock.appendChild(retry);

    container.appendChild(errorBlock);
    return () => {};
  }
}

function buildWelcomeBlock() {
  const article = document.createElement("article");

  const h1 = document.createElement("h1");
  h1.textContent = "NAGARA";
  article.appendChild(h1);

  const p = document.createElement("p");
  p.innerHTML =
    "All your characters are here. Click on any one or <em>Create</em> new.";
  article.appendChild(p);

  return article;
}

function buildCharacterGrid(characters) {
  const ul = document.createElement("ul");
  ul.setAttribute("role", "grid");
  ul.setAttribute("aria-label", "Character list");

  for (const character of characters) {
    ul.appendChild(createCharacterCard(character));
  }

  if (characters.length < MAX_CHARACTERS) {
    ul.appendChild(createNewCharacterCard());
  }

  return ul;
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

  const action = button.dataset.action;

  if (action === "create") {
    navigate("character/new");
    return;
  }

  const characterId = button.dataset.characterId;
  if (!characterId) return;

  if (action === "view") {
    navigate(`character/${characterId}`);
  } else if (action === "edit") {
    navigate("character/new");
  }
}
