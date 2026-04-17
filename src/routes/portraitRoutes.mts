import type { ServerResponse } from "node:http";

import { createMiddlewareChain, withCharacterPermissions } from "#middleware";
import { handleUploadPortrait } from "./handleUploadPortrait.mts";

import type { NagaraRequest } from "#types";

export function createPortraitRoute(): (
  req: NagaraRequest,
  res: ServerResponse,
  pathParts: string[],
) => Promise<boolean> {
  const uploadPortraitChain = createMiddlewareChain(
    withCharacterPermissions,
    handleUploadPortrait,
  );

  return async (
    req: NagaraRequest,
    res: ServerResponse,
    pathParts: string[],
  ) => {
    try {
      await uploadPortraitChain(req, res, pathParts);

      if (!res.headersSent) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
      }

      return true;
    } catch (error) {
      console.error("Portrait route error:", error);

      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }

      return true;
    }
  };
}
