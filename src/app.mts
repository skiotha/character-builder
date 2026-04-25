import fs from "node:fs/promises";
import fss from "node:fs";
import path from "node:path";
import { URL } from "node:url";

import { requireDmToken } from "#auth";
import * as nagara from "#models";
import * as backup from "./lib/backup.mts";
import { recalculate } from "#rules";
import { broadcastToCharacter, broadcastCharacterDeleted } from "#sse";
import {
  handleValidateDM,
  handleGetTraits,
  handleGetTalents,
  handleGetRituals,
  handleGetWeapons,
  handleGetArmor,
  handleGetCharacters,
  handleUpdateCharacter,
  handleCreateCharacter,
  handleDeleteCharacter,
  handleCharacterStream,
  handleRecover,
} from "#routes";
import { applyCors } from "./lib/cors.mts";
import { BodyTooLargeError, MAX_JSON_BODY, readBody } from "./lib/body.mts";
import { createCharacterRoute, createPortraitRoute } from "./routes/routes.mts";
import { getSerializedSchema } from "#models/schema-serializer";

import {
  MIME_TYPES,
  PUBLIC_DIR,
  DATA_DIR,
  API_ROUTE,
  LOCAL_ADDRESS,
} from "#config";

import type { IncomingMessage, ServerResponse } from "node:http";
import type { NagaraRequest, Character } from "#types";
import type { Registry } from "#rules";

const getCharacterHandler = createCharacterRoute();
const portraitHandler = createPortraitRoute();

const PORTRAITS_DIR = path.join(DATA_DIR, "uploads", "portraits");

// TODO(phase6-chunk-G): replace with createRegistry() loading from
// REFERENCE_DIR. Chunk C ships an empty stub so character.traits[] always
// resolves to no effects (the engine warns and skips on miss).
const emptyRegistry: Registry = {
  lookupTrait: () => null,
  lookupTalent: () => null,
};

// Wire the character service once at startup (ADR-013). Domain mutations
// throw until this runs, so it must happen at module top-level — before
// any request can land.
nagara.initCharacterService({
  recalc: (character) => recalculate(character, emptyRegistry),
  broadcast: broadcastToCharacter,
  broadcastDeleted: broadcastCharacterDeleted,
});

export default async function app(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url!, `http://${LOCAL_ADDRESS}/`);
  const { pathname } = url;

  // Portrait uploads
  if (pathname.startsWith("/uploads/portraits")) {
    return servePortrait(pathname, res);
  }

  // API routes
  if (pathname.startsWith(API_ROUTE)) {
    await handleApi(req as NagaraRequest, res, url);
    return;
  }

  // Asset files
  if (pathname.startsWith("/assets/")) {
    return serveStaticFile(PUBLIC_DIR, pathname.substring(1), res);
  }

  // Client SPA files (everything else)
  return serveClient(pathname, res);
}

