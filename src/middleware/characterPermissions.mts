import { getCharacter } from "../models/storage.mts";
import { validateDmToken } from "#auth";
import { extractCharacterIdFromPath } from "./index.mts";

export async function withCharacterPermissions(req, res, pathParts, next) {
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

    if (character.deleted && !isDM) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Character not found" }));
      return;
    }

    const playerId = req.headers["x-player-id"];
    const isOwner = character.playerId === playerId;

    req.characterPermissions = {
      role: isDM ? "dm" : isOwner ? "owner" : "public",
    };

    req.character = character;

    if (!res.headersSent) {
      await next();
    }
  } catch (error) {
    console.error("Permission middleware error:", error);

    if (!res.headerSent) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
}
