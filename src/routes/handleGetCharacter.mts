import { sanitizeCharacterForRole } from "../models/sanitization.mts";

export async function handleGetCharacter(req, res) {
  const character = req.character;

  if (character) {
    const sanitizedCharacter = sanitizeCharacterForRole(
      character,
      req.characterPermissions.role,
    );

    const response = {
      ...sanitizedCharacter,
      _permissions: req.characterPermissions,
    };

    res.writeHead(200);
    res.end(JSON.stringify(response));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Character not found" }));
  }

  return true;
}
