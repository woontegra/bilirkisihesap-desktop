import { describe, expect, it } from "vitest";
import { resolveStableInsertAfter, resolveStableRowOverrides, withStableRowIds } from "./stableRowIds";
import { calcRowFm, computeVardiya48Result, createManualPeriodRow as v48Manual } from "../vardiya-48/engine";
import { createEmptyForm as emptyV48, type PeriodRow as V48Row } from "../vardiya-48/model";
import { computeGemi724Result, createManualPeriodRow as g724Manual } from "../gemi-adami-7-24/engine";
import { createEmptyForm as emptyG724, type PeriodRow as G724Row } from "../gemi-adami-7-24/model";

type AnyRow = { id: string; startISO: string; katsayi: number; isManual?: boolean; isDeductionRow?: boolean };

const v48Key = (r: V48Row) => `${r.startISO}|${r.weekTypeLabel}|${r.fmHours}|${r.isDeductionRow ? 1 : 0}`;
const g724Key = (r: G724Row) => `${r.startISO}|${r.fmHours}|${r.isDeductionRow ? 1 : 0}`;

function customRows<T extends AnyRow>(rows: T[]): T[] {
  return rows.filter((r) => !r.isManual && r.katsayi !== 1);
}

describe("withStableRowIds", () => {
  it("kimlik sıra numarasına bağlı değil; aradaki satır kalkınca diğer kimlikler değişmez", () => {
    const rows = [
      { id: "a", startISO: "2021-01-01", endISO: "2021-06-30" },
      { id: "b", startISO: "2021-07-01", endISO: "2021-12-31" },
      { id: "c", startISO: "2022-01-01", endISO: "2022-06-30" },
    ];
    const full = withStableRowIds(rows, "t").rows.map((r) => r.id);
    const without = withStableRowIds([rows[0], rows[2]], "t").rows.map((r) => r.id);
    expect(without).toEqual([full[0], full[2]]);
    expect(new Set(full).size).toBe(3);
  });

  it("aynı başlangıçlı satırlar benzersiz kimlik alır; elle eklenen satıra dokunulmaz", () => {
    const rows = [
      { id: "a", startISO: "2021-01-01", endISO: "2021-01-10" },
      { id: "b", startISO: "2021-01-01", endISO: "2021-01-20" },
      { id: "m", startISO: "", endISO: "", isManual: true },
    ];
    const ids = withStableRowIds(rows, "t").rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[2]).toBe("m");
  });

  it("eski kimlikle kaydedilmiş değişiklik ve insertAfter yeni kimliğe taşınır; yeni anahtar önceliklidir", () => {
    const { rows, legacyIds } = withStableRowIds(
      [
        { id: "old-0", startISO: "2021-01-01", endISO: "2021-06-30" },
        { id: "old-1", startISO: "2021-07-01", endISO: "2021-12-31" },
      ],
      "t",
    );
    const resolved = resolveStableRowOverrides({ "old-0": { katsayi: 2 }, "old-1": { katsayi: 3 }, [rows[1].id]: { katsayi: 4 } }, legacyIds);
    expect(resolved[rows[0].id]).toEqual({ katsayi: 2 });
    expect(resolved[rows[1].id]).toEqual({ katsayi: 4 });
    const manuals = resolveStableInsertAfter([{ id: "m", insertAfter: "old-1" }], legacyIds);
    expect(manuals[0].insertAfter).toBe(rows[1].id);
  });
});

