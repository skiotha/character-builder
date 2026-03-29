import {
  filterServerControlledFields,
  generateHumanReadableId,
} from "../utils.mjs";
import { createCharacter } from "../index.mjs";
import { validateCharacterCreation } from "../schema/validation.mjs";

export async function handleCreateCharacter(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    try {
      const data = JSON.parse(body);

      let playerId = data.playerId || req.headers["x-player-id"];
      const playerName = data.player || "Unknown";

      if (!playerId) {
        playerId = generateHumanReadableId();
      }

      const filteredData = filterServerControlledFields(data);

      const validation = validateCharacterCreation(
        filteredData,
        playerId,
        playerName,
      );

      if (!validation.success) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Character validation failed",
            details: validation.errors,
            warnings: validation.warnings,
          }),
        );
        return;
      }

      const character = await createCharacter(
        playerId,
        validation.validatedData,
      );

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify(character));
    } catch (error) {
      console.error("Character creation error:", error);

      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: error.message || "Invalid character data" }),
      );
    }
  });

  return true;
}
