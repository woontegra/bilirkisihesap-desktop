import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendEnv = path.resolve(desktopRoot, "..", "aktuerya-backend", ".env");
const desktopEnv = path.join(desktopRoot, ".env");

const WANTED = [
  "TCMB_EVDS_API_KEY",
  "TCMB_EVDS_HIGHEST_DEPOSIT_TRY_SERIES_CODE",
  "TCMB_EVDS_HIGHEST_DEPOSIT_TRY_RESPONSE_FIELD",
];

function parseEnv(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

if (!existsSync(backendEnv)) {
  console.log(JSON.stringify({ copied: false, backendEnvFound: false, keyPresent: false }));
  process.exit(1);
}

const source = parseEnv(readFileSync(backendEnv, "utf8"));
const existing = existsSync(desktopEnv) ? parseEnv(readFileSync(desktopEnv, "utf8")) : {};
const next = { ...existing };
for (const key of WANTED) {
  if (source[key]) next[key] = source[key];
}

const lines = Object.entries(next).map(([key, value]) => `${key}=${value}`);
writeFileSync(desktopEnv, `${lines.join("\n")}\n`);

const key = next.TCMB_EVDS_API_KEY ?? "";
console.log(
  JSON.stringify({
    copied: true,
    backendEnvFound: true,
    desktopEnvWritten: true,
    keyPresent: key.length > 0,
    keyLength: key.length,
    seriesPresent: Boolean(next.TCMB_EVDS_HIGHEST_DEPOSIT_TRY_SERIES_CODE),
  }),
);
