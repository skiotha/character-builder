/**
 * Hard-delete script.
 *
 * Wraps the domain-layer `storage.hardDeleteCharacter` (which removes the
 * JSON file, the portrait directory, and all index entries) so manual
 * cleanup stays consistent with what the API would do. Also offers a
 * `--orphan-portraits` mode that scans `data/uploads/portraits/` and
 * deletes any directory whose id is not in `data/index.json` — useful
 * when characters were removed by hand and left dangling portraits.
 *
 * Usage:
 *   node --experimental-strip-types scripts/hard-delete.mts <id> [<id>...]
 *   node --experimental-strip-types scripts/hard-delete.mts --orphan-portraits
 *   node --experimental-strip-types scripts/hard-delete.mts --all          # wipe every character
 *   node --experimental-strip-types scripts/hard-delete.mts --dry-run ...  # print, don't write
 *
 * ADR-013 carve-out: this script is a sibling to `src/lib/backup.mts`
 * (also a storage-direct utility) — both legitimately bypass `#models`
 * because they are operational tooling, not request handlers.
 */

import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  getAllCharacters,
  hardDeleteCharacter,
} from "../src/models/storage.mts";
import { DATA_DIR } from "../src/lib/config.mts";

const PORTRAITS_DIR = join(DATA_DIR, "uploads", "portraits");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const purgeOrphans = args.includes("--orphan-portraits");
const wipeAll = args.includes("--all");
const ids = args.filter((a) => !a.startsWith("--"));

function log(...parts: unknown[]): void {
  console.log(`[hard-delete${dryRun ? " dry-run" : ""}]`, ...parts);
}

async function deleteIds(targets: string[]): Promise<void> {
  for (const id of targets) {
    if (dryRun) {
      log(`would hard-delete character ${id}`);
      continue;
    }
    try {
      const ok = await hardDeleteCharacter(id);
      log(ok ? `deleted ${id}` : `failed ${id}`);
    } catch (err) {
      log(`error ${id}:`, (err as Error).message);
    }
  }
}

async function purgeOrphanPortraits(): Promise<void> {
  // Live characters per the index after any deletions above. We re-read
  // (rather than caching) so a `<ids> + --orphan-portraits` invocation
  // sees the post-delete state.
  const live = new Set(
    (await getAllCharacters()).map((c) => c["id"] as string),
  );

  let entries: string[];
  try {
    entries = await readdir(PORTRAITS_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      log("no portraits directory; nothing to purge");
      return;
    }
    throw err;
  }

  for (const name of entries) {
    if (live.has(name)) continue;
    const dir = join(PORTRAITS_DIR, name);
    if (dryRun) {
      log(`would remove orphan portrait dir ${dir}`);
      continue;
    }
    await rm(dir, { recursive: true, force: true });
    log(`removed orphan portrait dir ${dir}`);
  }
}

async function main(): Promise<void> {
  if (!purgeOrphans && !wipeAll && ids.length === 0) {
    console.error(
      "Usage: hard-delete.mts <id>... | --all | --orphan-portraits [--dry-run]",
    );
    process.exitCode = 1;
    return;
  }

  if (wipeAll) {
    const all = await getAllCharacters();
    log(`wiping ${all.length} characters via storage.hardDeleteCharacter`);
    await deleteIds(all.map((c) => c["id"] as string));
  } else if (ids.length > 0) {
    await deleteIds(ids);
  }

  if (purgeOrphans) await purgeOrphanPortraits();
}

await main();
