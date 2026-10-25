import { describe, expect, it } from "vitest";
import { HAKKANIYET_ORANLARI, type HakkaniyetOrani } from "./hakkaniyetOrani";
import { formatMoney } from "../../hafta-tatili/lib/money";
import { computeStandardHaftaTatili } from "../../hafta-tatili/standard/engine";
import { computeGemiHaftaTatili } from "../../hafta-tatili/gemi/engine";
import { computeBasinHaftaTatili } from "../../hafta-tatili/basin/engine";
import { createEmptyForm as emptyHtStandard, snapshotKey as htStandardSnapshot } from "../../hafta-tatili/standard/model";
import { createEmptyForm as emptyHtGemi, snapshotKey as htGemiSnapshot } from "../../hafta-tatili/gemi/model";
import { createEmptyForm as emptyHtBasin, snapshotKey as htBasinSnapshot } from "../../hafta-tatili/basin/model";
import { buildStandartHtSaveData } from "../../hafta-tatili/standard/buildStandartHtSaveData";
import { buildGemiHtSaveData } from "../../hafta-tatili/gemi/buildGemiHtSaveData";
import { buildBasinHtSaveData } from "../../hafta-tatili/basin/buildBasinHtSaveData";
import { buildStandartHtPreviewSections } from "../../hafta-tatili/standard/buildStandartHtPreviewSections";
import { buildGemiHtPreviewSections } from "../../hafta-tatili/gemi/buildGemiHtPreviewSections";
import { buildBasinHtPreviewSections } from "../../hafta-tatili/basin/buildBasinHtPreviewSections";
import { mapHtStandartFormFromBackend } from "../../hafta-tatili/standard/backendCase";
import { mapHtGemiFormFromBackend } from "../../hafta-tatili/gemi/backendCase";
import { mapHtBasinFormFromBackend } from "../../hafta-tatili/basin/backendCase";
import * as htStandardStorage from "../../hafta-tatili/standard/storage";
import * as htGemiStorage from "../../hafta-tatili/gemi/storage";
import * as htBasinStorage from "../../hafta-tatili/basin/storage";
import { calcHakkaniyet as ubgtHakkaniyet } from "../../ubgt/engine";
import { createEmptyForm as emptyUbgt, STORAGE_KEY as UBGT_STORAGE_KEY, type UbgtForm } from "../../ubgt/model";
import { buildStandartUbgtSaveData } from "../../ubgt/standart/buildStandartUbgtSaveData";
import { buildBilirkisiUbgtSaveData } from "../../ubgt/bilirkisi/buildBilirkisiUbgtSaveData";
import { mapUbgtFormFromBackend } from "../../ubgt/backendCase";
import * as ubgtStorage from "../../ubgt/storage";

type AnyForm = Record<string, unknown> & { settleAmount: string };
type HtResult = { totalBrut: number; hakkaniyet: number; mahsupSonuc: number; net: { netAmount: number } };

const YUZDE: Record<HakkaniyetOrani, number | null> = {
  "1/3": null,
  "%20": 20,
  "%25": 25,
  "%30": 30,
  "%35": 35,
  "%40": 40,
  "%45": 45,
};
const round2 = (n: number) => Math.round((n || 0) * 100) / 100;
const parseSettle = (s: string) => Number(String(s ?? "").replace(/\./g, "").replace(",", ".").trim()) || 0;
const DATE_RANGES = [{ id: "dr-1", start: "2019-01-01", end: "2021-12-31" }];

function withoutOran(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutOran);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== "hakkaniyetOrani")
      .map(([k, v]) => [k, withoutOran(v)]),
  );
}

function payloadForms(data: Record<string, unknown>): Record<string, unknown>[] {
  const inner = (data.data as Record<string, unknown> | undefined)?.form as Record<string, unknown> | undefined;
  return [inner, data.form, data.formValues].filter(Boolean) as Record<string, unknown>[];
}

const memory = new Map<string, string>();
Object.assign(globalThis, {
  window: globalThis,
  localStorage: {
    getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
  },
});

