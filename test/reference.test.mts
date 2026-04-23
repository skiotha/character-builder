import { describe, it, mock, after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { createTempDir } from "./helpers/temp-dir.mts";

import type { TempDir } from "./helpers/temp-dir.mts";

let tempDir: TempDir;
tempDir = await createTempDir();

mock.module("#config", {
  namedExports: {
    DATA_DIR: tempDir.dir,
    REFERENCE_DIR: tempDir.referenceDir,
    LOCALES: ["en", "ru"] as const,
    DEFAULT_LOCALE: "en" as const,
    ENCODING: "utf8" as BufferEncoding,
  },
});

const ref = await import("#models/reference");

after(async () => {
  await tempDir.cleanup();
});

async function writeRef(name: string, payload: unknown): Promise<void> {
  await fs.writeFile(
    path.join(tempDir.referenceDir, name),
    JSON.stringify(payload),
  );
}

describe("getTopic (single-source)", () => {
  before(async () => {
    await writeRef("rituals.en.json", [{ id: "ritual-a", name: "A" }]);
    await writeRef("rituals.ru.json", [{ id: "ritual-a", name: "А" }]);
  });

  it("returns parsed entries for the requested locale", async () => {
    const en = await ref.getTopic("rituals", "en");
    assert.equal(en.length, 1);
    assert.equal(en[0]?.name, "A");

    const ru = await ref.getTopic("rituals", "ru");
    assert.equal(ru[0]?.name, "А");
  });

  it("invalidates cache when the file mtime advances", async () => {
    // Advance mtime by rewriting with new content + a future stamp.
    await writeRef("rituals.en.json", [{ id: "ritual-b", name: "B" }]);
    const future = new Date(Date.now() + 5_000);
    await fs.utimes(
      path.join(tempDir.referenceDir, "rituals.en.json"),
      future,
      future,
    );

    const reloaded = await ref.getTopic("rituals", "en");
    assert.equal(reloaded[0]?.id, "ritual-b");
  });
});

describe("getMerged (traits)", () => {
  before(async () => {
    await writeRef("abilities.en.json", [
      { id: "ab-1", name: "Ab One" },
      { id: "ab-2", name: "Ab Two" },
    ]);
    await writeRef("spells.en.json", [{ id: "sp-1", name: "Sp One" }]);
  });

  it("merges entries and stamps source", async () => {
    const merged = await ref.getMerged("traits", "en");
    assert.equal(merged.length, 3);

    const map = new Map(merged.map((e) => [e.id, e.source]));
    assert.equal(map.get("ab-1"), "ability");
    assert.equal(map.get("ab-2"), "ability");
    assert.equal(map.get("sp-1"), "spell");
  });

  it("throws on duplicate id across components, naming both files", async () => {
    await writeRef("abilities.ru.json", [{ id: "shared", name: "Aaa" }]);
    await writeRef("spells.ru.json", [{ id: "shared", name: "Sss" }]);
    // Make sure cache misses by advancing mtime on both.
    const future = new Date(Date.now() + 10_000);
    await fs.utimes(
      path.join(tempDir.referenceDir, "abilities.ru.json"),
      future,
      future,
    );
    await fs.utimes(
      path.join(tempDir.referenceDir, "spells.ru.json"),
      future,
      future,
    );

    await assert.rejects(
      () => ref.getMerged("traits", "ru"),
      /Duplicate id 'shared'.*abilities\.ru\.json.*spells\.ru\.json/,
    );
  });

  it("throws when an entry is missing an id", async () => {
    await writeRef("boons.en.json", [{ name: "Nameless" }]);
    await writeRef("sins.en.json", []);
    await assert.rejects(
      () => ref.getMerged("talents", "en"),
      /Entry without id.*boons\.en\.json/,
    );
  });
});
