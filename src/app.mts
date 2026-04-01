import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { MIME_TYPES, PUBLIC_DIR, DATA_DIR, API_ROUTE, LOCAL_ADDRESS } from "#config";
import { requireDmToken } from "./lib/auth.mts";
import * as nagara from "./models/index.mts";
import * as backup from "./lib/backup.mts";

import {
  handleValidateDM,
  handleGetAbilities,
  handleGetCharacters,
  handleUploadPortrait,
  handleUpdateCharacter,
  handleCreateCharacter,
  handleCharacterStream,
} from "./routes/handlers.mts";
import {
  renderInitialView,
  renderCreationView,
  renderDashboardView,
  renderCharacterView,
} from "./renderers/index.mts";
import {
  createViewRoute,
  createCharacterRoute,
} from "./routes/routes.mts";

const getCharacterHandler = createCharacterRoute();
const getViewHandler = createViewRoute();

const PORTRAITS_DIR = path.join(DATA_DIR, "uploads", "portraits");

export default async function app(req, res) {
  const url = new URL(req.url, `http://${LOCAL_ADDRESS}/`);
  const { pathname } = url;

  // Portrait uploads
  if (pathname.startsWith("/uploads/portraits")) {
    return servePortrait(pathname, res);
  }

  // API routes
  if (pathname.startsWith(API_ROUTE)) {
    return handleApi(req, res, url);
  }

  // Asset files
  if (pathname.startsWith("/assets/")) {
    return serveStaticFile(PUBLIC_DIR, pathname.substring(1), res);
  }

  // Client SPA files (everything else)
  return serveClient(pathname, res);
}

