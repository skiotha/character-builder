import { getCharacter, updateCharacter } from "../storage.mjs";
import { validateCharacterUpdate } from "../schema/validation.mjs";
import { validateDmToken } from "../auth.mjs";
import { applyFieldUpdate } from "../schema/utils.mjs";
import { recalculateDerivedFields } from "../rules/derived.mjs";
import { broadcastToCharacter } from "../sse.mjs";

export async function handleUpdateCharacter(req, res, characterId) {
  const playerId = req.headers["x-player-id"];

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
        : character.playerId === playerId
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
        console.log("ERRORS ON PATCH", errors);
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
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            character: savedCharacter,
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
        res.end(JSON.stringify({ error: error.message }));
      }
    }
  });

  return true;
}
