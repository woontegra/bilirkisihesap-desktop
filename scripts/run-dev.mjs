import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.ELECTRON_SKIP = "1";

async function bundleMain() {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(root, "electron/main.ts")],
    outfile: path.join(root, "dist-electron/main.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    external: ["electron", "better-sqlite3"],
    sourcemap: true,
    alias: {
      "@shared": path.join(root, "shared"),
    },
    logOverride: { "empty-import-meta": "silent" },
  });
}

await bundleMain();

const vite = spawn("npx", ["vite", "--port", "5173"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

function waitForVite() {
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const req = http.get("http://localhost:5173", (res) => {
        clearInterval(timer);
        res.resume();
        resolve(undefined);
      });
      req.on("error", () => undefined);
    }, 250);
  });
}

await waitForVite();

const electronCli = path.join(root, "node_modules", "electron", "cli.js");
let electron = null;
let restartingElectron = false;

function startElectron() {
  electron = spawn(process.execPath, [electronCli, path.join(root, "dist-electron", "main.js")], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
    },
  });
  electron.on("exit", (code) => {
    if (restartingElectron) {
      restartingElectron = false;
      return;
    }
    vite.kill();
    process.exit(code ?? 0);
  });
}

startElectron();

function shutdown() {
  vite.kill();
  electron?.kill();
}

vite.on("exit", (code) => {
  electron?.kill();
  process.exit(code ?? 0);
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
