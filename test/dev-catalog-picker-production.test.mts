import { after, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createTempDir } from "./helpers/temp-dir.mts";

import type { TempDir } from "./helpers/temp-dir.mts";
import type { TestServer } from "./helpers/http.mts";

const __testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__testDir, "..");
const tempDir: TempDir = await createTempDir();

mock.module("#config", {
  namedExports: {
    IS_DEV: false,
    DATA_DIR: tempDir.dir,
    REFERENCE_DIR: tempDir.referenceDir,
    LOCALES: ["en", "ru"] as const,
    DEFAULT_LOCALE: "en" as const,
    ENCODING: "utf8" as BufferEncoding,
    DM_TOKEN: undefined,
    MIME_TYPES: {
      default: "application/octet-stream",
      html: "text/html; charset=UTF-8",
      js: "text/javascript",
      mjs: "text/javascript",
      css: "text/css",
      json: "application/json",
    } as Record<string, string>,
    PUBLIC_DIR: join(projectRoot, "public"),
    API_ROUTE: "/api/v1",
    LOCAL_ADDRESS: "127.0.0.1",
    PROJECT_ROOT: projectRoot,
    CORS_ORIGINS: ["https://nagara.team"] as readonly string[],
  },
});

const { startTestServer } = await import("./helpers/http.mts");
const server: TestServer = await startTestServer(tempDir);

after(async () => {
  await server.close();
  await tempDir.cleanup();
});

describe("production dev catalog-picker access", () => {
  for (const pathname of [
    "/__dev/catalog-picker/",
    "/__dev/catalog-picker",
    "/__dev/catalog-picker/index.html",
    "/__dev/catalog-picker/gallery.mjs",
    "/__dev/catalog-picker/frame.css",
    "/__dev/catalog-picker/fixtures.mjs",
    "/__dev/catalog-picker%2Ffixtures.mjs",
  ]) {
    it(`returns 404 for ${pathname}`, async () => {
      const response = await fetch(`${server.baseUrl}${pathname}`);
      assert.equal(response.status, 404);
      assert.equal(await response.text(), "Not found");
    });
  }
});
