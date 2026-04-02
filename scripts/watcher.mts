import { fork, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname: string = dirname(fileURLToPath(import.meta.url));

console.log(`[${new Date().toISOString()}] Starting application watcher...`);

function startApp(): void {
  const child: ChildProcess = fork(
    join(__dirname, "..", "src", "server.mts"),
    [],
    {
      execArgv: ["--experimental-strip-types"],
    },
  );

  child.on("exit", (code, signal) => {
    console.error(
      `[${new Date().toISOString()}] App crashed! Code: ${code}, Signal: ${signal}`,
    );
    console.log(`[${new Date().toISOString()}] Restarting in 2 seconds...`);

    setTimeout(startApp, 2000);
  });
}

startApp();
