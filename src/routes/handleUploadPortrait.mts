import { uploadPortrait } from "../lib/uploads.mts";
import * as nagara from "#models";
import { parseImage } from "../lib/multipart.mts";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export async function handleUploadPortrait(
  req: NagaraRequest,
  res: ServerResponse,
  characterId: string,
): Promise<boolean> {
  try {
    const character = await nagara.getCharacter(characterId);
    if (!character) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Character not found" }));
      return false;
    }

    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid content type" }));
      return false;
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
  } catch (error) {
    console.error("Portrait upload error:", error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Failed to upload portrait " }));

    return false;
  } finally {
    return true;
  }
}
