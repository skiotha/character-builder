import { handleGetCharacterView } from "./handleGetCharacterView.mts";
import { withCharacterPermissions } from "../middleware/characterPermissions.mts";
import { createMiddlewareChain } from "#middleware";

export function createViewRoute() {
  const getViewChain = createMiddlewareChain(
    withCharacterPermissions,
    handleGetCharacterView,
  );

  return async (req, res, pathParts) => {
    try {
      const handled = await getViewChain(req, res, pathParts);

      if (!res.headersSent) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      }

      return true;
    } catch (error) {
      console.error("View route error:", error);

      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }

      return true;
    }
  };
}
