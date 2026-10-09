import { createCipheriv, createDecipheriv, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const HMAC_LENGTH = 32;
const MAGIC = Buffer.from("BHDS");
const VERSION = 1;
const PBKDF2_SALT = "bhbackup-desktop-salt";
const KEY_MATERIAL = "bilirkisi-desktop-bhbackup-v1";

export type BackupPayload = {
  meta: {
    app: string;
    version: number;
    createdAt: string;
    totalCases: number;
  };
  cases: Array<{
    name: string;
    type: string;
    data: unknown;
    originalCreatedAt?: string;
    /** Klasör adı; eski yedeklerde yoktur ve kayıt klasörsüz yüklenir. */
    folder?: string | null;
  }>;
  /** Boş klasörlerin de geri gelmesi için. Eski uygulama sürümleri bu alanı yok sayar. */
  folders?: Array<{ name: string }>;
};

function deriveKey(): Buffer {
  return pbkdf2Sync(KEY_MATERIAL, PBKDF2_SALT, 100_000, KEY_LENGTH, "sha256");
}

function createSignature(data: Buffer): Buffer {
  return createHmac("sha256", KEY_MATERIAL).update(data).digest();
}

export function createBackupFile(data: BackupPayload): Buffer {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const json = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const header = Buffer.alloc(8);
  MAGIC.copy(header, 0);
  header.writeUInt32BE(VERSION, 4);
  const payload = Buffer.concat([header, iv, authTag, encrypted]);
  const signature = createSignature(payload);
  return Buffer.concat([payload, signature]);
}

export function parseBackupFile(fileBuffer: Buffer): BackupPayload {
  const minSize = 8 + IV_LENGTH + AUTH_TAG_LENGTH + HMAC_LENGTH;
  if (fileBuffer.length < minSize) {
    throw new Error("Invalid backup file: too small");
  }

  const signature = fileBuffer.subarray(fileBuffer.length - HMAC_LENGTH);
  const payload = fileBuffer.subarray(0, fileBuffer.length - HMAC_LENGTH);
  const magic = payload.subarray(0, 4);
  if (!magic.equals(MAGIC)) {
    throw new Error("Geçersiz yedek dosyası");
  }
  const version = payload.readUInt32BE(4);
  if (version !== VERSION) {
    throw new Error(`Unsupported backup version: ${version}`);
  }
  if (!timingSafeEqual(createSignature(payload), signature)) {
    throw new Error("Backup file signature verification failed");
  }

  const iv = payload.subarray(8, 8 + IV_LENGTH);
  const authTag = payload.subarray(8 + IV_LENGTH, 8 + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(8 + IV_LENGTH + AUTH_TAG_LENGTH);
  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as BackupPayload;
  return parsed;
}
