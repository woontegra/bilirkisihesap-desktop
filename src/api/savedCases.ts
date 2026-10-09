import type { CalculationFolder, CalculationRecord } from "@shared/desktop-contract";
import { ApiError } from "./client";
import {
  folderNameKey,
  reportSaveFolderWarning,
  requestSaveFolder,
  SaveCancelledError,
  type SaveFolderChoice,
} from "./saveFolderPrompt";

export type SavedCaseRecord = {
  id: number;
  name?: string | null;
  kayit_adi?: string | null;
  aciklama?: string | null;
  type?: string;
  hesaplama_tipi?: string;
  data?: unknown;
  net_total?: number | null;
  createdAt?: string;
  created_at?: string;
  ise_giris?: string | null;
  isten_cikis?: string | null;
  folderId?: string | null;
};

export type SavedCaseFolder = CalculationFolder;

export type CreateSavedCasePayload = {
  name: string;
  type: string;
  data: unknown;
};

export type UpdateSavedCasePayload = {
  name: string;
  type: string;
  data: unknown;
};

/** promptFolder: false → klasör sorulmaz; yeni kayıt klasörsüz oluşturulur. */
export type SaveCaseOptions = { promptFolder?: boolean };

/**
 * Güncelleme pencere açmaz; kayıt kimliği ve klasörü her zaman korunur.
 * rename: true → yalnız Kayıtlı Hesaplamalar ekranındaki ad değişikliği; aksi halde mevcut ad korunur.
 */
export type UpdateSavedCaseOptions = { rename?: boolean };

const MAP_KEY = "saved-case-numeric-ids";
const LEGACY_MAP_KEY = "kidem-is-kanunu-numeric-ids";

type IdMap = {
  next: number;
  byNumeric: Record<string, string>;
  byUuid: Record<string, number>;
};

function api() {
  const desktop = window.bilirkisiDesktop;
  if (!desktop) throw new ApiError("Masaüstü köprüsü yok.", 0);
  return desktop;
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new ApiError(result.message, 403);
  return result.data;
}

async function readMap(): Promise<IdMap> {
  const row = unwrap(await api().getSetting(MAP_KEY));
  if (!row?.value) {
    const legacy = unwrap(await api().getSetting(LEGACY_MAP_KEY));
    if (!legacy?.value) return { next: 1, byNumeric: {}, byUuid: {} };
    try {
      return JSON.parse(legacy.value) as IdMap;
    } catch {
      return { next: 1, byNumeric: {}, byUuid: {} };
    }
  }
  try {
    const parsed = JSON.parse(row.value) as IdMap;
    return {
      next: Number(parsed.next) || 1,
      byNumeric: parsed.byNumeric ?? {},
      byUuid: parsed.byUuid ?? {},
    };
  } catch {
    return { next: 1, byNumeric: {}, byUuid: {} };
  }
}

async function writeMap(map: IdMap): Promise<void> {
  unwrap(await api().setSetting(MAP_KEY, JSON.stringify(map)));
}

async function ensureNumeric(uuid: string): Promise<number> {
  const map = await readMap();
  if (map.byUuid[uuid]) return map.byUuid[uuid];
  const numeric = map.next;
  map.next += 1;
  map.byUuid[uuid] = numeric;
  map.byNumeric[String(numeric)] = uuid;
  await writeMap(map);
  return numeric;
}

async function uuidFromNumeric(id: number): Promise<string> {
  const map = await readMap();
  const uuid = map.byNumeric[String(id)];
  if (!uuid) throw new ApiError("Kayıt yüklenemedi", 404);
  return uuid;
}

function toSavedCaseRecord(record: CalculationRecord, numericId: number): SavedCaseRecord {
  const input = record.inputJson as Record<string, unknown>;
  const results = (record.resultJson ?? {}) as Record<string, unknown>;
  const net =
    (typeof results.net === "number" ? results.net : null) ??
    (typeof results.netKidem === "number" ? results.netKidem : null) ??
    (typeof results.netTutar === "number" ? results.netTutar : null) ??
    (typeof results.netToplam === "number" ? results.netToplam : null) ??
    (typeof results.net_total === "number" ? results.net_total : null);
  return {
    id: numericId,
    name: record.title,
    kayit_adi: record.title,
    type: record.calculationType,
    hesaplama_tipi: record.calculationType,
    data: {
      form: input,
      formValues: input,
      results: record.resultJson,
    },
    net_total: net,
    createdAt: record.createdAt,
    created_at: record.createdAt,
    ise_giris: typeof input.iseGirisTarihi === "string" ? input.iseGirisTarihi : null,
    isten_cikis: typeof input.istenCikisTarihi === "string" ? input.istenCikisTarihi : null,
    folderId: record.folderId ?? null,
  };
}

export async function listSavedCases(): Promise<SavedCaseRecord[]> {
  const rows = unwrap(await api().listCalculationRecords());
  const out: SavedCaseRecord[] = [];
  for (const row of rows) {
    const numericId = await ensureNumeric(row.id);
    out.push(toSavedCaseRecord(row, numericId));
  }
  return out;
}

export async function getSavedCase(id: number): Promise<SavedCaseRecord> {
  const uuid = await uuidFromNumeric(id);
  const record = unwrap(await api().getCalculationRecord(uuid));
  return toSavedCaseRecord(record, id);
}