async function serveClient(pathname, res) {
  try {
    let filePath = pathname === "/" || pathname === "" ? "/index.html" : pathname;

    const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(PUBLIC_DIR, normalizedPath);

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) throw new Error("Not a file");

    const ext = path.extname(fullPath).slice(1);
    const mimeType = MIME_TYPES[ext] || MIME_TYPES.default;

    res.setHeader("Content-Type", mimeType);
    const content = await fs.readFile(fullPath);
    res.writeHead(200);
    res.end(content);
  } catch {
    // SPA fallback — serve index.html for client-side routing
    try {
      const indexPath = path.join(PUBLIC_DIR, "index.html");
      const content = await fs.readFile(indexPath);
      res.setHeader("Content-Type", "text/html; charset=UTF-8");
      res.writeHead(200);
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
}

async function serveStaticFile(baseDir, relativePath, res) {
  try {
    const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(baseDir, normalizedPath);

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) throw new Error("Not a file");

    const ext = path.extname(fullPath).slice(1);
    const mimeType = MIME_TYPES[ext] || MIME_TYPES.default;

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const content = await fs.readFile(fullPath);
    res.writeHead(200);
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function servePortrait(requestPath, res) {
  try {
    const relativePath = requestPath.replace("/uploads/portraits/", "");

    if (relativePath.includes("..")) {
      res.writeHead(400);
      res.end("Invalid path");
      return;
    }

    const fullPath = path.join(PORTRAITS_DIR, relativePath);

    try {
      await fs.access(fullPath, fss.constants.R_OK);
    } catch {
      res.writeHead(404);
      res.end("Image not found");
      return;
    }

    const stats = await fs.stat(fullPath);
    const ext = path.extname(fullPath).toLowerCase().slice(1);
    const contentType = MIME_TYPES[ext] || MIME_TYPES.default;

    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);

    const stream = fss.createReadStream(fullPath);
    stream.pipe(res);

    stream.on("error", (error) => {
      console.error("Portrait stream error:", error);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Server error");
      }
    });
  } catch (error) {
    console.error("Portrait serve error:", error);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Server error");
    }
  }
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-player-id, x-dm-id",
  );

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const pathParts = pathname
    .replace(API_ROUTE, "")
    .split("/")
    .filter(Boolean);

  try {
    // GET /api/v1/characters/:id/stream
    if (
      req.method === "GET" &&
      pathParts[0] === "characters" &&
      pathParts[1] &&
      pathParts[2] === "stream"
    ) {
      return handleCharacterStream(req, res, pathParts[1]);
    }

    // GET /api/v1/characters
    if (
      req.method === "GET" &&
      pathParts[0] === "characters" &&
      !pathParts[1]
    ) {
      return await handleGetCharacters(req, res, url);
    }

    // GET /api/v1/abilities
    if (req.method === "GET" && pathParts[0] === "abilities") {
      return await handleGetAbilities(req, res);
    }

    // POST /api/v1/characters/:id/portrait
    if (
      req.method === "POST" &&
      pathParts[0] === "characters" &&
      pathParts[1] &&
      pathParts[2] === "portrait"
    ) {
      return await handleUploadPortrait(req, res, pathParts[1]);
    }

    // GET /api/v1/view/dashboard
    if (
      req.method === "GET" &&
      pathParts[0] === "view" &&
      pathParts[1] === "dashboard"
    ) {
      return await renderDashboardView(req, res);
    }

    // GET /api/v1/view/initial
    if (
      req.method === "GET" &&
      pathParts[0] === "view" &&
      pathParts[1] === "initial"
    ) {
      return await renderInitialView(req, res);
    }

    // GET /api/v1/view/creation
    if (
      req.method === "GET" &&
      pathParts[0] === "view" &&
      pathParts[1] === "creation"
    ) {
      return await renderCreationView(req, res);
    }

    // GET /api/v1/view/character/:id
    if (
      req.method === "GET" &&
      pathParts[0] === "view" &&
      pathParts[1] === "character" &&
      pathParts[2]
    ) {
      return await getViewHandler(req, res, pathParts);
    }

    // GET /api/v1/characters/:id
    if (
      req.method === "GET" &&
      pathParts[0] === "characters" &&
      pathParts[1]
    ) {
      return await getCharacterHandler(req, res, pathParts);
    }

    // PATCH /api/v1/characters/:id
    if (
      req.method === "PATCH" &&
      pathParts[0] === "characters" &&
      pathParts[1]
    ) {
      return await handleUpdateCharacter(req, res, pathParts[1]);
    }

    // DELETE /api/v1/characters/:id
    if (
      req.method === "DELETE" &&
      pathParts[0] === "characters" &&
      pathParts[1]
    ) {
      const characterId = pathParts[1];

      try {
        const dmToken = req.headers["x-dm-id"];
        const playerId = req.headers["x-player-id"];

        if (!dmToken && !playerId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Authorization required" }));
          return;
        }

        let result;
        if (dmToken) {
          result = await nagara.deleteCharacterAsDM(characterId, dmToken);
        } else {
          result = await nagara.deleteCharacterAsPlayer(characterId, playerId);
        }

        if (result.success) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              message: "Character deleted",
              type: result.type,
            }),
          );
        } else {
          res.writeHead(result.statusCode || 404);
          res.end(JSON.stringify({ error: result.error }));
        }
      } catch (error) {
        console.error("DELETE error:", error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "Internal server error" }));
      }

      return;
    }

    // POST /api/v1/characters
    if (req.method === "POST" && pathParts[0] === "characters") {
      return await handleCreateCharacter(req, res);
    }

    // POST /api/v1/recover
    if (req.method === "POST" && pathParts[0] === "recover") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));

      req.on("end", async () => {
        try {
          const { characterName, backupCode } = JSON.parse(body);
          const character = await nagara.recoverCharacter(
            characterName,
            backupCode,
          );

          if (character) {
            res.writeHead(200);
            res.end(JSON.stringify(character));
          } else {
            res.writeHead(404);
            res.end(
              JSON.stringify({
                error: "Character not found or invalid backup code",
              }),
            );
          }
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // GET /api/v1/config
    if (req.method === "GET" && pathParts[0] === "config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          apiBase: API_ROUTE,
          maxFileSize: 10485760,
          allowedImageTypes: [
            MIME_TYPES["jpeg"],
            MIME_TYPES["png"],
            MIME_TYPES["gif"],
            MIME_TYPES["webp"],
          ],
        }),
      );
      return;
    }

    // POST /api/v1/backups/characters/:id
    if (
      req.method === "POST" &&
      pathParts[0] === "backups" &&
      pathParts[1] === "characters" &&
      pathParts[2]
    ) {
      const characterId = pathParts[2];
      requireDmToken(req);

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { note } = JSON.parse(body || "{}");
          const backupRecord = await backup.createCharacterBackup(
            characterId,
            note,
          );
          res.writeHead(201, { "Content-Type": "application/json" });
          res.end(JSON.stringify(backupRecord));
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // GET /api/v1/dm/validate
    if (
      req.method === "GET" &&
      pathParts[0] === "dm" &&
      pathParts[1] === "validate"
    ) {
      return await handleValidateDM(req, res);
    }

    // GET /api/v1/backups/characters[/:id]
    if (
      req.method === "GET" &&
      pathParts[0] === "backups" &&
      pathParts[1] === "characters"
    ) {
      requireDmToken(req);
      const characterId = pathParts[2];
      try {
        const backupList = await backup.listCharacterBackups(characterId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(backupList));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // POST /api/v1/backups/restore
    if (
      req.method === "POST" &&
      pathParts[0] === "backups" &&
      pathParts[1] === "restore"
    ) {
      requireDmToken(req);
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const { backupId } = JSON.parse(body);
          if (!backupId) throw new Error("Missing backupId");
          const result = await backup.restoreCharacterBackup(backupId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Not found
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    console.error("API error:", error);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
}
