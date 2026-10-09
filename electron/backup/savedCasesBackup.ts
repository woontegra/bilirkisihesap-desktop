import { BrowserWindow, dialog } from "electron";
import { writeFileSync, readFileSync } from "node:fs";
import type { CalculationFolder, CalculationRecord } from "../../shared/desktop-contract";
import { createBackupFile, parseBackupFile, type BackupPayload } from "./bhbackupFormat";
import { createCalculationRecord, listCalculationRecords } from "../db/calculationRecordsRepository";
import {
  assignCalculationRecordFolder,
  findOrCreateCalculationFolderByName,
  listCalculationFolders,
} from "../db/calculationFoldersRepository";
import { getDatabase } from "../db/database";
import { AppError } from "../db/errors";

const FORBIDDEN_KEYS = new Set([
  "licensekey",
  "license_key",
  "activationpassword",
  "activation_password",
  "tcmb_evds_api_key",
  "apikey",
  "api_key",
  "jwt_secret",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) continue;
    out[key] = stripSecrets(nested);
  }
  return out;
}

function extractForm(data: unknown): Record<string, unknown> {
  if (!isPlainObject(data)) return {};
  if (isPlainObject(data.form)) return data.form;
  if (isPlainObject(data.formValues)) return data.formValues;
  if (isPlainObject(data.inputJson)) return data.inputJson;
  if (isPlainObject(data.data)) return extractForm(data.data);
  const { results: _r, ...rest } = data;
  return rest;
}

function extractResults(data: unknown): Record<string, unknown> | null {
  if (!isPlainObject(data)) return null;
  if (isPlainObject(data.results)) return data.results;
  if (isPlainObject(data.resultJson)) return data.resultJson;
  return null;
}

export async function exportSavedCasesBackup(sender: Electron.WebContents): Promise<{
  cancelled: boolean;
  filename?: string;
}> {
  const records = listCalculationRecords();
  if (records.length === 0) {
    throw new AppError("Yedeklenecek hesaplama bulunamadı");
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `bilirkisi-${dateStr}.bhbackup`;
  const win = BrowserWindow.fromWebContents(sender);
  const picked = win
    ? await dialog.showSaveDialog(win, {
        title: "Yedekle",
        defaultPath: filename,
        filters: [{ name: "Bilirkişi yedek", extensions: ["bhbackup"] }],
      })
    : await dialog.showSaveDialog({
        title: "Yedekle",
        defaultPath: filename,
        filters: [{ name: "Bilirkişi yedek", extensions: ["bhbackup"] }],
      });
  if (picked.canceled || !picked.filePath) {
    return { cancelled: true };
  }

  const buffer = createBackupFile(buildBackupPayload(records, listCalculationFolders()));
  writeFileSync(picked.filePath, buffer);
  return { cancelled: false, filename };
}

export async function importSavedCasesBackup(
  sender: Electron.WebContents,
  fileBuffer?: ArrayBuffer,
): Promise<{ cancelled: boolean; message: string; imported: number; skipped: number }> {
  let bytes: Buffer;
  if (fileBuffer && fileBuffer.byteLength > 0) {
    bytes = Buffer.from(fileBuffer);
  } else {
    const win = BrowserWindow.fromWebContents(sender);
    const picked = win
      ? await dialog.showOpenDialog(win, {
          title: "Geri Yükle",
          filters: [{ name: "Bilirkişi yedek", extensions: ["bhbackup"] }],
          properties: ["openFile"],
        })
      : await dialog.showOpenDialog({
          title: "Geri Yükle",
          filters: [{ name: "Bilirkişi yedek", extensions: ["bhbackup"] }],
          properties: ["openFile"],
        });
    if (picked.canceled || !picked.filePaths[0]) {
      return { cancelled: true, message: "", imported: 0, skipped: 0 };
    }
    bytes = readFileSync(picked.filePaths[0]);
  }

  let backupData;
  try {
    backupData = parseBackupFile(bytes);
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    if (text.includes("signature")) {
      throw new AppError("Yedek dosyası bozuk veya değiştirilmiş. İmza doğrulaması başarısız.");
    }
    throw new AppError("Geçersiz yedek dosyası");
  }

  if (!backupData.meta || !Array.isArray(backupData.cases)) {
    throw new AppError("Yedek dosyası bozuk: metadata bulunamadı");
  }

  const { imported, skipped } = restoreBackupCases(backupData);

  return {
    cancelled: false,
    message: "Yedek başarıyla geri yüklendi",
    imported,
    skipped,
  };
}

export function buildBackupPayload(records: CalculationRecord[], folders: CalculationFolder[]): BackupPayload {
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
  return {
    meta: {
      app: "bilirkisihesap-desktop",
      version: 1,
      createdAt: new Date().toISOString(),
      totalCases: records.length,
    },
    cases: records.map((row) => ({
      name: row.title,
      type: row.calculationType,
      originalCreatedAt: row.createdAt,
      folder: (row.folderId && folderNames.get(row.folderId)) || null,
      data: stripSecrets({
        form: row.inputJson,
        formValues: row.inputJson,
        results: row.resultJson,
      }),
    })),
    folders: folders.map((folder) => ({ name: folder.name })),
  };
}

export function restoreBackupCases(backupData: BackupPayload): { imported: number; skipped: number } {
  let imported = 0;
  let skipped = 0;
  const apply = getDatabase().transaction(() => {
    const folderIds = new Map<string, string | null>();
    const folderIdFor = (name: unknown): string | null => {
      if (typeof name !== "string" || !name.trim()) return null;
      const key = name.trim().toLocaleLowerCase("tr-TR");
      if (!folderIds.has(key)) {
        let id: string | null = null;
        try {
          id = findOrCreateCalculationFolderByName(name)?.id ?? null;
        } catch {
          id = null;
        }
        folderIds.set(key, id);
      }
      return folderIds.get(key) ?? null;
    };

    if (Array.isArray(backupData.folders)) {
      for (const folder of backupData.folders) {
        folderIdFor(folder?.name);
      }
    }

    for (const caseData of backupData.cases) {
      try {
        const data = stripSecrets(caseData.data);
        const created = createCalculationRecord({
          calculationType: String(caseData.type || "hesaplama"),
          title: String(caseData.name || "Kayıt"),
          notes: null,
          inputJson: extractForm(data),
          resultJson: extractResults(data),
        });
        const folderId = folderIdFor(caseData.folder);
        if (folderId) assignCalculationRecordFolder(created.id, folderId);
        imported += 1;
      } catch {
        skipped += 1;
      }
    }
  });
  apply();
  return { imported, skipped };
}
