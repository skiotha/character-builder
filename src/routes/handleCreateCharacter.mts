import type { ServerResponse } from "node:http";

import {
  filterServerControlledFields,
  generateHumanReadableId,
} from "../lib/utils.mts";
import { BodyTooLargeError, MAX_JSON_BODY, readBody } from "../lib/body.mts";
import { createCharacter } from "#models";
import { validateCharacterCreation } from "#models/validation";
import { validateCatalogRefs } from "#models/reference-validation";

import type { NagaraRequest } from "#types";

export async function handleCreateCharacter(
  req: NagaraRequest,
  res: ServerResponse,
): Promise<boolean> {
  try {
    const body = await readBody(req, MAX_JSON_BODY);
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
      return true;
    }

    // Strict catalog-membership pass over the merged result (defaults +
    // payload). Async because it reads the reference catalogs, so it
    // composes here rather than inside the sync schema validation; same
    // 400 surface as a schema failure.
    const refErrors = await validateCatalogRefs(
      validation.validatedData as Record<string, unknown>,
    );
    if (refErrors.length > 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Character validation failed",
          details: refErrors,
          warnings: validation.warnings,
        }),
      );
      return true;
    }

    const character = await createCharacter(
      playerId,
      validation.validatedData!,
    );

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(character));
    return true;
  } catch (error) {
    console.error("Character creation error:", error);

    if (error instanceof BodyTooLargeError) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
      return true;
    }

    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: (error as Error).message || "Invalid character data",
      }),
    );
    return true;
  }
}
