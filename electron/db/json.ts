import { AppError } from "./errors";

const MAX_JSON_BYTES = 256 * 1024;

export function parseStoredJsonObject(raw: string, fieldLabel: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      throw new AppError(`${fieldLabel} geçersiz.`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(`${fieldLabel} okunamadı.`);
  }
}

export function parseStoredJsonObjectOrNull(
  raw: string | null,
  fieldLabel: string,
): Record<string, unknown> | null {
  if (raw == null || raw === "") {
    return null;
  }
  return parseStoredJsonObject(raw, fieldLabel);
}

export function serializeJsonValue(
  value: unknown,
  fieldLabel: string,
  allowNull: boolean,
): string | null {
  if (value == null) {
    if (allowNull) {
      return null;
    }
    throw new AppError(`${fieldLabel} boş olamaz.`);
  }
  if (!isPlainObject(value)) {
    throw new AppError(`${fieldLabel} bir nesne olmalıdır.`);
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_JSON_BYTES) {
    throw new AppError(`${fieldLabel} çok büyük.`);
  }
  return serialized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