async function serveClient(
  pathname: string,
  res: ServerResponse,
): Promise<void> {
  try {
    let filePath =
      pathname === "/" || pathname === "" ? "/index.html" : pathname;

    const normalizedPath = path
      .normalize(filePath)
      .replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(PUBLIC_DIR, normalizedPath);

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) throw new Error("Not a file");

    const ext = path.extname(fullPath).slice(1);
    const mimeType = MIME_TYPES[ext] || MIME_TYPES["default"];

    res.setHeader("Content-Type", mimeType!);
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

async function serveStaticFile(
  baseDir: string,
  relativePath: string,
  res: ServerResponse,
): Promise<void> {
  try {
    const normalizedPath = path
      .normalize(relativePath)
      .replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(baseDir, normalizedPath);

    const stat = await fs.stat(fullPath);
    if (!stat.isFile()) throw new Error("Not a file");

    const ext = path.extname(fullPath).slice(1);
    const mimeType = MIME_TYPES[ext] || MIME_TYPES["default"];

    res.setHeader("Content-Type", mimeType!);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const content = await fs.readFile(fullPath);
    res.writeHead(200);
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function servePortrait(
  requestPath: string,
  res: ServerResponse,
): Promise<void> {
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
    const contentType = MIME_TYPES[ext] || MIME_TYPES["default"];

    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Type", contentType!);
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

async function handleApi(
  req: NagaraRequest,
  res: ServerResponse,
  url: URL,
): Promise<boolean | void> {
  const { pathname } = url;

  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const pathParts = pathname.replace(API_ROUTE, "").split("/").filter(Boolean);

  try {
    // GET /api/v1/characters/:id/stream
    if (
      req.method === "GET" &&
      pathParts[0] === "characters" &&
      pathParts[1] &&
      pathParts[2] === "stream"
    ) {
      return handleCharacterStream(req, res, pathParts[1]!);
    }

    // GET /api/v1/characters
    if (
      req.method === "GET" &&
      pathParts[0] === "characters" &&
      !pathParts[1]
    ) {
      return await handleGetCharacters(req, res, url);
    }

    // GET /api/v1/traits | /talents | /rituals | /weapons | /armor
    if (req.method === "GET" && pathParts[0] && !pathParts[1]) {
      switch (pathParts[0]) {
        case "traits":
          return await handleGetTraits(req, res);
        case "talents":
          return await handleGetTalents(req, res);
        case "rituals":
          return await handleGetRituals(req, res);
        case "weapons":
          return await handleGetWeapons(req, res);
        case "armor":
          return await handleGetArmor(req, res);
      }
    }

    // GET /api/v1/schema
    if (req.method === "GET" && pathParts[0] === "schema") {
      const { json, etag } = getSerializedSchema();

      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch === etag) {
        res.writeHead(304);
        res.end();
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=86400",
        ETag: etag,
        "Content-Length": Buffer.byteLength(json),
      });
      res.end(json);
      return;
    }

    // POST /api/v1/characters/:id/portrait
    if (
      req.method === "POST" &&
      pathParts[0] === "characters" &&
      pathParts[1] &&
      pathParts[2] === "portrait"
    ) {
      return await portraitHandler(req, res, pathParts);
    }

    // GET /api/v1/characters/:id
    if (req.method === "GET" && pathParts[0] === "characters" && pathParts[1]) {
      return await getCharacterHandler(req, res, pathParts);
    }

    // PATCH /api/v1/characters/:id
    if (
      req.method === "PATCH" &&
      pathParts[0] === "characters" &&
      pathParts[1]
    ) {
      return await handleUpdateCharacter(req, res, pathParts[1]!);
    }

    // DELETE /api/v1/characters/:id
    if (
      req.method === "DELETE" &&
      pathParts[0] === "characters" &&
      pathParts[1]
    ) {
      return void (await handleDeleteCharacter(req, res, pathParts[1]!));
    }

    // POST /api/v1/characters
    if (req.method === "POST" && pathParts[0] === "characters") {
      return await handleCreateCharacter(req, res);
    }

    // POST /api/v1/recover
    if (req.method === "POST" && pathParts[0] === "recover") {
      return void (await handleRecover(req, res));
    }

    // GET /api/v1/config
    if (req.method === "GET" && pathParts[0] === "config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          apiBase: API_ROUTE,
          maxFileSize: 20_971_520,
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
      const characterId = pathParts[2]!;
      requireDmToken(req);

      try {
        const body = await readBody(req, MAX_JSON_BODY);
        const { note } = JSON.parse(body || "{}");
        const backupRecord = await backup.createCharacterBackup(
          characterId,
          note,
        );
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(backupRecord));
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(500);
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      }
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
        res.end(JSON.stringify({ error: (error as Error).message }));
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
      try {
        const body = await readBody(req, MAX_JSON_BODY);
        const { backupId } = JSON.parse(body);
        if (!backupId) throw new Error("Missing backupId");
        const result = await backup.restoreCharacterBackup(backupId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        if (error instanceof BodyTooLargeError) {
          res.writeHead(413);
          res.end(JSON.stringify({ error: error.message }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: (error as Error).message }));
        }
      }
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
