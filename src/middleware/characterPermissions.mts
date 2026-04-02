import { getCharacter } from "#models/storage";
import { validateDmToken } from "#auth";
import { extractCharacterIdFromPath } from "./index.mts";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function withCharacterPermissions(
  req: NagaraRequest,
  res: ServerResponse,
  pathParts: string[],
  next: () => Promise<void>,
): Promise<void> {
  try {
    const characterId = extractCharacterIdFromPath(pathParts);
    const character = await getCharacter(characterId);

    if (!character) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Character not found" }));
      return;
    }

    const dmToken = req.headers["x-dm-id"];
    const isDM = dmToken && validateDmToken(dmToken);

    if ((character as Record<string, unknown>).deleted && !isDM) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Character not found" }));
      return;
    }

    const playerId = req.headers["x-player-id"];
    const isOwner =
      (character as Record<string, unknown>).playerId === playerId;

    req.characterPermissions = {
      role: isDM ? "dm" : isOwner ? "owner" : "public",
    };

    req.character = character as Record<string, unknown>;

    if (!res.headersSent) {
      await next();
    }
  } catch (error) {
    console.error("Permission middleware error:", error);

    if (!res.headersSent) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
}
