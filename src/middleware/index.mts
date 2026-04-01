export { withCharacterPermissions } from "./characterPermissions.mts";

export function createMiddlewareChain(...middlewares) {
  return async (req, res, pathParts, finalHandler) => {
    try {
      let index = 0;
      let shouldContinue = true;

      const next = async () => {
        if (!shouldContinue) return;

        if (index < middlewares.length) {
          const middleware = middlewares[index++];
          await middleware(req, res, pathParts, next);
        } else {
          await finalHandler(req, res);
        }
      };

      await next();

      return true;
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(error.statusCode || 500, {
          "Content-Type": "application/json",
        });
        res.end(
          JSON.stringify({
            error: error.message || "Internal server error",
          }),
        );
      }

      console.error("Middleware chain error:", error);

      return true;
    }
  };
}

export function extractCharacterId(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.split("/").filter(Boolean);

  const characterIndex = pathParts.indexOf("characters") + 1;
  return pathParts[characterIndex];
}

export function extractCharacterIdFromPath(pathParts) {
  const index = pathParts.findIndex((pathPart) =>
    pathPart.startsWith("character"),
  );

  return pathParts[index + 1];
}
