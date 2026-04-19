import * as nagara from "#models";
import { validateDmToken } from "#auth";

import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleDeleteCharacter(
  req: NagaraRequest,
  res: ServerResponse,
  characterId: string,
): Promise<boolean> {
  const dmId = req.headers["x-dm-id"];
  const playerId = req.headers["x-player-id"] as string | undefined;
  const isDM = validateDmToken(dmId);

  if (!isDM && !playerId) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: "Authorization required" }));
    return true;
  }

  try {
    const result = isDM
      ? await nagara.deleteCharacterAsDM(characterId, dmId)
      : await nagara.deleteCharacterAsPlayer(characterId, playerId!);

    if (result.success) {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          message: "Character deleted",
          type: result.type,
        }),
      );
    } else {
      res.writeHead(result.statusCode || 404);
      res.end(JSON.stringify({ error: result.error }));
    }
  } catch (error) {
    console.error("DELETE error:", error);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }

  return true;
}
