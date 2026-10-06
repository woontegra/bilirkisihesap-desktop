import type { AppSetting } from "../../shared/desktop-contract";
import { getDatabase } from "./database";
import { AppError } from "./errors";

const KEY_PATTERN = /^[a-z][a-z0-9_.-]{1,63}$/;
const VALUE_MAX = 200000;
const ALLOWED_KEYS = new Set([
  "locale",
  "saved-case-numeric-ids",
  "kidem-is-kanunu-numeric-ids",
  "extra-calculations-sets",
  "dashboard-last-used-at",
]);

export function getSetting(key: string): AppSetting | null {
  const safeKey = assertKey(key);
  const row = getDatabase()
    .prepare("SELECT key, value, created_at, updated_at FROM app_settings WHERE key = ?")
    .get(safeKey) as
    | { key: string; value: string; created_at: string; updated_at: string }
    | undefined;
  if (!row) {
    return null;
  }
  return {
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function setSetting(key: string, value: string): AppSetting {
  const safeKey = assertKey(key);
  const safeValue = assertValue(value);
  const now = new Date().toISOString();
  const existing = getSetting(safeKey);
  const createdAt = existing?.createdAt ?? now;

  getDatabase()
    .prepare(
      `INSERT INTO app_settings (key, value, created_at, updated_at)
       VALUES (@key, @value, @created_at, @updated_at)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .run({
      key: safeKey,
      value: safeValue,
      created_at: createdAt,
      updated_at: now,
    });

  return {
    key: safeKey,
    value: safeValue,
    createdAt,
    updatedAt: now,
  };
}

export function isAllowedAppSettingKey(key: string): boolean {
  return KEY_PATTERN.test(key) && ALLOWED_KEYS.has(key);
}

function assertKey(key: unknown): string {
  if (typeof key !== "string" || !isAllowedAppSettingKey(key)) {
    const label = typeof key === "string" ? key : "unknown";
    throw new AppError(`Ayar anahtarı geçersiz (${label}).`);
  }
  return key;
}

function assertValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError("Ayar değeri geçersiz.");
  }
  if (value.length > VALUE_MAX) {
    throw new AppError("Ayar değeri çok uzun.");
  }
  return value;
}
