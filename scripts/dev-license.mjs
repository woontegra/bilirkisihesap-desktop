import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.LICENSE_USE_MOCK = "0";
process.env.NODE_ENV = process.env.NODE_ENV || "development";

const child = spawn("node", ["scripts/run-dev.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
