import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname: string = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT: string = join(__dirname, "..", "..");

const isDev: boolean = process.env.NODE_ENV !== "production";

const PORT: number =
  parseInt(process.env.PORT ?? "", 10) || (isDev ? 3000 : 443);
const LOCAL_ADDRESS: string =
  process.env.LOCAL_ADDRESS || (isDev ? "127.0.0.1" : "0.0.0.0");

const PUBLIC_DIR: string = join(PROJECT_ROOT, "public");
const DATA_DIR: string = join(PROJECT_ROOT, "data");

const ENCODING: BufferEncoding = "utf8";
const API_ROUTE: string = "/api/v1";

const DM_TOKEN: string | undefined = process.env.NAGARA_DM_TOKEN;

const MIME_TYPES: Record<string, string> = {
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

interface SSLOptions {
  key: Buffer;
  cert: Buffer;
}

const SSL: SSLOptions | null = isDev
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
export type { SSLOptions };
