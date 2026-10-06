import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
export type StoredLicenseRecord = {
  kind?: "paid" | "trial";
  licenseKey: string;
  deviceHash: string;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  offlineGraceUntil: string | null;
  lastSeenAt: string | null;
  maxDevices: number | null;
  status: "ACTIVE" | "LOCKED" | "NONE";
};

function storePath(): string {
  return path.join(app.getPath("userData"), "license", "license.bin");
}

export function readStoredLicense(): StoredLicenseRecord | null {
  const file = storePath();
  if (!existsSync(file)) {
    return null;
  }
  try {
    const raw = readFileSync(file);
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(raw)
      : raw.toString("utf8");
    const parsed = JSON.parse(json) as StoredLicenseRecord;
    if (!parsed.deviceHash) return null;
    if (parsed.kind === "trial") return parsed;
    if (!parsed.licenseKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredLicense(record: StoredLicenseRecord): void {
  const file = storePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(record);
  const bytes = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(payload)
    : Buffer.from(payload, "utf8");
  writeFileSync(file, bytes);
}

export function touchLastSeen(record: StoredLicenseRecord): StoredLicenseRecord {
  const next = { ...record, lastSeenAt: new Date().toISOString() };
  if (record.licenseKey || record.kind === "trial") {
    writeStoredLicense(next);
  }
  return next;
}
