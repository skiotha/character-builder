// ── Dev application watcher ──────────────────────────────────────
//
// `npm run start:dev` entry point. Forks `src/server.mts`, restarts it
// on changes under `src/` / `public/` / `reference/`, and exits cleanly
// when the spawning terminal disappears so orphaned trees
// cannot hold port 3000 forever.
//
// Restart policy:
//   - file change → debounced kill + re-fork (does not count as crash)
//   - child exit 0 → stop (clean shutdown)
//   - child non-zero → restart after delay, up to MAX_CONSECUTIVE_CRASHES
//   - orphaned parent chain / SIGINT / SIGTERM → kill child and exit

import { execFileSync, fork, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname: string = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT: string = join(__dirname, "..");
const SERVER_PATH: string = join(PROJECT_ROOT, "src", "server.mts");

const WATCH_DIRS: readonly string[] = ["src", "public", "reference"];
const DEBOUNCE_MS = 300 as const;
const CRASH_RESTART_MS = 2_000 as const;
const ORPHAN_POLL_MS = 2_000 as const;
const MAX_CONSECUTIVE_CRASHES = 5 as const;
const CHILD_KILL_GRACE_MS = 3_000 as const;
/** After the child stays up this long, the crash streak resets. */
const CRASH_STREAK_RESET_MS = 10_000 as const;
/** Drop watch events during startup / right after a restart (Windows noise). */
const WATCH_SETTLE_MS = 1_500 as const;

let child: ChildProcess | null = null;
let consecutiveCrashes = 0;
let intentionalStop = false;
let shuttingDown = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let crashRestartTimer: ReturnType<typeof setTimeout> | null = null;
let orphanPollTimer: ReturnType<typeof setInterval> | null = null;
/** Ignore watch events until this timestamp (startup / post-restart settle). */
let ignoreWatchUntilMs = 0;
const watchers: FSWatcher[] = [];
let ancestorPids: number[] = [];

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logError(message: string): void {
  console.error(`[${new Date().toISOString()}] ${message}`);
}

/** True when `pid` still refers to a live process. */
function processExists(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Parent PID of `pid`, or `null` if it cannot be resolved. */
function getParentPid(pid: number): number | null {
  if (process.platform === "win32") {
    try {
      const out: string = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').ParentProcessId`,
        ],
        { encoding: "utf8", windowsHide: true, timeout: 5_000 },
      ).trim();
      const ppid: number = Number.parseInt(out, 10);
      return Number.isFinite(ppid) ? ppid : null;
    } catch {
      return null;
    }
  }

  try {
    const stat: string = readFileSync(`/proc/${pid}/stat`, "utf8");
    const closeParen: number = stat.lastIndexOf(")");
    if (closeParen < 0) return null;
    // After ")": state ppid ...
    const rest: string[] = stat.slice(closeParen + 2).split(" ");
    const ppid: number = Number.parseInt(rest[1] ?? "", 10);
    return Number.isFinite(ppid) ? ppid : null;
  } catch {
    return null;
  }
}

/**
 * Snapshot ancestor PIDs at startup. Later polls only check that these
 * PIDs still exist — when the shell dies, an ancestor vanishes
 * while npm/cmd/watcher keep parenting each other.
 */
function collectAncestorPids(): number[] {
  const ancestors: number[] = [];
  const seen: Set<number> = new Set();
  let current: number = process.ppid;

  while (current > 0 && !seen.has(current)) {
    seen.add(current);
    if (!processExists(current)) break;
    ancestors.push(current);

    const parent: number | null = getParentPid(current);
    if (parent === null || parent === current) break;
    // Windows: stop before System/Idle (0–4).
    if (process.platform === "win32" && parent <= 4) break;
    current = parent;
  }

  return ancestors;
}

function isOrphaned(): boolean {
  return ancestorPids.some((pid) => !processExists(pid));
}

function clearCrashRestartTimer(): void {
  if (crashRestartTimer !== null) {
    clearTimeout(crashRestartTimer);
    crashRestartTimer = null;
  }
}

