import { renderCreation } from "../templates/creation.mts";
import type { IncomingMessage, ServerResponse } from "node:http";

export async function renderCreationView(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const html = renderCreation();

  res.writeHead(200, {
    "Content-Type": "text/html",
    "Content-Length": Buffer.byteLength(html),
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  });
  res.end(html);

  return true;
}
