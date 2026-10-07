/**
 * Ortak release metadata yardımcıları (SHA-512, blockmap, latest.yml).
 * Bilirkişi Hesap Windows artifact: Bilirkisi-Hesap-Setup-${version}.exe
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("child_process");
const { serializeToYaml } = require("builder-util");

const ROOT = path.join(__dirname, "..", "..");
const RELEASE_DIR = process.env.BILIRKISI_RELEASE_DIR
  ? path.resolve(process.env.BILIRKISI_RELEASE_DIR)
  : path.join(ROOT, "release");
if (/[\\/]Temp[\\/]/i.test(RELEASE_DIR)) {
  throw new Error("Release çıktısı Temp klasörüne yazılamaz. Hedef proje kökündeki release klasörüdür.");
}

/**
 * Electron-builder 26: app-builder-bin Go CLI kaldırıldı.
 * Blockmap, app-builder-lib içindeki buildBlockMap ile üretilir
 * (differentialUpdateInfoBuilder.createBlockmap ile aynı yol: gzip + .blockmap dosyası).
 * Müvekkil (EB25) hâlâ app-builder.exe blockmap CLI kullanır; Bilirkişi EB26 ile uyumlu yöntem budur.
 */
function resolveBuildBlockMap() {
  try {
    return require("app-builder-lib/out/targets/blockmap/blockmap").buildBlockMap;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `app-builder-lib blockmap modülü yüklenemedi (electron-builder 26 beklenir). Detay: ${detail}`,
    );
  }
}

function formatSpawnFailure(r, executable, args) {
  const parts = [
    `executable=${executable}`,
    `args=${JSON.stringify(args)}`,
    `status=${r.status}`,
    `signal=${r.signal ?? null}`,
  ];
  if (r.error) {
    parts.push(`spawnError.code=${r.error.code ?? ""}`);
    parts.push(`spawnError.message=${String(r.error.message || r.error).slice(0, 500)}`);
  }
  const stdout = (r.stdout || "").trim();
  const stderr = (r.stderr || "").trim();
  if (stdout) parts.push(`stdout=${stdout.slice(0, 2000)}`);
  if (stderr) parts.push(`stderr=${stderr.slice(0, 2000)}`);
  if (!r.error && !stdout && !stderr) {
    parts.push("stdout/stderr boş");
  }
  return parts.join(" | ");
}

function calculateSha512Base64(filePath) {
  const hash = crypto.createHash("sha512");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("base64");
}

function calculateSha512Base64Async(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha512");
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("base64")));
  });
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

function expectedSetupName(version) {
  return `Bilirkisi-Hesap-Setup-${version}.exe`;
}

function findSetupExe(version) {
  const expected = expectedSetupName(version);
  const direct = path.join(RELEASE_DIR, expected);
  if (fs.existsSync(direct)) {
    return direct;
  }

  const candidates = fs
    .readdirSync(RELEASE_DIR, { withFileTypes: true })
    .filter(
      (e) =>
        e.isFile() &&
        /^Bilirkisi-Hesap-Setup-.*\.exe$/i.test(e.name) &&
        !e.name.endsWith(".unsigned-backup"),
    )
    .map((e) => path.join(RELEASE_DIR, e.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`Setup EXE bulunamadı. Beklenen: ${RELEASE_DIR}\\${expected}`);
  }

  return candidates[0];
}

function verifyAuthenticode(filePath) {
  const escaped = filePath.replace(/'/g, "''");
  const cmd = [
    `$s = Get-AuthenticodeSignature -LiteralPath '${escaped}'`,
    `if ($s.Status -ne 'Valid') { Write-Error "Authenticode Status: $($s.Status)"; exit 1 }`,
    `Write-Output $s.Status`,
  ].join("; ");
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd];

  const r = spawnSync("powershell.exe", args, {
    encoding: "utf8",
    shell: false,
  });

  const status = (r.stdout || "").trim();
  if (r.status !== 0 || status !== "Valid") {
    throw new Error(`Authenticode doğrulaması başarısız: ${formatSpawnFailure(r, "powershell.exe", args)} | statusText=${status || "(boş)"}`);
  }
  return status;
}

