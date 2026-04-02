import { handleGetCharacterView } from "./handleGetCharacterView.mts";
import { withCharacterPermissions } from "../middleware/characterPermissions.mts";
import { createMiddlewareChain } from "#middleware";
import type { ServerResponse } from "node:http";
import type { NagaraRequest } from "#types";

export function createViewRoute(): (
  req: NagaraRequest,
  res: ServerResponse,
  pathParts: string[],
) => Promise<boolean> {
  const getViewChain = createMiddlewareChain(
    withCharacterPermissions,
    handleGetCharacterView,
  );

  return async (
    req: NagaraRequest,
    res: ServerResponse,
    pathParts: string[],
  ) => {
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
