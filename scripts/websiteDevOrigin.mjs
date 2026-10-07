import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function websiteViteConfigPath() {
  return path.resolve(desktopRoot, "../../woontegra_website/FrontendV4/vite.config.ts");
}

/** Dev server origin from the website Vite config. Does not invent a port. */
export function readWebsiteDevOrigin(configPath = websiteViteConfigPath()) {
  if (!existsSync(configPath)) return null;
  const text = readFileSync(configPath, "utf8");
  const match = text.match(/server:\s*\{[^]*?port:\s*(\d+)/);
  if (!match) return null;
  const port = Number(match[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return `http://localhost:${port}`;
}
