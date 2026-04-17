import { getCharacter, updateCharacter } from "#models/storage";
import { validateCharacterUpdate } from "#models/validation";
import { validateDmToken } from "#auth";
import { applyFieldUpdate } from "#models/schema-utils";
import { sanitizeCharacterForRole } from "#models/sanitization";
import { recalculateDerivedFields } from "#rules";
import { broadcastToCharacter } from "#sse";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleUpdateCharacter(
  req: NagaraRequest,
  res: ServerResponse,
  characterId: string,
): Promise<boolean> {
  const playerId = req.headers["x-player-id"] as string | undefined;

  const dmId = req.headers["x-dm-id"];
  const isDM = validateDmToken(dmId);

  if (!playerId && !isDM) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: "Player ID or DM token required" }));

    return true;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const { updates } = JSON.parse(body);

      if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error("No updates provided");
      }

      const character = await getCharacter(characterId);
      if (!character) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Character not found" }));

        return true;
      }

      const userRole = isDM
        ? "dm"
        : (character as Record<string, unknown>).playerId === playerId
          ? "owner"
          : "public";

      if (userRole === "public") {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Not authorized" }));

        return true;
      }

      const { validUpdates, errors } = await validateCharacterUpdate(
        updates,
        character,
        userRole,
        // { fullValidation: true },
      );

      if (errors.length > 0) {
        if (!res.headersSent) {
          res.writeHead(422);
          res.end(
            JSON.stringify({
              error: "Some updates failed",
              validUpdates,
              errors,
            }),
          );

          return true;
        } else {
          console.error("Headers already sent", {
            url: req.url,
            method: req.method,
          });
        }
      }

      let updatedCharacter = structuredClone(character);
      for (const update of validUpdates) {
        applyFieldUpdate(
          updatedCharacter,
          update.field,
          update.value,
          update.operation,
        );
      }

      updatedCharacter = recalculateDerivedFields(updatedCharacter);

      const savedCharacter = await updateCharacter(
        characterId,
        updatedCharacter,
      );

      broadcastToCharacter(characterId, savedCharacter);

      if (!res.headersSent) {
        const sanitized = sanitizeCharacterForRole(
          savedCharacter as Record<string, unknown>,
          userRole,
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            character: sanitized,
          }),
        );
      } else {
        console.error("Headers already sent", {
          url: req.url,
          method: req.method,
        });
      }
    } catch (error) {
      console.error("PATCH error:", error);
      if (!res.headersSent) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    }
  });

  return true;
}