const HT_MODULES = [
  {
    name: "Hafta Tatili Standart",
    buildForm: (settleAmount: string) => ({ ...emptyHtStandard(), dateRanges: DATE_RANGES.map((r) => ({ ...r })), settleAmount }),
    compute: computeStandardHaftaTatili as unknown as (f: AnyForm) => HtResult,
    preview: buildStandartHtPreviewSections as unknown as (o: { form: AnyForm; result: HtResult }) => { rows: unknown[][] }[],
    save: buildStandartHtSaveData as unknown as (f: AnyForm, r: unknown) => Record<string, unknown>,
    map: mapHtStandartFormFromBackend as unknown as (d: unknown) => AnyForm | null,
    snapshot: htStandardSnapshot as unknown as (f: AnyForm) => string,
    storage: htStandardStorage,
  },
  {
    name: "Hafta Tatili Gemi Adamı",
    buildForm: (settleAmount: string) => ({ ...emptyHtGemi(), dateRanges: DATE_RANGES.map((r) => ({ ...r })), settleAmount }),
    compute: computeGemiHaftaTatili as unknown as (f: AnyForm) => HtResult,
    preview: buildGemiHtPreviewSections as unknown as (o: { form: AnyForm; result: HtResult }) => { rows: unknown[][] }[],
    save: buildGemiHtSaveData as unknown as (f: AnyForm, r: unknown) => Record<string, unknown>,
    map: mapHtGemiFormFromBackend as unknown as (d: unknown) => AnyForm | null,
    snapshot: htGemiSnapshot as unknown as (f: AnyForm) => string,
    storage: htGemiStorage,
  },
  {
    name: "Hafta Tatili Basın İş",
    buildForm: (settleAmount: string) => ({ ...emptyHtBasin(), dateRanges: DATE_RANGES.map((r) => ({ ...r })), settleAmount }),
    compute: computeBasinHaftaTatili as unknown as (f: AnyForm) => HtResult,
    preview: buildBasinHtPreviewSections as unknown as (o: { form: AnyForm; result: HtResult }) => { rows: unknown[][] }[],
    save: buildBasinHtSaveData as unknown as (f: AnyForm, r: unknown) => Record<string, unknown>,
    map: mapHtBasinFormFromBackend as unknown as (d: unknown) => AnyForm | null,
    snapshot: htBasinSnapshot as unknown as (f: AnyForm) => string,
    storage: htBasinStorage,
  },
];

describe.each(HT_MODULES)("$name", (m) => {
  it("yeni form 1/3 ile başlar", () => {
    expect(m.buildForm("").hakkaniyetOrani).toBe("1/3");
  });

  it.each(["", "5.000,50", "99999999"])("1/3 eski formülle aynı; yüzdeler yalnız hakkaniyeti değiştirir (mahsup=%s)", (settle) => {
    const form = m.buildForm(settle);
    const base = m.compute(form);
    expect(base.totalBrut).toBeGreaterThan(0);
    expect(base.hakkaniyet).toBe(round2(base.totalBrut / 3));
    expect(m.compute(withoutOran(form) as AnyForm).hakkaniyet).toBe(base.hakkaniyet);

    for (const oran of HAKKANIYET_ORANLARI) {
      const yuzde = YUZDE[oran];
      const r = m.compute({ ...form, hakkaniyetOrani: oran });
      const hk = yuzde === null ? base.hakkaniyet : round2((base.totalBrut * yuzde) / 100);
      expect(r.hakkaniyet).toBe(hk);
      expect(r.mahsupSonuc).toBe(round2(Math.max(0, base.totalBrut - hk - parseSettle(settle))));
      expect(r.totalBrut).toBe(base.totalBrut);
      expect(r.net).toEqual(base.net);

      const rows = m.preview({ form: { ...form, hakkaniyetOrani: oran }, result: r }).flatMap((s) => s.rows);
      expect(rows).toContainEqual([`${oran} Hakkaniyet İndirimi`, `−${formatMoney(hk)} ₺`]);
      if (oran !== "1/3") {
        expect(rows.some((row) => row[0] === "1/3 Hakkaniyet İndirimi")).toBe(false);
        expect(m.snapshot({ ...form, hakkaniyetOrani: oran })).not.toBe(m.snapshot(form));
      }
    }
  });

  it.each([...HAKKANIYET_ORANLARI])("kaydet → geri yükle oranı korur (%s)", (oran) => {
    const payload = JSON.parse(JSON.stringify(m.save({ ...m.buildForm("5.000,50"), hakkaniyetOrani: oran }, { brut: 0, net: 0 })));
    expect(payloadForms(payload).map((f) => f.hakkaniyetOrani)).toEqual(payloadForms(payload).map(() => oran));
    expect(m.map(payload)?.hakkaniyetOrani).toBe(oran);
    expect(m.map({ data: payload })?.hakkaniyetOrani).toBe(oran);
  });

  it("eski kayıt (alan yok) ve bozuk değer 1/3 açılır", () => {
    const payload = JSON.parse(JSON.stringify(m.save(m.buildForm("5.000,50"), { brut: 0, net: 0 })));
    expect(m.map(withoutOran(payload))?.hakkaniyetOrani).toBe("1/3");
    for (const f of payloadForms(payload)) f.hakkaniyetOrani = "%33,33";
    expect(m.map(payload)?.hakkaniyetOrani).toBe("1/3");
  });

  it("yerel kayıt oranı korur; eski yerel kayıt 1/3 yüklenir", () => {
    memory.clear();
    const form = { ...m.buildForm("5.000,50"), hakkaniyetOrani: "%35" };
    expect(m.storage.saveCase("Yerel", form as never, { totalBrut: 1, netAmount: 1 })).toBeTruthy();
    expect(m.storage.loadCasesSafe().items[0]?.form.hakkaniyetOrani).toBe("%35");
    const raw = JSON.parse(memory.get(m.storage.STORAGE_KEY)!) as { cases: { form: Record<string, unknown> }[] };
    delete raw.cases[0].form.hakkaniyetOrani;
    memory.set(m.storage.STORAGE_KEY, JSON.stringify(raw));
    expect(m.storage.loadCasesSafe().items[0]?.form.hakkaniyetOrani).toBe("1/3");
  });
});

