import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

interface TempDir {
  dir: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a unique temp directory pre-populated with the subdirectory
 * structure that storage.mts and uploads.mts create at import time:
 *   <dir>/characters/
 *   <dir>/uploads/portraits/
 *
 * Returns the directory path and a cleanup function.
 */
async function createTempDir(): Promise<TempDir> {
  const id = crypto.randomBytes(6).toString("hex");
  const dir = path.join(os.tmpdir(), `nagara-test-${id}`);

  await fs.mkdir(path.join(dir, "characters"), { recursive: true });
  await fs.mkdir(path.join(dir, "uploads", "portraits"), { recursive: true });

  return {
    dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

export { createTempDir };
export type { TempDir };
