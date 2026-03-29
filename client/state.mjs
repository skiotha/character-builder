import { validateDM, validateToken } from "./api.mjs";
import { getNestedValue } from "./template-engine.mjs";
import { flatten } from "./utils/flatten.mjs";

const state = {
  playerToken: null,
  player: null,
  characters: [],
  currentCharacter: null,
  templates: new Map(),
  cacheVersion: "1.0",
  userRole: "public",
};

const subscribers = new Map();

function getState() {
  return { ...state };
}

function setState(updatedState) {
  return { ...state, ...updatedState };
}

export function getPlayerToken() {
  return state.playerToken || localStorage.getItem("x-player-id");
}

async function setPlayerToken(token) {
  if (!token && isDM()) {
    localStorage.removeItem("x-player-id");
  }

  try {
    const ok = await validateToken(token);

    if (ok) {
      localStorage.setItem("x-player-id", token);
      state.playerToken = token;
    } else localStorage.removeItem("x-player-id");
  } catch (error) {
    console.error(`Couldn't validate player token:`, error);
  }

  notify("playerToken", token);
}

function setPlayerRole(role) {
  state.userRole = role;
}

function setCurrentCharacter(character) {
  const oldCharacter = state.currentCharacter;

  state.currentCharacter = character;

  // notify("character", character);
  notifyChangedPaths(oldCharacter, character);
}

function setCharacters(characters) {
  state.characters = characters;
  notify("characters", characters);
}

function getTemplate(name) {
  if (state.templates.has(name)) return state.templates.get(name);

  const cached = getCachedTemplate(name);
  if (cached) {
    state.templates.set(name, cached);
    return cached;
  }

  return null;
}

function subscribe(key, callback) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());

  subscribers.get(key).add(callback);

  return () => subscribers.get(key).delete(callback);
}

export function subscribeField(path, callback) {
  if (!subscribers.has(path)) subscribers.set(path, new Set());

  subscribers.get(path).add(callback);

  return () => subscribers.get(path).delete(callback);
}

export function getDMToken() {
  return localStorage.getItem("x-dm-id");
}

export function isDM() {
  return !!getDMToken();
}

export async function setDMToken(token) {
  if (await validateDM(token)) state.userRole = "dm";
}

function notify(path, character) {
  if (subscribers.has(path)) {
    const newValue = getNestedValue(character, path);
    subscribers.get(path).forEach((cb) => cb(newValue, path, character));
  }
}

function notifyChangedPaths(oldChar, newChar) {
  const oldFlat = flatten(oldChar || {});
  const newFlat = flatten(newChar);

  const allPaths = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]);

  allPaths.forEach((path) => {
    if (oldFlat[path] !== newFlat[path]) {
      notify(path, newChar);
    }
  });
}

function cacheTemplate(name, template) {
  const cache = JSON.parse(localStorage.getItem(TEMPLATE_CACHE_KEY) || "{}");
  cache[name] = { template, timestamp: Date.now() };
  localStorage.setItem(TEMPLATE_CACHE_KEY, JSON.stringify(cache));
}

function getCachedTemplate(name) {
  const cache = JSON.parse(localStorage.getItem(TEMPLATE_CACHE_KEY) || "{}");
  const cached = cache[name];

  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)
    return cached.template;

  return null;
}

export {
  subscribe,
  getTemplate,
  setCharacters,
  setPlayerToken,
  getState,
  setCurrentCharacter,
  setState,
  setPlayerRole,
};
