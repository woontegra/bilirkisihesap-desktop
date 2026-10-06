import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { getDatabase, isDatabaseOpen } from "../db/database";
import { getBackupsPath, getDatabasePath, getUserDataRoot } from "../paths";

function stampForFolder(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function copySqliteBundle(srcBase: string, destBase: string): void {
  copyFileSync(srcBase, destBase);
  for (const ext of ["-wal", "-shm"]) {
    const src = srcBase + ext;
    if (existsSync(src)) copyFileSync(src, destBase + ext);
  }
}

function copyIfExists(src: string, dest: string): void {
  if (!existsSync(src)) return;
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

/**
 * Güncelleme kurulmadan önce userData yedeği.
 * WAL checkpoint + .sqlite/.wal/.shm, lisans ve backups klasörü.
 * Başarısız olursa kurulum başlatılmamalı.
 */
export function createPreUpdateBackup(
  fromVersion: string,
  toVersion: string,
): { ok: true; path: string } | { ok: false; error: string } {
  const safeFrom = fromVersion.replace(/[^\w.-]+/g, "_") || "unknown";
  const safeTo = toVersion.replace(/[^\w.-]+/g, "_") || "unknown";
  const dirName = `${safeFrom}-to-${safeTo}-${stampForFolder()}`;
  const backupRoot = path.join(getUserDataRoot(), "update-backups");
  const destDir = path.join(backupRoot, dirName);

  try {
    mkdirSync(destDir, { recursive: true });

    if (!isDatabaseOpen()) {
      return { ok: false, error: "Veritabanı bağlantısı yok; yedek alınamadı." };
    }

    const db = getDatabase();
    db.pragma("wal_checkpoint(TRUNCATE)");

    const dbPath = getDatabasePath();
    if (!existsSync(dbPath)) {
      return { ok: false, error: "Veritabanı dosyası bulunamadı; yedek alınamadı." };
    }

    const dataDest = path.join(destDir, "data");
    mkdirSync(dataDest, { recursive: true });
    copySqliteBundle(dbPath, path.join(dataDest, path.basename(dbPath)));

    const licenseSrc = path.join(getUserDataRoot(), "license", "license.bin");
    copyIfExists(licenseSrc, path.join(destDir, "license", "license.bin"));

    const backupsSrc = getBackupsPath();
    if (existsSync(backupsSrc)) {
      const backupsDest = path.join(destDir, "backups");
      mkdirSync(backupsDest, { recursive: true });
      for (const entry of readdirSync(backupsSrc, { withFileTypes: true })) {
        if (entry.isFile()) {
          copyFileSync(path.join(backupsSrc, entry.name), path.join(backupsDest, entry.name));
        }
      }
    }

    writeFileSync(
      path.join(destDir, "backup-meta.json"),
      JSON.stringify(
        {
          fromVersion,
          toVersion,
          createdAt: new Date().toISOString(),
          appVersion: app.getVersion(),
          platform: process.platform,
        },
        null,
        2,
      ),
      "utf8",
    );

    return { ok: true, path: destDir };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 300) : "Yedek alınamadı.",
    };
  }
}
