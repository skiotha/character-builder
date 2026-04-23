// ADR-013 carve-out: this helper provides isolated DATA_DIR sandboxes for
// tests. Tests using it may bypass the domain layer (`#models`) and operate
// directly against `#models/storage` for fixture setup.

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

interface TempDir {
  dir: string;
  referenceDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a unique temp directory pre-populated with the subdirectory
 * structure that storage.mts and uploads.mts create at import time:
 *   <dir>/characters/
 *   <dir>/uploads/portraits/
 *   <dir>/reference/   (sibling REFERENCE_DIR sandbox)
 *
 * Returns the directory path and a cleanup function.
 */
async function createTempDir(): Promise<TempDir> {
  const id = crypto.randomBytes(6).toString("hex");
  const dir = path.join(os.tmpdir(), `nagara-test-${id}`);
  const referenceDir = path.join(dir, "reference");

  await fs.mkdir(path.join(dir, "characters"), { recursive: true });
  await fs.mkdir(path.join(dir, "uploads", "portraits"), { recursive: true });
  await fs.mkdir(referenceDir, { recursive: true });

  return {
    dir,
    referenceDir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

export { createTempDir };
export type { TempDir };
