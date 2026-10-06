import { ApiError } from "./client";

export type ExtraSetItem = { id: string; name: string; value: string };
export type SavedExtraSet = {
  id: number;
  name: string;
  data: ExtraSetItem[];
  createdAt?: string;
  updatedAt?: string;
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

export function createExtraSetsApi(settingKey: string, newLocalId: () => string) {
  function text(value: unknown): string {
    return value == null ? "" : String(value);
  }

  function normalizeItems(value: unknown): ExtraSetItem[] {
    let source = value;
    if (typeof source === "string") {
      try {
        source = JSON.parse(source);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(source)) return [];
    return source
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        id: text(item.id) || newLocalId(),
        name: text(item.name ?? item.label),
        value: text(item.value),
      }));
  }

  async function readSets(): Promise<SavedExtraSet[]> {
    const row = unwrap(await api().getSetting(settingKey));
    if (!row?.value) return [];
    try {
      const parsed = JSON.parse(row.value) as unknown;
      if (!Array.isArray(parsed)) return [];
      const out: SavedExtraSet[] = [];
      for (const raw of parsed) {
        if (!raw || typeof raw !== "object") continue;
        const rec = raw as Record<string, unknown>;
        const id = Number(rec.id);
        const name = text(rec.name).trim();
        if (!Number.isFinite(id) || id <= 0 || !name) continue;
        out.push({
          id,
          name,
          data: normalizeItems(rec.data),
          createdAt: rec.createdAt ? text(rec.createdAt) : undefined,
          updatedAt: rec.updatedAt ? text(rec.updatedAt) : undefined,
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  async function writeSets(sets: SavedExtraSet[]): Promise<void> {
    unwrap(await api().setSetting(settingKey, JSON.stringify(sets)));
  }

  function describeSetsError(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 401) return "Oturum süresi doldu. Lütfen tekrar giriş yapın.";
      if (error.status === 403) return "Ekstra hesaplama setlerine erişim yetkiniz yok.";
      if (error.status >= 500) return "Sunucu hatası. Lütfen daha sonra tekrar deneyin.";
      return error.message || "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
    }
    if (error instanceof TypeError) return "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.";
    if (error instanceof Error && error.message) return error.message;
    return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
  }

  async function listExtraSets(): Promise<SavedExtraSet[]> {
    return readSets();
  }

  async function upsertExtraSet(name: string, items: ExtraSetItem[]): Promise<SavedExtraSet> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Lütfen bir isim girin");
    if (!items.length) throw new Error("Kaydedilecek ekstra hesaplama bulunamadı");
    const data = items.map((item) => ({
      id: item.id || newLocalId(),
      name: String(item.name || ""),
      value: item.value == null ? "" : String(item.value),
    }));
    const sets = await readSets();
    const now = new Date().toISOString();
    const existing = sets.findIndex((item) => item.name.trim().toLowerCase() === trimmed.toLowerCase());
    let saved: SavedExtraSet;
    if (existing >= 0) {
      saved = { ...sets[existing], name: trimmed, data, updatedAt: now };
      sets[existing] = saved;
    } else {
      const nextId = sets.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      saved = { id: nextId, name: trimmed, data, createdAt: now, updatedAt: now };
      sets.push(saved);
    }
    await writeSets(sets);
    return saved;
  }

  async function saveExtraSet(name: string, data: ExtraSetItem[]): Promise<SavedExtraSet> {
    return upsertExtraSet(name, data);
  }

  async function deleteExtraSet(id: number): Promise<void> {
    if (!Number.isFinite(id) || id <= 0) throw new Error("Geçersiz set");
    const sets = await readSets();
    await writeSets(sets.filter((item) => item.id !== id));
  }

  async function removeExtraSet(id: number): Promise<void> {
    return deleteExtraSet(id);
  }

  return {
    describeSetsError,
    listExtraSets,
    saveExtraSet,
    deleteExtraSet,
    upsertExtraSet,
    removeExtraSet,
  };
}
