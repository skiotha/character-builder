import { validateDmToken } from "#auth";
import { sanitizeCharacterForRole } from "#models/sanitization";
import * as nagara from "#models";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleGetCharacters(
  req: NagaraRequest,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  const playerId = url.searchParams.get("playerId");

  // List endpoints never expose backupCode regardless of role — it's only
  // meaningful in single-character responses (creation + owner GET).
  const forList = (
    character: Record<string, unknown>,
    role: "dm" | "owner",
  ): Record<string, unknown> => {
    const out = sanitizeCharacterForRole(character, role);
    delete out.backupCode;
    return out;
  };

  if (!playerId) {
    const dmToken = req.headers["x-dm-id"];
    if (validateDmToken(dmToken)) {
      const allChars = await nagara.getAllCharacters();
      const sanitized = allChars.map((c) =>
        forList(c as Record<string, unknown>, "dm"),
      );
      res.writeHead(200);
      res.end(JSON.stringify(sanitized));
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Player ID or DM token required" }));
    }
  } else {
    const characters = await nagara.getPlayerCharacters(playerId);
    const sanitized = characters.map((c) =>
      forList(c as Record<string, unknown>, "owner"),
    );
    res.writeHead(200);
    res.end(JSON.stringify(sanitized));
  }
  return true;
}
