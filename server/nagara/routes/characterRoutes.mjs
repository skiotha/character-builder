import { createMiddlewareChain } from "../middleware/middleware.mjs";
import { withCharacterPermissions } from "../middleware/middleware.mjs";
import { handleGetCharacter } from "../handlers/handleGetCharacter.mjs";

export function createCharacterRoute() {
  const getCharacterApiChain = createMiddlewareChain(
    withCharacterPermissions,
    handleGetCharacter,
  );

  return async (req, res, pathParts) => {
    try {
      const handled = await getCharacterApiChain(req, res, pathParts);

      if (!res.headersSent) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      }

      return true;
    } catch (error) {
      console.error("Character route error:", error);

      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }

      return true;
    }
  };
}
