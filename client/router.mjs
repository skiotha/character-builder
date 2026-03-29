import * as views from "@views";
import { getState } from "@state";

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
    auth: true,
  },
};

export function navigate(path, data = {}) {
  if (path.startsWith("/")) {
    path = path.substring(1);
  }

  window.location.hash = path;
  console.log("navigation initialized: ", path);
  handleRoute(data);
}

export function init(root) {
  rootElement = root;
}

async function handleRoute(data = {}) {
  if (isNavigating) return;

  isNavigating = true;
  try {
    const hash = window.location.hash.slice(1);
    const path = hash || "";

    const route = matchRoute(path);

    if (!route) {
      console.warn(`No route found for path: ${path}, using default`);
      return routes[""].view(rootElement, data);
    }

    const params = extractParams(route.pattern, path);

    if (currentView && currentView.cleanup) {
      currentView.cleanup();
    }

    currentView = {
      cleanup: await route.view(rootElement, { ...data, ...params }),
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
