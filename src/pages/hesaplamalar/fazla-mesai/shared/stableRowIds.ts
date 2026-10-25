/**
 * Otomatik cetvel satırları için kalıcı kimlik. rowOverrides (satır katsayısı, brüt, hafta, gizleme)
 * ve elle eklenen satırların `insertAfter` bağı satır kimliğiyle eşleşir; kimlik sıra numarasından
 * türerse araya satır girdiğinde ya da bir satır kalktığında değişiklikler komşu satıra kayar.
 * Kimlik yalnızca satırın kendi başlangıç tarihi, türü ve kesinti durumundan üretilir.
 */

export type StableRowIdInput = {
  id: string;
  startISO: string;
  endISO: string;
  isManual?: boolean;
  isDeductionRow?: boolean;
};

export type StableRowIdResult<T> = {
  rows: T[];
  /** Yeni kimlik → aynı hesaplamada üretilen önceki kimlik (eski kayıtlardaki anahtarlar için). */
  legacyIds: Map<string, string>;
};

export function withStableRowIds<T extends StableRowIdInput>(
  rows: T[],
  prefix: string,
  kind: (row: T) => string = () => "",
): StableRowIdResult<T> {
  const used = new Set<string>();
  const legacyIds = new Map<string, string>();
  const out = rows.map((row) => {
    if (row.isManual) return row;
    const start = String(row.startISO || "").slice(0, 10);
    const end = String(row.endISO || "").slice(0, 10);
    const base = `${prefix}-${start}-${row.isDeductionRow ? "d" : "b"}-${kind(row)}`;
    let id = base;
    if (used.has(id)) id = `${base}~${end}`;
    for (let n = 2; used.has(id); n += 1) id = `${base}~${end}~${n}`;
    used.add(id);
    if (row.id && row.id !== id) legacyIds.set(id, row.id);
    return { ...row, id };
  });
  return { rows: out, legacyIds };
}

/** Yeni kimlikte değişiklik yoksa eski kimlikle kaydedilmiş değişikliği yeni kimliğe taşır. */
export function resolveStableRowOverrides<O>(
  overrides: Record<string, O> | undefined,
  legacyIds: Map<string, string>,
): Record<string, O> {
  const src = overrides ?? {};
  const out: Record<string, O> = { ...src };
  legacyIds.forEach((legacyId, id) => {
    if (out[id] === undefined && src[legacyId] !== undefined) out[id] = src[legacyId];
  });
  return out;
}

/** Elle eklenen satırın `insertAfter` bağı eski kimliği gösteriyorsa yeni kimliğe çevirir. */
export function resolveStableInsertAfter<M extends { insertAfter?: string }>(
  manualRows: M[] | undefined,
  legacyIds: Map<string, string>,
): M[] {
  const list = manualRows ?? [];
  if (legacyIds.size === 0) return list;
  const byLegacy = new Map<string, string>();
  legacyIds.forEach((legacyId, id) => byLegacy.set(legacyId, id));
  return list.map((m) => {
    const mapped = m.insertAfter ? byLegacy.get(m.insertAfter) : undefined;
    return mapped ? { ...m, insertAfter: mapped } : m;
  });
}