async function askFolder(suggestedName: string, options?: SaveCaseOptions): Promise<SaveFolderChoice> {
  if (options?.promptFolder === false) return { name: suggestedName, folderId: null };
  const choice = await requestSaveFolder({ mode: "create", suggestedName, currentFolderId: null });
  if (!choice) throw new SaveCancelledError();
  return choice;
}

/** Yeni klasör yalnızca kayıt onaylandıktan sonra oluşturulur; aynı adlı klasör varsa o kullanılır. */
async function resolveFolderChoice(choice: SaveFolderChoice): Promise<{ folderId: string | null; createdFolderId: string | null }> {
  if ("folderId" in choice) return { folderId: choice.folderId, createdFolderId: null };
  const key = folderNameKey(choice.newFolderName);
  const existing = unwrap(await api().listCalculationFolders()).find((f) => folderNameKey(f.name) === key);
  if (existing) return { folderId: existing.id, createdFolderId: null };
  const created = unwrap(await api().createCalculationFolder(choice.newFolderName));
  return { folderId: created.id, createdFolderId: created.id };
}

async function discardCreatedFolder(folderId: string | null): Promise<void> {
  if (!folderId) return;
  try {
    await api().deleteCalculationFolder(folderId);
  } catch {
    /* boş klasör kalırsa veri kaybı yok */
  }
}

async function assignFolder(record: CalculationRecord, folderId: string | null): Promise<CalculationRecord> {
  if ((record.folderId ?? null) === folderId) return record;
  try {
    unwrap(await api().moveCalculationRecordsToFolder([record.id], folderId));
    return { ...record, folderId };
  } catch (error) {
    reportSaveFolderWarning(
      `Hesaplama kaydedildi ancak klasöre taşınamadı: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
    );
    return record;
  }
}

export async function createSavedCase(
  payload: CreateSavedCasePayload,
  options?: SaveCaseOptions,
): Promise<SavedCaseRecord> {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const form = (data.form ?? data.formValues ?? {}) as Record<string, unknown>;
  const choice = await askFolder(payload.name.trim(), options);
  const title = choice.name?.trim() || payload.name.trim() || autoTitle(payload.type, form);
  const { folderId, createdFolderId } = await resolveFolderChoice(choice);
  let created: CalculationRecord;
  try {
    created = unwrap(
      await api().createCalculationRecord({
        calculationType: payload.type.trim() || "hesaplama",
        title,
        notes: typeof form.notes === "string" ? form.notes : null,
        inputJson: form,
        resultJson: data.results ?? null,
      }),
    );
  } catch (error) {
    await discardCreatedFolder(createdFolderId);
    throw error;
  }
  created = await assignFolder(created, folderId);
  const numericId = await ensureNumeric(created.id);
  return toSavedCaseRecord(created, numericId);
}

export async function updateSavedCase(
  id: number,
  payload: UpdateSavedCasePayload,
  options?: UpdateSavedCaseOptions,
): Promise<SavedCaseRecord> {
  const uuid = await uuidFromNumeric(id);
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const form = (data.form ?? data.formValues ?? {}) as Record<string, unknown>;
  const current = unwrap(await api().getCalculationRecord(uuid));
  const requested = options?.rename ? payload.name.trim() : "";
  const title = requested || current.title.trim() || payload.name.trim() || autoTitle(payload.type, form);
  const updated = unwrap(
    await api().updateCalculationRecord(uuid, {
      title,
      notes: typeof form.notes === "string" ? form.notes : null,
      inputJson: form,
      resultJson: data.results ?? null,
    }),
  );
  return toSavedCaseRecord(updated, id);
}

export async function deleteSavedCase(id: number): Promise<void> {
  const uuid = await uuidFromNumeric(id);
  unwrap(await api().deleteCalculationRecord(uuid));
}

function autoTitle(type: string, form: Record<string, unknown>): string {
  const exit = typeof form.istenCikisTarihi === "string" ? form.istenCikisTarihi : "";
  const formatted = exit ? exit.split("-").reverse().join(".") : new Date().toLocaleDateString("tr-TR");
  return `${type} — ${formatted}`;
}

export async function ensureNumericIdForUuid(uuid: string): Promise<number> {
  return ensureNumeric(uuid);
}

export async function listSavedCaseFolders(): Promise<SavedCaseFolder[]> {
  return unwrap(await api().listCalculationFolders());
}

export async function createSavedCaseFolder(name: string): Promise<SavedCaseFolder> {
  return unwrap(await api().createCalculationFolder(name));
}

export async function renameSavedCaseFolder(id: string, name: string): Promise<SavedCaseFolder> {
  return unwrap(await api().renameCalculationFolder(id, name));
}

export async function deleteSavedCaseFolder(id: string): Promise<{ id: string; releasedRecords: number }> {
  return unwrap(await api().deleteCalculationFolder(id));
}

export async function moveSavedCasesToFolder(ids: number[], folderId: string | null): Promise<{ moved: number }> {
  const uuids: string[] = [];
  for (const id of ids) uuids.push(await uuidFromNumeric(id));
  return unwrap(await api().moveCalculationRecordsToFolder(uuids, folderId));
}
