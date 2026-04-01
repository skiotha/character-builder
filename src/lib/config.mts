import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

const isDev = process.env.NODE_ENV !== "production";

const PORT = parseInt(process.env.PORT, 10) || (isDev ? 3000 : 443);
const LOCAL_ADDRESS = process.env.LOCAL_ADDRESS || (isDev ? "127.0.0.1" : "0.0.0.0");

const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const DATA_DIR = join(PROJECT_ROOT, "data");

const ENCODING = "utf8";
const API_ROUTE = "/api/v1";

const DM_TOKEN = process.env.NAGARA_DM_TOKEN;

const MIME_TYPES = {
  default: "application/octet-stream",
  plain: "text/plain",
  html: "text/html; charset=UTF-8",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  png: "image/png",
  webp: "image/webp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  avif: "image/avif",
  mp3: "audio/mpeg",
  ttf: "font/ttf",
  woff: "font/woff",
  woff2: "font/woff2",
  otf: "font/otf",
  json: "application/json",
  stream: "text/event-stream",
};

const SSL =
  isDev
    ? null
    : process.env.SSL_KEY && process.env.SSL_CERT
      ? {
          key: readFileSync(process.env.SSL_KEY),
          cert: readFileSync(process.env.SSL_CERT),
        }
      : null;

export {
  PORT,
  LOCAL_ADDRESS,
  MIME_TYPES,
  ENCODING,
  API_ROUTE,
  SSL,
  PUBLIC_DIR,
  DATA_DIR,
  PROJECT_ROOT,
  DM_TOKEN,
};
