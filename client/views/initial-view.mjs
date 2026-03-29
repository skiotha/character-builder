import { navigate } from "@router";
import { enhanceElement } from "../behaviors/index.mjs";
import * as api from "@api";

export async function renderInitial(container, params) {
  try {
    container.innerHTML = "<div>Loading welcome screen</div>";

    const html = await api.fetchView("initial");

    const fragment = document.createRange().createContextualFragment(html);

    const portalContent = fragment.querySelector("#portal");

    // @TODO: dialogs should be a separate request
    if (portalContent) {
      const portal = document.querySelector("dialog");
      portal.setAttribute("id", "recover");

      portal.innerHTML = "";
      portal.append(portalContent);
    }

    container.setAttribute("id", "initial-view");
    container.innerHTML = "";
    container.appendChild(fragment);

    attachInitialViewListeners(container);
    enhanceElement(container);
  } catch (error) {
    console.error("Failed to render initial view:", error);
    container.innerHTML = `
      <div class="error">
        <h2>Failed to load</h2>
        <p>${error.message}</p>
      </div>
    `;
  }
  return () => {
    container.removeAttribute("id");
    // @TODO: add to global constants
    document.querySelector("dialog").removeAttribute("id");
    detachInitialViewListeners(container);
  };
}

function attachInitialViewListeners(container) {
  const createBtn = container.querySelector("button[data-action=create]");

  if (createBtn) {
    createBtn.addEventListener("click", handleCreateClick);
  }
}

function detachInitialViewListeners(container) {
  const createBtn = container.querySelector("button[data-action=create]");

  if (createBtn) {
    createBtn.removeEventListener("click", handleCreateClick);
  }
}

const handleCreateClick = () => {
  console.log("to creation");
  navigate("character/new");
};
