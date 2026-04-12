import { validateDM, validateToken } from "./api.mjs";
import { flatten } from "./utils/flatten.mjs";

function getNestedValue(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

const state = {
  playerToken: null,
  player: null,
  characters: [],
  currentCharacter: null,
  schema: null,
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

function setSchema(schema) {
  state.schema = schema;
}

function getSchema() {
  return state.schema;
}

export {
  subscribe,
  setCharacters,
  setPlayerToken,
  getState,
  setCurrentCharacter,
  setState,
  setPlayerRole,
  setSchema,
  getSchema,
};
