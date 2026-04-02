export { withCharacterPermissions } from "./characterPermissions.mts";
import type { ServerResponse } from "node:http";
import type {
  NagaraRequest,
  MiddlewareFn,
  MiddlewareChainHandler,
} from "#types";

export function createMiddlewareChain(
  ...middlewares: MiddlewareFn[]
): MiddlewareChainHandler {
  return async (
    req: NagaraRequest,
    res: ServerResponse,
    pathParts: string[],
    finalHandler?: (
      req: NagaraRequest,
      res: ServerResponse,
    ) => Promise<boolean | void> | boolean | void,
  ) => {
    try {
      let index = 0;

      const next = async (): Promise<void> => {
        if (index < middlewares.length) {
          const middleware = middlewares[index++]!;
          await middleware(req, res, pathParts, next);
        } else if (finalHandler) {
          await finalHandler(req, res);
        }
      };

      await next();

      return true;
    } catch (error) {
      if (!res.headersSent) {
        const err = error as Error & { statusCode?: number };
        res.writeHead(err.statusCode || 500, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({
            error: err.message || "Internal server error",
          }),
        );
      }

      console.error("Middleware chain error:", error);

      return true;
    }
  };
}

export function extractCharacterId(req: NagaraRequest): string | undefined {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const pathParts = url.pathname.split("/").filter(Boolean);

  const characterIndex = pathParts.indexOf("characters") + 1;
  return pathParts[characterIndex];
}

export function extractCharacterIdFromPath(pathParts: string[]): string {
  const index = pathParts.findIndex((pathPart) =>
    pathPart.startsWith("character"),
  );

  return pathParts[index + 1]!;
}
