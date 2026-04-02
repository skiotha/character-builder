import type { ServerResponse } from "node:http";

interface SSEClientEntry {
  res: ServerResponse;
  playerId: string | undefined;
  isDM: boolean;
}

const characterClients = new Map<string, Set<SSEClientEntry>>();

export function addClient(
  characterId: string,
  res: ServerResponse,
  playerId: string | undefined,
  isDM: boolean,
): void {
  if (!characterClients.has(characterId)) {
    characterClients.set(characterId, new Set());
  }

  const client: SSEClientEntry = { res, playerId, isDM };
  characterClients.get(characterId)!.add(client);

  res.on("close", () => {
    removeClient(characterId, res);
  });

  console.info(
    `[SSE] Client added for character ${characterId}. Total: ${characterClients.get(characterId)!.size}`,
  );
}

export function removeClient(characterId: string, res: ServerResponse): void {
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
    `[SSE] Client removed for character ${characterId}. Remaining: ${clients?.size || 0}`,
  );
}

export function broadcastToCharacter(
  characterId: string,
  characterData: Record<string, unknown>,
): void {
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
        (error as Error).message,
      );
      removeClient(characterId, client.res);
    }
  });

  console.info(
    `[SSE] Broadcast to ${clients.size} client(s) for character ${characterId}`,
  );
}

export function sendKeepAlive(characterId: string): void {
  const clients = characterClients.get(characterId);

  if (!clients) return;

  clients.forEach((client) => {
    try {
      client.res.write(": keepalive\n\n");
    } catch (error) {
      console.log("[SSE] need to remove client:", error);
      removeClient(characterId, client.res);
    }
  });
}
