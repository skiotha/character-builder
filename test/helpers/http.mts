import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

import type { TempDir } from "./temp-dir.mts";

interface TestServer {
  baseUrl: string;
  tempDir: TempDir;
  close: () => Promise<void>;
}

/**
 * Starts a real HTTP server backed by the app handler.
 *
 * IMPORTANT: `mock.module("#config")` MUST be called BEFORE importing this
 * module's `startTestServer`, because `src/app.mts` and its transitive
 * imports resolve `#config` at the top level. The mock must already be in
 * place when the dynamic `import("../src/app.mts")` runs inside this
 * function.
 */
async function startTestServer(tempDir: TempDir): Promise<TestServer> {
  // Seed reference catalog so /api/v1/traits and friends don't 500.
  // abilities + spells are merged into /traits; boons + sins into /talents;
  // rituals/weapons/armor are single-source.
  const seedTopics: Array<[string, unknown]> = [
    ["abilities", [{ id: "test-ability", name: "Test Ability" }]],
    ["spells", [{ id: "test-spell", name: "Test Spell" }]],
    ["boons", [{ id: "test-boon", name: "Test Boon" }]],
    ["sins", [{ id: "test-sin", name: "Test Sin" }]],
    ["rituals", [{ id: "test-ritual", name: "Test Ritual" }]],
    ["weapons", [{ id: "test-weapon", name: "Test Weapon" }]],
    ["armor", [{ id: "test-armor", name: "Test Armor" }]],
  ];
  for (const [topic, payload] of seedTopics) {
    for (const locale of ["en", "ru"]) {
      await fs.writeFile(
        path.join(tempDir.referenceDir, `${topic}.${locale}.json`),
        JSON.stringify(payload),
      );
    }
  }

  const { default: app } = await import("../../src/app.mts");

  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    tempDir,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

export { startTestServer };
export type { TestServer };
