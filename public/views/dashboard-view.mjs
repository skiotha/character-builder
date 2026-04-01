import * as api from "api";
import { getState, setCharacters } from "state";
import { navigate } from "router";

export async function renderDashboard(container, params) {
  try {
    const state = getState();

    // if (!state.playerToken) {
    //   console.warn("No player token found, redirecting to initial view");
    //   navigate("/");
    //   return () => {};
    // }

    container.innerHTML = "<div>Loading dashboard</div>";
    const html = await api.fetchView("dashboard");

    const fragment = document.createRange().createContextualFragment(html);

    const dataScript = fragment.querySelector(
      'script[type="application/json"]',
    );
    if (dataScript) {
      const characters = JSON.parse(dataScript.textContent);
      setCharacters(characters);

      dataScript.remove();
    }

    container.setAttribute("id", "dashboard-view");
    container.innerHTML = "";
    container.appendChild(fragment);

    console.log(getState());

    attachDashboardViewListeners(container);

    return () => {
      console.log("Dashboard cleanup");
      container.removeAttribute("id");
      detachDashboardViewListeners(container);
    };
  } catch (error) {
    console.error("Error rendering dashboard: ", error);

    container.innerHTML = `
      <div class="error-state">
        <h2>Error Loading Dashboard</h2>
        <p>${error.message}</p>
        <button id="retry" class="btn-primary">Retry</button>
        <button id="go-home" class="btn-secondary">Go Home</button>
      </div>
    `;

    container.querySelector("#retry").addEventListener("click", () => {
      renderDashboard(container, params);
    });

    return () => {};
  }
}

function attachDashboardViewListeners(container) {
  const editBtns = container.querySelectorAll("button[data-action=edit]");
  const viewBtns = container.querySelectorAll("button[data-action=view]");
  const createBtns = document.querySelectorAll("button[data-action=create]");

  if (!!createBtns.length) {
    createBtns.forEach((btn) =>
      btn.addEventListener("click", handleCreateClick),
    );
  }

  if (!!editBtns.length) {
    editBtns.forEach((btn) => btn.addEventListener("click", handleEditClick));
  }

  if (!!viewBtns.length) {
    viewBtns.forEach((btn) => btn.addEventListener("click", handleViewClick));
  }
}

function detachDashboardViewListeners(container) {
  const editBtns = container.querySelectorAll("button[data-action=edit]");
  const viewBtns = container.querySelectorAll("button[data-action=view]");
  const createBtns = document.querySelectorAll("button[data-action=create]");

  if (!!createBtns.length) {
    createBtns.forEach((btn) =>
      btn.removeEventListener("click", handleCreateClick),
    );
  }

  if (!!editBtns.length) {
    editBtns.forEach((btn) =>
      btn.removeEventListener("click", handleEditClick),
    );
  }

  if (!!viewBtns.length) {
    viewBtns.forEach((btn) =>
      btn.removeEventListener("click", handleViewClick),
    );
  }
}

const handleEditClick = () => {
  console.log("Editing!");
  navigate("character/new");
};

const handleViewClick = (e) => {
  e.preventDefault();

  const characterId = e.target.closest("button").dataset.characterId;

  if (characterId) {
    navigate(`character/${characterId}`);
  } else {
    console.error("Failed to find character's ID!");
  }
};

const handleCreateClick = () => {
  console.log("to creation");
  navigate("character/new");
};
