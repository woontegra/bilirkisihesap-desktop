/**
 * Updater / release / güvenlik selftest — gerçek signing/R2/installer üretmez.
 */
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  calculateSha512Base64,
  expectedSetupName,
  parseLatestYml,
  writeLatestYml,
  verifyLatestYmlAgainstExe,
  RELEASE_DIR,
  ROOT,
  readPackageJson,
} = require("./lib/release-metadata.cjs");

const WIN_FEED = "https://updates.woontegra.com/updates/bilirkisi-hesap/windows";
const MAC_FEED = "https://updates.woontegra.com/updates/bilirkisi-hesap/macos";

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`  ✔ ${name}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function main() {
  console.log("[test:updater] başlıyor…");

  const pkg = readPackageJson();
  assert.equal(pkg.version, "3.6.0");
  ok("package.json version = 3.6.0");

  assert.equal(pkg.build?.appId, "com.woontegra.bilirkisihesap");
  ok("appId = com.woontegra.bilirkisihesap");

  assert.equal(pkg.build?.artifactName, "Bilirkisi-Hesap-Setup-${version}.${ext}");
  ok("artifactName = Bilirkisi-Hesap-Setup-${version}.${ext}");

  assert.equal(pkg.config?.updateBaseUrl, WIN_FEED);
  ok("config.updateBaseUrl = Windows feed");

  assert.equal(pkg.build?.publish?.[0]?.url, WIN_FEED);
  ok("build.publish[0].url = Windows feed");

  assert.equal(pkg.build?.win?.signExecutable, false);
  assert.notEqual(pkg.build?.win?.signAndEditExecutable, false);
  ok("electron-builder Windows signing kapalı (signExecutable:false; resource/icon editing açık)");
  assert.ok(String(pkg.build?.win?.icon || "").endsWith(".ico") || String(pkg.build?.win?.icon || "").endsWith("icon.ico"));
  ok("win.icon ICO kullanıyor");

  assert.equal(pkg.build?.nsis?.deleteAppDataOnUninstall, false);
  ok("NSIS deleteAppDataOnUninstall = false");

  assert.equal(expectedSetupName("3.6.0"), "Bilirkisi-Hesap-Setup-3.6.0.exe");
  ok("expectedSetupName(3.6.0)");

  assert.ok(pkg.dependencies?.["electron-updater"]);
  assert.ok(pkg.dependencies?.["electron-log"]);
  ok("electron-updater + electron-log dependency");

  const releaseScript = read("scripts/run-release-update.cjs");
  assert.ok(!/bumpPatchVersion|npm version patch/.test(releaseScript));
  assert.ok(/artırılmayacak|SÜRÜM ARTIRMAZ|bump yok/i.test(releaseScript));
  ok("release:update sürüm artırmaz");

  const feeds = read("shared/updateFeeds.ts");
  assert.ok(feeds.includes(WIN_FEED));
  assert.ok(feeds.includes(MAC_FEED));
  assert.ok(feeds.includes("resolveUpdateFeedUrl"));
  ok("platform feed sabitleri (windows + reserved macos)");

  const service = read("electron/update/updateService.ts");
  assert.ok(service.includes("autoDownload = false"));
  assert.ok(service.includes("autoInstallOnAppQuit = false"));
  assert.ok(service.includes("scheduleAutoUpdateCheck"));
  assert.ok(service.includes('if (!app.isPackaged)'));
  assert.ok(service.includes('process.platform !== "win32"'));
  assert.ok(service.includes("createPreUpdateBackup"));
  assert.ok(service.includes("quitAndInstall(false, true)"));
  assert.ok(service.includes("setFeedURL"));
  assert.ok(service.includes('resolveUpdateFeedUrl("win32")'));
  assert.ok(!service.includes("MACOS_UPDATE_FEED_URL"));
  assert.ok(!/setFeedURL[\s\S]*macos/i.test(service));
  ok("updateService: packaged-only, win32 feed, backup-before-install");

  // Backup failure must block quitAndInstall: backup fail path precedes quitAndInstall
  const installIdx = service.indexOf("export async function installUpdate");
  const installBody = service.slice(installIdx, installIdx + 2500);
  const backupFailIdx = installBody.indexOf("!backup.ok");
  const quitIdx = installBody.indexOf("quitAndInstall");
  assert.ok(backupFailIdx > 0 && quitIdx > backupFailIdx);
  assert.ok(installBody.includes("return {\n      ok: false") || installBody.includes("return {\r\n      ok: false") || installBody.includes("ok: false"));
  ok("backup başarısızsa quitAndInstall çağrılmaz (sıra doğrulandı)");

  const backup = read("electron/update/preUpdateBackup.ts");
  assert.ok(backup.includes("wal_checkpoint"));
  assert.ok(backup.includes("update-backups"));
  assert.ok(backup.includes("license.bin"));
  assert.ok(backup.includes("bilirkisi.sqlite") || backup.includes("getDatabasePath"));
  ok("pre-update backup: WAL checkpoint + sqlite + license");

  const mainTs = read("electron/main.ts");
  assert.ok(mainTs.includes("contextIsolation: true"));
  assert.ok(mainTs.includes("nodeIntegration: false"));
  assert.ok(mainTs.includes("sandbox: true"));
  assert.ok(mainTs.includes("initUpdateService"));
  assert.ok(mainTs.includes("scheduleAutoUpdateCheck(5000)"));
  ok("main güvenlik bayrakları + auto check 5s");

  const preload = read("electron/preload.ts");
  assert.ok(preload.includes("contextBridge.exposeInMainWorld"));
  assert.ok(!/\bfs\b/.test(preload) || !preload.includes('from "node:fs"'));
  assert.ok(!preload.includes("electron-updater"));
  assert.ok(!preload.includes("child_process"));
  assert.ok(preload.includes("updateGetStatus"));
  assert.ok(preload.includes("onUpdateStatusChanged"));
  ok("preload dar IPC; Node/electron-updater yok");

  const contract = read("shared/desktop-contract.ts");
  assert.ok(contract.includes("updateCheck"));
  assert.ok(contract.includes("updateStatusChanged"));
  ok("desktop-contract update kanalları");

  // Metadata consistency with fake "signed" artifact
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const tmpExe = path.join(RELEASE_DIR, "Bilirkisi-Hesap-Setup-3.6.0.exe");
  const payload = Buffer.from(`bilirkisi-fake-signed-exe-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`);
  fs.writeFileSync(tmpExe, payload);
  const sha = calculateSha512Base64(tmpExe);
  const size = payload.length;
  // Fake blockmap presence for verify
  fs.writeFileSync(`${tmpExe}.blockmap`, Buffer.from("fake-blockmap"));
  const latest = writeLatestYml(path.basename(tmpExe), "3.6.0", sha, size);
  const yml = parseLatestYml(fs.readFileSync(latest, "utf8"));
  assert.equal(yml.version, "3.6.0");
  assert.equal(yml.path, "Bilirkisi-Hesap-Setup-3.6.0.exe");
  assert.equal(yml.sha512, sha);
  assert.equal(yml.fileSha512, sha);
  assert.equal(yml.fileSize, size);
  verifyLatestYmlAgainstExe(tmpExe, latest);
  ok("latest.yml path/version/sha512/size tutarlılığı");

  // Cleanup temp artifacts from selftest only
  for (const f of [tmpExe, `${tmpExe}.blockmap`, latest]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  ok("selftest geçici release artifact temizliği");

  // Ensure release scripts point to bilirkisi R2 path not muvekkil
  const distWin = read("scripts/run-dist-win-update.cjs");
  assert.ok(distWin.includes("bilirkisi-hesap/windows"));
  assert.ok(!distWin.includes("muvekkil-kasa-defteri"));
  ok("dist:win:update R2 yolu bilirkisi-hesap/windows");

  console.log("");
  console.log(`[test:updater] ${passed} kontrol geçti.`);
}

try {
  main();
} catch (e) {
  console.error("[test:updater] BAŞARISIZ:", e.message || e);
  process.exit(1);
}
