import { fork } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log(`[${new Date().toISOString()}] Starting application watcher...`);

function startApp() {
  const child = fork(join(__dirname, "server.mjs"));

  child.on("exit", (code, signal) => {
    console.error(
      `[${new Date().toISOString()}] App crashed! Code: ${code}, Signal: ${signal}`,
    );
    console.log(`[${new Date().toISOString()}] Restarting in 2 seconds...`);

    setTimeout(startApp, 2000);
  });
}

startApp();
