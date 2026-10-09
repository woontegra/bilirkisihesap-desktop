import { randomUUID } from "node:crypto";
import type { CalculationFolder } from "../../shared/desktop-contract";
import { getDatabase } from "./database";
import { AppError } from "./errors";

type FolderRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

const NAME_MAX = 80;
const MOVE_MAX = 5000;

export function listCalculationFolders(): CalculationFolder[] {
  const rows = getDatabase()
    .prepare("SELECT id, name, created_at, updated_at FROM calculation_folders")
    .all() as FolderRow[];
  return rows.map(mapRow).sort((a, b) => a.name.localeCompare(b.name, "tr-TR", { sensitivity: "base" }));
}

export function createCalculationFolder(name: unknown): CalculationFolder {
  const clean = assertFolderName(name);
  assertNameFree(clean, null);
  const now = new Date().toISOString();
  const folder: CalculationFolder = { id: randomUUID(), name: clean, createdAt: now, updatedAt: now };
  getDatabase()
    .prepare(
      "INSERT INTO calculation_folders (id, name, created_at, updated_at) VALUES (@id, @name, @created_at, @updated_at)",
    )
    .run(toRow(folder));
  return folder;
}

export function renameCalculationFolder(id: unknown, name: unknown): CalculationFolder {
  const existing = getFolder(assertFolderId(id));
  const clean = assertFolderName(name);
  assertNameFree(clean, existing.id);
  const next: CalculationFolder = { ...existing, name: clean, updatedAt: new Date().toISOString() };
  getDatabase()
    .prepare("UPDATE calculation_folders SET name = @name, updated_at = @updated_at WHERE id = @id")
    .run(toRow(next));
  return next;
}

/** Klasördeki hesaplamalar silinmez; klasörsüz duruma alınır. */
export function deleteCalculationFolder(id: unknown): { id: string; releasedRecords: number } {
  const folderId = getFolder(assertFolderId(id)).id;
  const db = getDatabase();
  return db.transaction(() => {
    const released = db.prepare("UPDATE calculation_records SET folder_id = NULL WHERE folder_id = ?").run(folderId);
    db.prepare("DELETE FROM calculation_folders WHERE id = ?").run(folderId);
    return { id: folderId, releasedRecords: Number(released.changes) };
  })();
}

export function moveCalculationRecordsToFolder(recordIds: unknown, folderId: unknown): { moved: number } {
  if (!Array.isArray(recordIds) || recordIds.length === 0) {
    throw new AppError("Taşınacak kayıt seçilmedi.");
  }
  if (recordIds.length > MOVE_MAX) {
    throw new AppError("Tek seferde çok fazla kayıt taşınamaz.");
  }
  const ids = recordIds.map(assertRecordId);
  const target = folderId == null || folderId === "" ? null : getFolder(assertFolderId(folderId)).id;
  const db = getDatabase();
  const update = db.prepare("UPDATE calculation_records SET folder_id = ? WHERE id = ? AND archived_at IS NULL");
  return db.transaction(() => {
    let moved = 0;
    for (const recordId of ids) {
      moved += Number(update.run(target, recordId).changes);
    }
    return { moved };
  })();
}

/** Geri yüklemede aynı adlı klasör varsa onu kullanır. */
export function findOrCreateCalculationFolderByName(name: unknown): CalculationFolder | null {
  let clean: string;
  try {
    clean = assertFolderName(name);
  } catch {
    return null;
  }
  return findByName(clean) ?? createCalculationFolder(clean);
}

export function assignCalculationRecordFolder(recordId: string, folderId: string | null): void {
  getDatabase()
    .prepare("UPDATE calculation_records SET folder_id = ? WHERE id = ? AND archived_at IS NULL")
    .run(folderId, assertRecordId(recordId));
}

function getFolder(id: string): CalculationFolder {
  const row = getDatabase()
    .prepare("SELECT id, name, created_at, updated_at FROM calculation_folders WHERE id = ?")
    .get(id) as FolderRow | undefined;
  if (!row) throw new AppError("Klasör bulunamadı.");
  return mapRow(row);
}

function nameKey(name: string): string {
  return name.toLocaleLowerCase("tr-TR");
}

function findByName(name: string): CalculationFolder | null {
  const key = nameKey(name);
  return listCalculationFolders().find((folder) => nameKey(folder.name) === key) ?? null;
}

function assertNameFree(name: string, exceptId: string | null): void {
  const clash = findByName(name);
  if (clash && clash.id !== exceptId) {
    throw new AppError("Bu adla bir klasör zaten var.");
  }
}

export function assertFolderName(name: unknown): string {
  if (typeof name !== "string") throw new AppError("Klasör adı gerekli.");
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean) throw new AppError("Klasör adı boş olamaz.");
  if (clean.length > NAME_MAX) throw new AppError("Klasör adı en fazla 80 karakter olabilir.");
  if (/[\u0000-\u001f\u007f]/.test(clean)) throw new AppError("Klasör adı geçersiz karakter içeriyor.");
  return clean;
}

function assertFolderId(id: unknown): string {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AppError("Klasör kimliği geçersiz.");
  }
  return id;
}

function assertRecordId(id: unknown): string {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AppError("Kayıt kimliği geçersiz.");
  }
  return id;
}

function mapRow(row: FolderRow): CalculationFolder {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

function toRow(folder: CalculationFolder): Record<string, string> {
  return { id: folder.id, name: folder.name, created_at: folder.createdAt, updated_at: folder.updatedAt };
}
