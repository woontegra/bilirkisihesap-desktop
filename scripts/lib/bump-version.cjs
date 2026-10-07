/**
 * Patch sürüm artırma (major/minor yok).
 * npm version patch --no-git-tag-version:
 * - package.json ve package-lock.json günceller
 * - git commit/tag oluşturmaz
 * Masaüstü sürüm göstergeleri aynı patch değerine çekilir.
 */
const { spawnSync } = require("child_process");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, readPackageJson } = require("./release-metadata.cjs");

const VERSION_FILES = [
  "src/appVersion.ts",
  "electron/main.ts",
  "src/pages/hesaplamalar/shared/equityNet.selftest.ts",
  "scripts/run-updater-selftest.cjs",
];

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function syncDesktopVersion(before, after) {
  for (const rel of VERSION_FILES) {
    const file = path.join(ROOT, rel);
    const text = fs.readFileSync(file, "utf8");
    const next = text.split(before).join(after);
    if (next !== text) fs.writeFileSync(file, next);
  }
}

/**
 * @param {(msg: string) => void} [log]
 * @returns {{ before: string, after: string }}
 */
function bumpPatchVersion(log = console.log) {
  const before = String(readPackageJson().version || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(before)) {
    die(`Geçersiz package.json version: ${before}`);
  }

  log(`Mevcut sürüm: ${before}`);
  log("Patch sürüm artırılıyor (npm version patch --no-git-tag-version)…");

  const r = spawnSync("npm.cmd", ["version", "patch", "--no-git-tag-version"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (r.status !== 0) {
    die(`Sürüm artırılamadı (exit ${r.status ?? 1}).`, r.status ?? 1);
  }

  const after = String(readPackageJson().version || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(after) || after === before) {
    die(`Sürüm artışı doğrulanamadı (önce: ${before}, sonra: ${after}).`);
  }

  syncDesktopVersion(before, after);
  log(`Sürüm artırıldı: ${before} → ${after}`);
  log("package.json, package-lock.json ve masaüstü sürüm göstergeleri güncellendi. Git commit/tag yok.");

  return { before, after };
}

module.exports = { bumpPatchVersion };
