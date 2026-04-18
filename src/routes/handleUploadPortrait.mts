import { uploadPortrait } from "../lib/uploads.mts";
import * as nagara from "#models";
import { parseImage } from "../lib/multipart.mts";
import { BodyTooLargeError } from "../lib/body.mts";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleUploadPortrait(
  req: NagaraRequest,
  res: ServerResponse,
): Promise<boolean> {
  try {
    const character = req.character;
    const permissions = req.characterPermissions;

    if (!character || !permissions) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Character not found" }));
      return true;
    }

    if (permissions.role === "public") {
      res.writeHead(403);
      res.end(JSON.stringify({ error: "Not authorized" }));
      return true;
    }

    const characterId = character.id as string;

    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid content type" }));
      return true;
    }

    const { filename, stream } = await parseImage(req, boundaryMatch[1]!);

    const portraitPath = await uploadPortrait(characterId, stream, filename);

    const charData = character as Record<string, Record<string, unknown>>;
    (charData.portrait as Record<string, unknown>).path = portraitPath;
    (charData.portrait as Record<string, unknown>).status = "uploaded";
    (character as Record<string, unknown>).lastModified =
      new Date().toISOString();

    await nagara.updateCharacter(
      characterId,
      character as Record<string, unknown>,
    );

    res.writeHead(200);
    res.end(
      JSON.stringify({
        success: true,
        portraitPath,
        message: "Portrait uploaded successfully",
      }),
    );
    return true;
  } catch (error) {
    console.error("Portrait upload error:", error);
    if (!res.headersSent) {
      if (error instanceof BodyTooLargeError) {
        res.writeHead(413);
        res.end(JSON.stringify({ error: error.message }));
      } else {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Failed to upload portrait" }));
      }
    }
    return true;
  }
}
