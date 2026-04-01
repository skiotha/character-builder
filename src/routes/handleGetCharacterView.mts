import { renderCharacter } from "../templates/character.mts";
import { sanitizeCharacterForRole } from "../models/sanitization.mts";
import { renderCharacterView } from "../renderers/renderCharacterView.mts";
import { recalculateDerivedFields } from "../rules/derived.mts";

export async function handleGetCharacterView(req, res) {
  const character = req.character;

  if (!character) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Character not found" }));
    return true;
  }

  const recomputedCharacter = recalculateDerivedFields(character);

  const sanitizedCharacter = sanitizeCharacterForRole(
    recomputedCharacter,
    req.characterPermissions.role,
  );

  const viewHTML = renderCharacterView(
    sanitizedCharacter,
    req.characterPermissions,
  );

  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(viewHTML),
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  });
  res.end(viewHTML);

  return true;
}