async function createBlockmap(exePath, log = console.log) {
  const blockmapPath = `${exePath}.blockmap`;
  if (fs.existsSync(blockmapPath)) {
    fs.unlinkSync(blockmapPath);
  }

  log(`Blockmap üretiliyor: ${path.basename(blockmapPath)}`);
  log("Yöntem: app-builder-lib buildBlockMap(file, gzip, outFile) [electron-builder 26]");

  const buildBlockMap = resolveBuildBlockMap();
  try {
    await buildBlockMap(exePath, "gzip", blockmapPath);
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
    throw new Error(
      `Blockmap üretimi başarısız: method=app-builder-lib/buildBlockMap compression=gzip input=${exePath} output=${blockmapPath} | ${detail}`,
    );
  }

  if (!fs.existsSync(blockmapPath)) {
    throw new Error(`Blockmap dosyası oluşmadı: ${blockmapPath}`);
  }

  const size = fs.statSync(blockmapPath).size;
  if (size <= 0) {
    throw new Error(`Blockmap dosyası boş: ${blockmapPath}`);
  }
  log(`Blockmap hazır (${size} byte)`);
  return blockmapPath;
}

function writeLatestYml(fileName, version, sha512, size, outputDir = RELEASE_DIR) {
  const latestPath = path.join(outputDir, "latest.yml");
  const info = {
    version,
    files: [{ url: fileName, sha512, size }],
    path: fileName,
    sha512,
    releaseDate: new Date().toISOString(),
  };
  fs.writeFileSync(latestPath, serializeToYaml(info, false, true));
  return latestPath;
}

function parseLatestYml(content) {
  const version = content.match(/^version:\s*(.+)$/m)?.[1]?.trim();
  const pathVal = content.match(/^path:\s*(.+)$/m)?.[1]?.trim();
  const topSha512 = content.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
  const fileUrl = content.match(/^\s+-\s*url:\s*(.+)$/m)?.[1]?.trim();
  const fileSha512 = content.match(/^\s+sha512:\s*(.+)$/m)?.[1]?.trim();
  const fileSize = Number(content.match(/^\s+size:\s*(\d+)$/m)?.[1]);
  const releaseDate = content.match(/^releaseDate:\s*'?([^'\n]+)'?$/m)?.[1]?.trim();
  return { version, path: pathVal, sha512: topSha512, fileUrl, fileSha512, fileSize, releaseDate };
}

function verifyLatestYmlAgainstExe(setupPath, latestPath) {
  const exeSha512 = calculateSha512Base64(setupPath);
  const exeSize = fs.statSync(setupPath).size;
  const blockmapPath = `${setupPath}.blockmap`;
  const yml = parseLatestYml(fs.readFileSync(latestPath, "utf8"));

  const errors = [];
  if (exeSha512 !== yml.sha512) {
    errors.push(`EXE sha512 !== latest.yml sha512\n  EXE: ${exeSha512}\n  yml: ${yml.sha512}`);
  }
  if (exeSha512 !== yml.fileSha512) {
    errors.push(`EXE sha512 !== latest.yml files[0].sha512\n  EXE: ${exeSha512}\n  yml: ${yml.fileSha512}`);
  }
  if (exeSize !== yml.fileSize) {
    errors.push(`EXE size !== latest.yml files[0].size\n  EXE: ${exeSize}\n  yml: ${yml.fileSize}`);
  }
  if (!fs.existsSync(blockmapPath)) {
    errors.push(`Blockmap dosyası eksik: ${blockmapPath}`);
  }
  if (yml.path !== path.basename(setupPath) || yml.fileUrl !== path.basename(setupPath)) {
    errors.push(`latest.yml path/url Setup EXE adıyla uyuşmuyor`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  return { exeSha512, exeSize, blockmapPath, yml };
}

async function refreshSignedReleaseMetadata({ setupPath, version, log = (msg) => console.log(msg) }) {
  const fileName = path.basename(setupPath);
  const latestPath = path.join(RELEASE_DIR, "latest.yml");
  const blockmapPath = `${setupPath}.blockmap`;

  if (fs.existsSync(blockmapPath)) {
    fs.unlinkSync(blockmapPath);
  }
  if (fs.existsSync(latestPath)) {
    fs.unlinkSync(latestPath);
  }

  await createBlockmap(setupPath, log);

  const sha512 = await calculateSha512Base64Async(setupPath);
  const size = fs.statSync(setupPath).size;
  const writtenLatest = writeLatestYml(fileName, version, sha512, size);
  const verified = verifyLatestYmlAgainstExe(setupPath, writtenLatest);

  return {
    sha512: verified.exeSha512,
    size: verified.exeSize,
    blockmapPath: verified.blockmapPath,
    latestPath: writtenLatest,
    yml: verified.yml,
  };
}

module.exports = {
  ROOT,
  RELEASE_DIR,
  calculateSha512Base64,
  calculateSha512Base64Async,
  readPackageJson,
  expectedSetupName,
  findSetupExe,
  verifyAuthenticode,
  createBlockmap,
  writeLatestYml,
  parseLatestYml,
  verifyLatestYmlAgainstExe,
  refreshSignedReleaseMetadata,
  formatSpawnFailure,
};
