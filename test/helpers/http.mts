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
  // rituals/weapons/armor/qualities are single-source.
  // qualities: the engine throws on unknown weapon/armor qualities
  // (ADR-016), so we seed the full id set used by the default fixture
  // weapons (most importantly the `own` quality the own slot requires).
  const qualityIds = [
    "area",
    "balanced",
    "blessed",
    "blunt",
    "catastrophic",
    "composite",
    "concealed",
    "cumbersome",
    "deep_wounds",
    "entangling",
    "flaming",
    "flexible",
    "fortified",
    "hampering",
    "long",
    "massive",
    "own",
    "precise",
    "ranged",
    "returning",
    "short",
    "special",
    "unwieldy",
    "vengeful",
    "versatile",
  ];
  const qualitySeed = qualityIds.map((id) => ({ id, effects: [] }));
  // Seed entries are structurally complete: the strict catalog-membership
  // pass (`#models/reference-validation`) validates character entries by
  // id against these files, and the creation default seeds
  // `natural_weapon` — it MUST resolve here or every POST in tests 400s.
  const seedTopics: Array<[string, unknown]> = [
    ["abilities", [{ id: "test-ability", name: "Test Ability" }]],
    ["spells", [{ id: "test-spell", name: "Test Spell" }]],
    ["boons", [{ id: "test-boon", name: "Test Boon", levels: 3 }]],
    ["sins", [{ id: "test-sin", name: "Test Sin", levels: 1 }]],
    ["rituals", [{ id: "test-ritual", name: "Test Ritual" }]],
    [
      "weapons",
      [
        {
          id: "natural_weapon",
          name: "Natural Weapon",
          type: "natural",
          damage: 4,
          cost: 0,
          qualities: ["own", "short"],
          effects: [],
        },
        {
          id: "test-weapon",
          name: "Test Weapon",
          type: "melee",
          damage: 6,
          cost: 10,
          qualities: ["balanced"],
          effects: [],
        },
      ],
    ],
    [
      "armor",
      [
        {
          id: "test-armor",
          name: "Test Armor",
          slot: "body",
          armor: 4,
          cost: 25,
          qualities: ["hampering"],
          effects: [],
        },
        {
          id: "test-plug",
          name: "Test Plug",
          slot: "plug",
          armor: 2,
          cost: 15,
          qualities: [],
          effects: [],
        },
      ],
    ],
    ["qualities", qualitySeed],
    [
      "statuses",
      [
        { id: "bleeding", name: "Bleeding" },
        { id: "stunned", name: "Stunned" },
      ],
    ],
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
