import { renderInitial } from "../templates/initial.mts";
import type { IncomingMessage, ServerResponse } from "node:http";

export async function renderInitialView(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const html = renderInitial();

  // @TODO: set CSP everywhere
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(html),
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  });
  res.end(html);

  return true;
}
