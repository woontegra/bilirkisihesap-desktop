import type { CalculationRecord } from "@shared/desktop-contract";
import { ApiError } from "./client";

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
};

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

export async function createSavedCase(payload: CreateSavedCasePayload): Promise<SavedCaseRecord> {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const form = (data.form ?? data.formValues ?? {}) as Record<string, unknown>;
  const created = unwrap(
    await api().createCalculationRecord({
      calculationType: payload.type.trim() || "hesaplama",
      title: payload.name.trim() || autoTitle(payload.type, form),
      notes: typeof form.notes === "string" ? form.notes : null,
      inputJson: form,
      resultJson: data.results ?? null,
    }),
  );
  const numericId = await ensureNumeric(created.id);
  return toSavedCaseRecord(created, numericId);
}

export async function updateSavedCase(id: number, payload: UpdateSavedCasePayload): Promise<SavedCaseRecord> {
  const uuid = await uuidFromNumeric(id);
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const form = (data.form ?? data.formValues ?? {}) as Record<string, unknown>;
  const updated = unwrap(
    await api().updateCalculationRecord(uuid, {
      title: payload.name.trim() || autoTitle(payload.type, form),
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
