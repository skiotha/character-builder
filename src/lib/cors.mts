import { CORS_ORIGINS } from "#config";

import type { IncomingMessage, ServerResponse } from "node:http";

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return CORS_ORIGINS.includes(origin);
}

/**
 * Apply CORS headers to a response.
 *
 * - Always sets `Vary: Origin` so caches stay safe regardless of outcome.
 * - Reflects the request `Origin` header only when whitelisted.
 * - Does NOT set `Access-Control-Allow-Credentials` (header-based auth
 *   needs no cookies; revisit if auth model changes).
 * - For preflight (`OPTIONS`), also sets allowed methods + headers when the
 *   origin is whitelisted.
 */
function applyCors(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader("Vary", "Origin");

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return;

  res.setHeader("Access-Control-Allow-Origin", origin!);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-player-id, x-dm-id",
  );
}

export { applyCors, isAllowedOrigin };
