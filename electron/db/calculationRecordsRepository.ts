import { randomUUID } from "node:crypto";
import {
  type CalculationRecord,
  type CalculationRecordInput,
  type CalculationRecordUpdate,
  type CalculationType,
} from "../../shared/desktop-contract";
import { getDatabase } from "./database";
import { AppError } from "./errors";
import { parseStoredJsonObject, parseStoredJsonObjectOrNull, serializeJsonValue } from "./json";

type CalculationRow = {
  id: string;
  calculation_type: string;
  title: string;
  input_json: string;
  result_json: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

const TITLE_MAX = 200;
const NOTES_MAX = 4000;

export function listCalculationRecords(): CalculationRecord[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, calculation_type, title, input_json, result_json, notes, created_at, updated_at, archived_at
       FROM calculation_records
       WHERE archived_at IS NULL
       ORDER BY updated_at DESC`,
    )
    .all() as CalculationRow[];
  return rows.map(mapRow);
}

export function countActiveCalculationRecords(): number {
  const row = getDatabase()
    .prepare("SELECT COUNT(*) AS count FROM calculation_records WHERE archived_at IS NULL")
    .get() as { count: number };
  return Number(row.count);
}

export function getCalculationRecord(id: string): CalculationRecord {
  const row = getDatabase()
    .prepare(
      `SELECT id, calculation_type, title, input_json, result_json, notes, created_at, updated_at, archived_at
       FROM calculation_records
       WHERE id = ? AND archived_at IS NULL`,
    )
    .get(assertId(id)) as CalculationRow | undefined;
  if (!row) {
    throw new AppError("Kayıt bulunamadı.");
  }
  return mapRow(row);
}

export function createCalculationRecord(payload: Record<string, unknown> | CalculationRecordInput): CalculationRecord {
  const now = new Date().toISOString();
  const record: CalculationRecord = {
    id: randomUUID(),
    calculationType: assertCalculationType(payload.calculationType),
    title: assertTitle(payload.title),
    inputJson: parseIncomingObject(payload.inputJson ?? {}, "Girdi verisi"),
    resultJson: payload.resultJson == null ? null : parseIncomingObject(payload.resultJson, "Sonuç verisi"),
    notes: assertNotes(payload.notes),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };

  getDatabase()
    .prepare(
      `INSERT INTO calculation_records (
         id, calculation_type, title, input_json, result_json, notes, created_at, updated_at, archived_at
       ) VALUES (
         @id, @calculation_type, @title, @input_json, @result_json, @notes, @created_at, @updated_at, @archived_at
       )`,
    )
    .run(toRow(record));

  return record;
}

export function updateCalculationRecord(
  id: string,
  payload: Record<string, unknown> | CalculationRecordUpdate,
): CalculationRecord {
  const existing = getCalculationRecord(id);
  const next: CalculationRecord = {
    ...existing,
    title: payload.title === undefined ? existing.title : assertTitle(payload.title),
    notes: payload.notes === undefined ? existing.notes : assertNotes(payload.notes),
    inputJson:
      payload.inputJson === undefined
        ? existing.inputJson
        : parseIncomingObject(payload.inputJson, "Girdi verisi"),
    resultJson:
      payload.resultJson === undefined
        ? existing.resultJson
        : payload.resultJson == null
          ? null
          : parseIncomingObject(payload.resultJson, "Sonuç verisi"),
    updatedAt: new Date().toISOString(),
  };

  const result = getDatabase()
    .prepare(
      `UPDATE calculation_records
       SET title = @title,
           input_json = @input_json,
           result_json = @result_json,
           notes = @notes,
           updated_at = @updated_at
       WHERE id = @id AND archived_at IS NULL`,
    )
    .run(toRow(next));

  if (result.changes !== 1) {
    throw new AppError("Kayıt güncellenemedi.");
  }
  return next;
}

export function archiveCalculationRecord(id: string): { id: string } {
  const now = new Date().toISOString();
  const result = getDatabase()
    .prepare(
      `UPDATE calculation_records
       SET archived_at = ?, updated_at = ?
       WHERE id = ? AND archived_at IS NULL`,
    )
    .run(now, now, assertId(id));
  if (result.changes !== 1) {
    throw new AppError("Kayıt bulunamadı.");
  }
  return { id };
}

export function createDevelopmentSampleRecord(): CalculationRecord {
  return createCalculationRecord({
    calculationType: "kidem-tazminati",
    title: "Geliştirme örnek kaydı",
    notes: "Bu kayıt hesaplama sonucu değildir. Yalnızca yerel depolama akışını doğrulamak için oluşturuldu.",
    inputJson: { source: "development-sample" },
    resultJson: null,
  });
}

function mapRow(row: CalculationRow): CalculationRecord {
  return {
    id: row.id,
    calculationType: assertCalculationType(row.calculation_type),
    title: row.title,
    inputJson: parseStoredJsonObject(row.input_json, "Girdi verisi"),
    resultJson: parseStoredJsonObjectOrNull(row.result_json, "Sonuç verisi"),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function toRow(record: CalculationRecord): Record<string, string | null> {
  return {
    id: record.id,
    calculation_type: record.calculationType,
    title: record.title,
    input_json: serializeJsonValue(record.inputJson, "Girdi verisi", false) ?? "{}",
    result_json: serializeJsonValue(record.resultJson, "Sonuç verisi", true),
    notes: record.notes,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    archived_at: record.archivedAt,
  };
}

function parseIncomingObject(value: unknown, label: string): Record<string, unknown> {
  const serialized = serializeJsonValue(value, label, false);
  if (serialized == null) {
    throw new AppError(`${label} geçersiz.`);
  }
  return parseStoredJsonObject(serialized, label);
}

function assertTitle(title: unknown): string {
  if (typeof title !== "string") {
    throw new AppError("Başlık gerekli.");
  }
  const trimmed = title.trim();
  if (!trimmed) {
    throw new AppError("Başlık boş olamaz.");
  }
  if (trimmed.length > TITLE_MAX) {
    throw new AppError("Başlık çok uzun.");
  }
  return trimmed;
}

function assertNotes(notes: unknown): string | null {
  if (notes == null || notes === "") {
    return null;
  }
  if (typeof notes !== "string") {
    throw new AppError("Not metni geçersiz.");
  }
  const trimmed = notes.trim();
  if (trimmed.length > NOTES_MAX) {
    throw new AppError("Not metni çok uzun.");
  }
  return trimmed.length ? trimmed : null;
}

function assertCalculationType(value: unknown): CalculationType {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length <= 80 && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(trimmed)) {
      return trimmed;
    }
  }
  throw new AppError("Desteklenmeyen hesaplama türü.");
}

function assertId(id: unknown): string {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AppError("Kayıt kimliği geçersiz.");
  }
  return id;
}
