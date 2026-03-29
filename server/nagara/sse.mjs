import { timeStamp } from "node:console";
import { getCharacter } from "./index.mjs";

const characterClients = new Map();

/**
 * Add a client to the broadcastlis for a specific character
 * @param {string} characterId
 * @param {http.ServerResponse} res -- SSE
 * @param {string} playerId -- authenticated playerId or null
 * @param {boolean} idDM -- me...
 */
export function addClient(characterId, res, playerId, idDM) {
  if (!characterClients.has(characterId)) {
    characterClients.set(characterId, new Set());
  }

  const client = { res, playerId, idDM };
  characterClients.get(characterId).add(client);

  res.on("close", () => {
    removeClient(characterId, res);
  });

  console.info(
    `[SSE] Client added for character ${characterId}. Total: ${characterClients.get(characterId).size}`,
  );
}

/**
 * Remove a client from the broadcast list
 */
export function removeClient(characterId, res) {
  const clients = characterClients.get(characterId);
  if (!clients) return;

  for (const client of clients) {
    if (client.res === res) {
      clients.delete(client);
      break;
    }
  }

  if (clients.size === 0) {
    characterClients.delete(characterId);
  }

  console.info(
    `[SSE] Client removed for characrer ${characterId}. Remaining: ${clients?.size || 0}`,
  );
}

/**
 * Broadcast an update to clients viewing this character
 * @param {string} characterId
 * @param {object} characterData
 */
export function broadcastToCharacter(characterId, characterData) {
  const clients = characterClients.get(characterId);
  if (!clients || clients.size === 0) return;

  const eventData = JSON.stringify({
    type: "character-updated",
    character: characterData,
    timeStamp: new Date().toISOString(),
  });

  const eventString = `event: character-updated\ndata: ${eventData}\n\n`;

  clients.forEach((client) => {
    try {
      client.res.write(eventString);
    } catch (error) {
      console.error(
        `[SSE] Failed to write to client for ${characterId}:`,
        error.message,
      );
      removeClient(characterId, client.res);
    }
  });

  console.info(
    `[SSE] Broadcast to ${clients.size} client(s) for character ${characterId}`,
  );
}

export function sendKeepAlive(characterId) {
  const clients = characterClients.get(characterId);

  if (!clients) return;

  clients.forEach((client) => {
    try {
      client.res.write(": keepalive\n\n");
      // client.res.write("event: ping\ndata: {}\n\n");
    } catch (error) {
      console.log("[SSE] needto remove client:", error);
      removeClient(characterId, client.res);
    }
  });
}
