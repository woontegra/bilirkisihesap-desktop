import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    LICENSE_USE_MOCK: "0",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
