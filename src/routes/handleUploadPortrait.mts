import { uploadPortrait } from "../lib/uploads.mts";
import * as nagara from "../models/index.mts";
import { parseImage } from "../lib/multipart.mts";

export async function handleUploadPortrait(req, res, characterId) {
  try {
    const character = await nagara.getCharacter(characterId);
    if (!character) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Character not found" }));
      return false;
    }

    const contentType = req.headers["content-type"];
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid content type" }));
      return false;
    }

    const { filename, stream } = await parseImage(req, boundaryMatch[1]);

    const portraitPath = await uploadPortrait(characterId, stream, filename);

    character.portrait.path = portraitPath;
    character.portrait.status = "uploaded";
    character.lastModified = new Date().toISOString();

    await nagara.updateCharacter(characterId, character);

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