describe("UBGT hakkaniyet motoru", () => {
  it("1/3 eski formül (brut / 3, yuvarlamasız); yüzdeler brut × N / 100", () => {
    for (const brut of [13090, 4567.89, 0.01]) {
      expect(ubgtHakkaniyet(brut)).toBe(brut / 3);
      expect(ubgtHakkaniyet(brut, "1/3")).toBe(brut / 3);
      for (const oran of HAKKANIYET_ORANLARI) {
        const yuzde = YUZDE[oran];
        expect(ubgtHakkaniyet(brut, oran)).toBe(yuzde === null ? brut / 3 : (brut * yuzde) / 100);
      }
    }
  });
});

describe.each([
  ["standart", buildStandartUbgtSaveData],
  ["bilirkisi", buildBilirkisiUbgtSaveData],
] as const)("UBGT %s", (mode, build) => {
  const buildForm = (): UbgtForm => ({
    ...emptyUbgt(mode),
    dateRanges: [{ id: "range-1", start: "2019-01-01", end: "2021-12-31" }] as UbgtForm["dateRanges"],
    year: 2021,
    settleAmount: "5.000,50",
  });

  it("yeni form 1/3 ile başlar", () => {
    expect(emptyUbgt(mode).hakkaniyetOrani).toBe("1/3");
  });

  it.each([...HAKKANIYET_ORANLARI])("kaydet → geri yükle oranı korur (%s)", (oran) => {
    const payload = JSON.parse(JSON.stringify(build({ ...buildForm(), hakkaniyetOrani: oran }, { brut: 0, net: 0 })));
    expect(payloadForms(payload).every((f) => f.hakkaniyetOrani === oran)).toBe(true);
    expect(mapUbgtFormFromBackend(mode, payload)?.hakkaniyetOrani).toBe(oran);
    expect(mapUbgtFormFromBackend(mode, { data: payload })?.hakkaniyetOrani).toBe(oran);
  });

  it("eski kayıt (alan yok) 1/3 açılır", () => {
    const payload = JSON.parse(JSON.stringify(build(buildForm(), { brut: 0, net: 0 })));
    expect(mapUbgtFormFromBackend(mode, withoutOran(payload))?.hakkaniyetOrani).toBe("1/3");
  });

  it("yerel kayıt oranı korur; eski yerel kayıt 1/3 yüklenir", () => {
    memory.clear();
    const form = { ...buildForm(), hakkaniyetOrani: "%40" as const };
    const results = { periods: [], ubgtDayEntries: [], toplamBrut: 1, toplamNet: {} as never, totalDays: 1 };
    expect(ubgtStorage.saveCase(mode, "Yerel", form, results)).toBeTruthy();
    expect(ubgtStorage.loadCasesSafe(mode).items[0]?.form.hakkaniyetOrani).toBe("%40");
    const raw = JSON.parse(memory.get(UBGT_STORAGE_KEY)!) as { cases: { form: Record<string, unknown> }[] };
    delete raw.cases[0].form.hakkaniyetOrani;
    memory.set(UBGT_STORAGE_KEY, JSON.stringify(raw));
    expect(ubgtStorage.loadCasesSafe(mode).items[0]?.form.hakkaniyetOrani).toBe("1/3");
  });
});
