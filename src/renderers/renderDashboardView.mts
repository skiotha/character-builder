import { renderDashboard } from "../templates/dashboard.mts";
import * as nagara from "../models/index.mts";

export async function renderDashboardView(req, res) {
  const playerId = req.headers["x-player-id"];

  if (!playerId) {
    res.writeHead(401, { "Content-Type": "text/html" });
    res.end('<div class="error">Unauthorized</div>');
    return true;
  } else {
    // GET /api/v1/nagara/characters -- Get characters for player

    const characters = await nagara.getPlayerCharacters(playerId);
    const html = renderDashboard(characters);

    res.writeHead(200, {
      "Content-Type": "text/html",
      "Content-Length": Buffer.byteLength(html),
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    });
    res.end(html);
  }
  return true;
}
