import { validateDmToken } from "#auth";
import { addClient, removeClient } from "#sse";
import { getCharacter } from "#models/storage";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleCharacterStream(
  req: NagaraRequest,
  res: ServerResponse,
  characterId: string,
): Promise<boolean> {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const playerId =
    url.searchParams.get("playerId") ||
    (req.headers["x-player-id"] as string | undefined);
  const dmId = url.searchParams.get("dmId") || req.headers["x-dm-id"];
  const isDM = validateDmToken(dmId);

  // if (!playerId && !isDM) {
  //     res.writeHead(401)
  //     res.end('Unauthorized: player ID or DM token required')
  //     return true
  // }

  const character = await getCharacter(characterId);
  if (!character) {
    res.writeHead(404);
    res.end("Character not found");
    return true;
  }

  const isOwner = (character as Record<string, unknown>).playerId === playerId;
  // if (!isOwner && !isDM) {
  //     res.writeHead(403)
  //     res.end('Forbidden: you do not have access to this character')
  //     return true
  // }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": req.headers.origin || "*",
  });

  const initialEvent = `event: connected\ndata: ${JSON.stringify({ message: "SSE stream established" })}\n\n`;
  res.write(initialEvent);

  addClient(characterId, res, playerId, isDM);

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
      // res.write("event: ping\ndata: {}\n\n");
    } catch (error) {
      console.error("[SSE] keep-alive write failed", (error as Error).message);
      clearInterval(keepAliveInterval);
      removeClient(characterId, res);
    }
  }, 30000);

  res.on("close", () => {
    clearInterval(keepAliveInterval);
    removeClient(characterId, res);
  });

  return true;
}
