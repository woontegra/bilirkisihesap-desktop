import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
import { type OfflineLoginRecord } from "./offlineLogin";

function storePath(): string {
  return path.join(app.getPath("userData"), "license", "desktop-auth.bin");
}

export function readOfflineLogin(): OfflineLoginRecord | null {
  const file = storePath();
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file);
    const json = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString("utf8");
    const parsed = JSON.parse(json) as OfflineLoginRecord;
    if (parsed.v !== 1 || !parsed.username || !parsed.salt || !parsed.hash || !parsed.deviceHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOfflineLogin(record: OfflineLoginRecord): void {
  const file = storePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(record);
  const bytes = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(payload) : Buffer.from(payload, "utf8");
  writeFileSync(file, bytes);
}
