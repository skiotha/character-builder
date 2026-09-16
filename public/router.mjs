import * as views from "views";
import { getPlayerToken, isDM } from "state";

let currentView = null;
let rootElement = null;
let isNavigating = false;

const routes = {
  "": {
    view: views.renderInitial,
    auth: false,
  },
  //prettier-ignore
  "dashboard": {
    view: views.renderDashboard,
    auth: true,
  },
  "character/new": {
    view: views.renderCreation,
    auth: false,
  },
  "character/:id": {
    view: views.renderCharacter,
    auth: false,
  },
};

/**
 * Go to a route. Routing is hash-driven: setting the hash fires
 * `hashchange`, which runs `handleRoute`; when the hash already matches
 * (initial load) the route is handled directly.
 * @param {string} path - Route path, with or without a leading `/`
 * @returns {void}
 */
export function navigate(path) {
  if (path.startsWith("/")) {
    path = path.substring(1);
  }

  console.log("navigation initialized: ", path);
  if (window.location.hash.slice(1) === path) {
    handleRoute();
  } else {
    window.location.hash = path;
  }
}

export function init(root) {
  rootElement = root;
  window.addEventListener("hashchange", () => handleRoute());
}

async function handleRoute() {
  // NB-52: a hash change landing during the await below is dropped.
  if (isNavigating) return;

  isNavigating = true;
  try {
    const path = window.location.hash.slice(1);

    let route = matchRoute(path);

    if (!route) {
      console.warn(`No route found for path: ${path}, using default`);
      route = { ...routes[""], pattern: "" };
    } else if (route.auth && !getPlayerToken() && !isDM()) {
      console.warn(`Route ${path} requires a player; showing start page`);
      route = { ...routes[""], pattern: "" };
    }

    const params = extractParams(route.pattern, path);

    if (currentView && currentView.cleanup) {
      currentView.cleanup();
    }

    currentView = {
      cleanup: await route.view(rootElement, params),
    };
  } finally {
    setTimeout(() => {
      isNavigating = false;
    }, 0);
  }
}

function matchRoute(path) {
  const normalizedPath = path.replace(/^\/|\/$/g, "");
  const pathSegments = normalizedPath.split("/").filter(Boolean);

  for (const [pattern, config] of Object.entries(routes)) {
    const patternSegments = pattern.split("/").filter(Boolean);

    if (pattern === "" && normalizedPath === "") {
      return { ...config, pattern, params: {} };
    }

    if (
      patternSegments.length !== pathSegments.length &&
      !patternSegments.includes(":")
    )
      continue;

    let matches = true;
    const params = {};

    for (let i = 0; i < patternSegments.length; i++) {
      const patternSeg = patternSegments[i];
      const pathSeg = pathSegments[i];

      if (patternSeg.startsWith(":")) {
        const paramName = patternSeg.slice(1);
        params[paramName] = pathSeg;
      } else if (patternSeg !== pathSeg) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { ...config, pattern, params };
    }
  }

  return null;
}

function extractParams(pattern, path) {
  const params = {};
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  patternParts.forEach((part, index) => {
    if (part.startsWith(":")) {
      const paramName = part.slice(1);
      params[paramName] = pathParts[index];
    }
  });

  return params;
}