describe("Vardiya 48 — satır katsayısı doğru satırda kalır", () => {
  const base = { ...emptyV48(), iseGiris: "2021-01-01", istenCikis: "2023-12-31", katSayi: "1" };
  const first = computeVardiya48Result(base);
  const target = first.rows[2];
  const withKat = { ...base, rowOverrides: { [target.id]: { katsayi: 2 } } };

  function expectOnlyTarget(rows: V48Row[]) {
    const custom = customRows(rows);
    expect(custom.map(v48Key)).toEqual([v48Key(target)]);
    expect(custom[0].katsayi).toBe(2);
    expect(custom[0].fm).toBe(calcRowFm(custom[0].weeks, custom[0].fmHours, custom[0].brut, 2));
  }

  it("yeniden hesaplamada kimlikler aynı kalır", () => {
    expect(first.rows.length).toBeGreaterThan(4);
    expect(computeVardiya48Result(base).rows.map((r) => r.id)).toEqual(first.rows.map((r) => r.id));
    expectOnlyTarget(computeVardiya48Result(withKat).rows);
  });

  it("başka satır silinince (gizlenince) katsayı kaymaz", () => {
    const res = computeVardiya48Result({
      ...withKat,
      rowOverrides: { ...withKat.rowOverrides, [first.rows[0].id]: { hidden: true } },
    });
    expect(res.rows.some((r) => r.id === first.rows[0].id)).toBe(false);
    expectOnlyTarget(res.rows);
  });

  it("satır eklenince katsayı kaymaz ve yeni satır doğru yere girer", () => {
    const manual = v48Manual(first.rows[0].id, 1);
    const res = computeVardiya48Result({ ...withKat, manualRows: [manual] });
    expect(res.rows[1].id).toBe(manual.id);
    expectOnlyTarget(res.rows);
  });

  it("işe giriş tarihi değişip öne satır eklenince katsayı aynı satırda kalır", () => {
    const res = computeVardiya48Result({ ...withKat, iseGiris: "2020-03-01" });
    expect(res.rows[2].startISO).not.toBe(target.startISO);
    expectOnlyTarget(res.rows);
  });

  it("işten çıkış tarihi değişince katsayı aynı satırda kalır", () => {
    expectOnlyTarget(computeVardiya48Result({ ...withKat, istenCikis: "2023-03-31" }).rows);
  });

  it("öndeki satıra izin eklenince katsayı aynı satırda kalır", () => {
    const res = computeVardiya48Result({
      ...withKat,
      exclusions: [{ id: "x1", type: "Yıllık İzin", start: "2021-02-10", end: "2021-02-20", days: 11 }],
    });
    const shape = (rows: V48Row[]) => JSON.stringify(rows.map((r) => [r.startISO, r.weeks]));
    expect(shape(res.rows)).not.toBe(shape(first.rows));
    expectOnlyTarget(res.rows);
  });
});

describe("Gemi 7/24 — satır katsayısı doğru satırda kalır", () => {
  const base = { ...emptyG724(), iseGiris: "2021-01-01", istenCikis: "2023-12-31", katSayi: "1" };
  const first = computeGemi724Result(base);
  const target = first.rows[2];
  const withKat = { ...base, rowOverrides: { [target.id]: { katsayi: 2 } } };

  function expectOnlyTarget(rows: G724Row[]) {
    const custom = customRows(rows);
    expect(custom.map(g724Key)).toEqual([g724Key(target)]);
    expect(custom[0].katsayi).toBe(2);
  }

  it("yeniden hesaplamada kimlikler aynı kalır", () => {
    expect(first.rows.length).toBeGreaterThan(3);
    expect(computeGemi724Result(base).rows.map((r) => r.id)).toEqual(first.rows.map((r) => r.id));
    const res = computeGemi724Result(withKat);
    expectOnlyTarget(res.rows);
    const row = res.rows.find((r) => r.id === target.id)!;
    expect(row.fm).toBeCloseTo(target.fm * 2, 1);
  });

  it("başka satır silinince (gizlenince) katsayı kaymaz", () => {
    const res = computeGemi724Result({
      ...withKat,
      rowOverrides: { ...withKat.rowOverrides, [first.rows[0].id]: { hidden: true } },
    });
    expect(res.rows.some((r) => r.id === first.rows[0].id)).toBe(false);
    expectOnlyTarget(res.rows);
  });

  it("satır eklenince katsayı kaymaz ve yeni satır doğru yere girer", () => {
    const manual = g724Manual(first.rows[0].id, 1);
    const res = computeGemi724Result({ ...withKat, manualRows: [manual] });
    expect(res.rows[1].id).toBe(manual.id);
    expectOnlyTarget(res.rows);
  });

  it("öndeki satıra izin eklenince katsayı aynı satırda kalır", () => {
    const res = computeGemi724Result({
      ...withKat,
      exclusions: [{ id: "x1", type: "Yıllık İzin", start: "2021-01-10", end: "2021-01-20", days: 11 }],
    });
    expect(res.rows[0].weeks).toBeLessThan(first.rows[0].weeks);
    expectOnlyTarget(res.rows);
  });

  it("işe giriş ve çıkış tarihi değişip satırlar kayınca katsayı aynı satırda kalır", () => {
    const res = computeGemi724Result({ ...withKat, iseGiris: "2020-03-01", istenCikis: "2023-03-31" });
    expect(res.rows[2].startISO).not.toBe(target.startISO);
    expectOnlyTarget(res.rows);
  });
});