function clearDebounceTimer(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function stopOrphanPoll(): void {
  if (orphanPollTimer !== null) {
    clearInterval(orphanPollTimer);
    orphanPollTimer = null;
  }
}

function closeWatchers(): void {
  for (const watcher of watchers) {
    watcher.close();
  }
  watchers.length = 0;
}

function stopChild(): Promise<void> {
  return new Promise((resolve) => {
    const current: ChildProcess | null = child;
    if (!current || current.exitCode !== null || current.signalCode !== null) {
      child = null;
      resolve();
      return;
    }

    intentionalStop = true;
    let settled = false;

    const finish = (): void => {
      if (settled) return;
      settled = true;
      child = null;
      resolve();
    };

    current.once("exit", finish);
    current.kill("SIGTERM");

    setTimeout(() => {
      if (!settled) {
        try {
          current.kill("SIGKILL");
        } catch {
          // already gone
        }
        finish();
      }
    }, CHILD_KILL_GRACE_MS);
  });
}

function startApp(): void {
  if (shuttingDown) return;

  clearCrashRestartTimer();

  const next: ChildProcess = fork(SERVER_PATH, [], {
    execArgv: ["--experimental-strip-types"],
  });
  child = next;
  intentionalStop = false;

  setTimeout(() => {
    if (child === next && !shuttingDown) consecutiveCrashes = 0;
  }, CRASH_STREAK_RESET_MS);

  next.on("exit", (code, signal) => {
    if (child === next) child = null;

    if (shuttingDown || intentionalStop) {
      intentionalStop = false;
      return;
    }

    if (code === 0) {
      log("App stopped.");
      return;
    }

    consecutiveCrashes += 1;
    logError(
      `App crashed! Code: ${code}, Signal: ${signal} (${consecutiveCrashes}/${MAX_CONSECUTIVE_CRASHES})`,
    );

    if (consecutiveCrashes >= MAX_CONSECUTIVE_CRASHES) {
      logError(
        `Giving up after ${MAX_CONSECUTIVE_CRASHES} consecutive crashes.`,
      );
      void shutdown(1);
      return;
    }

    log(`Restarting in ${CRASH_RESTART_MS / 1000} seconds...`);
    crashRestartTimer = setTimeout(() => {
      crashRestartTimer = null;
      startApp();
    }, CRASH_RESTART_MS);
  });
}

async function restartFromFileChange(reason: string): Promise<void> {
  if (shuttingDown) return;

  consecutiveCrashes = 0;
  clearCrashRestartTimer();
  ignoreWatchUntilMs = Date.now() + WATCH_SETTLE_MS;
  log(`Change detected (${reason}); restarting...`);
  await stopChild();
  if (!shuttingDown) startApp();
}

function scheduleFileRestart(filename: string | null): void {
  if (shuttingDown) return;
  if (Date.now() < ignoreWatchUntilMs) return;
  clearDebounceTimer();
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (Date.now() < ignoreWatchUntilMs || shuttingDown) return;
    void restartFromFileChange(filename ?? "unknown");
  }, DEBOUNCE_MS);
}

function startFileWatchers(): void {
  for (const dir of WATCH_DIRS) {
    const abs: string = join(PROJECT_ROOT, dir);
    if (!existsSync(abs)) {
      log(`Watch path missing, skipping: ${dir}/`);
      continue;
    }

    try {
      const watcher: FSWatcher = watch(
        abs,
        { recursive: true },
        (_eventType, filename) => {
          scheduleFileRestart(
            filename !== null ? `${dir}/${filename}` : `${dir}/`,
          );
        },
      );
      watcher.on("error", (err: Error) => {
        logError(`Watch error on ${dir}/: ${err.message}`);
      });
      watchers.push(watcher);
      log(`Watching ${dir}/`);
    } catch (err) {
      const message: string = err instanceof Error ? err.message : String(err);
      logError(`Failed to watch ${dir}/: ${message}`);
    }
  }
}

function startOrphanPoll(): void {
  orphanPollTimer = setInterval(() => {
    if (shuttingDown) return;
    if (!isOrphaned()) return;
    logError(
      "Parent process tree disappeared (orphaned); shutting down to avoid ghost servers.",
    );
    void shutdown(0);
  }, ORPHAN_POLL_MS);
}

async function shutdown(exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  clearDebounceTimer();
  clearCrashRestartTimer();
  stopOrphanPoll();
  closeWatchers();

  log("Shutting down...");
  await stopChild();
  process.exit(exitCode);
}

log("Starting application watcher...");
ancestorPids = collectAncestorPids();
if (ancestorPids.length === 0) {
  log("No live ancestors recorded; orphan guard will be inactive.");
} else {
  log(`Orphan guard tracking ${ancestorPids.length} ancestor PID(s).`);
}

startFileWatchers();
ignoreWatchUntilMs = Date.now() + WATCH_SETTLE_MS;
startOrphanPoll();
startApp();

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});
