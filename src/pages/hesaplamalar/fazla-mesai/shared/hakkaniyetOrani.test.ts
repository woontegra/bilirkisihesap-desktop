import { describe, expect, it } from "vitest";
import {
  HAKKANIYET_ORANLARI,
  VARSAYILAN_HAKKANIYET_ORANI,
  hakkaniyetOraniEtiketi,
  hesaplaHakkaniyetIndirimi,
  normalizeHakkaniyetOrani,
  type HakkaniyetOrani,
} from "./hakkaniyetOrani";
import { computeStandartFmResultV3 } from "../standart/v3-engine/adapter";
import { createEmptyForm as emptyStandart } from "../standart/model";
import { buildStandartSaveData, mapStandartFormFromBackend } from "../standart/backendCase";
import { computeTanikliFmResultV3 } from "../tanikli-standart/v3-engine/adapter";
import { createEmptyForm as emptyTanikli } from "../tanikli-standart/model";
import { buildTanikliSaveData, mapTanikliFormFromBackend } from "../tanikli-standart/backendCase";
import { computeHaftalikKarmaResultV3 } from "../haftalik-karma/v3-engine/adapter";
import { createEmptyHaftalikKarmaForm } from "../haftalik-karma/model";
import { buildHaftalikKarmaSaveData, mapHaftalikKarmaFormFromBackend } from "../haftalik-karma/backendCase";
import { computeDonemselResultV3 } from "../donemsel/v3-engine/adapter";
import { createEmptyDonemselForm } from "../donemsel/model";
import { buildDonemselSaveData, mapDonemselFormFromBackend } from "../donemsel/backendCase";
import { computeDonemselHaftalikResultV3 } from "../donemsel-haftalik/v3-engine/adapter";
import { createEmptyDonemselHaftalikForm } from "../donemsel-haftalik/model";
import { buildDonemselHaftalikSaveData, mapDonemselHaftalikFormFromBackend } from "../donemsel-haftalik/backendCase";
import { computeYeraltiResultV3 } from "../yeralti-isci/v3-engine/adapter";
import { createEmptyForm as emptyYeralti } from "../yeralti-isci/model";
import { buildYeraltiSaveData, mapYeraltiFormFromBackend } from "../yeralti-isci/backendCase";
import { computeVardiya24Result } from "../vardiya-24/engine";
import { createEmptyForm as emptyVardiya24 } from "../vardiya-24/model";
import { buildVardiya24SaveData, mapVardiya24FormFromBackend } from "../vardiya-24/backendCase";
import { computeVardiya48Result } from "../vardiya-48/engine";
import { createEmptyForm as emptyVardiya48 } from "../vardiya-48/model";
import { buildVardiya48SaveData, mapVardiya48FormFromBackend } from "../vardiya-48/backendCase";
import { computeGemiGunlukResult } from "../gemi-adami-gunluk/engine";
import { createEmptyForm as emptyGemiGunluk } from "../gemi-adami-gunluk/model";
import { buildGemiGunlukSaveData, mapGemiGunlukFormFromBackend } from "../gemi-adami-gunluk/backendCase";
import { computeGemi724Result } from "../gemi-adami-7-24/engine";
import { createEmptyForm as emptyGemi724 } from "../gemi-adami-7-24/model";
import { buildGemi724SaveData, mapGemi724FormFromBackend } from "../gemi-adami-7-24/backendCase";

type AnyForm = Record<string, unknown>;
type AnyResult = Record<string, unknown>;

type FmModule = {
  name: string;
  /** Hakkaniyet tutarı round2 ile yuvarlanan modüller. */
  rounded: boolean;
  totalField: "toplamFm" | "totalFm";
  hakkaniyetField: "hakkaniyetIndirimi" | "hakkaniyetOneri";
  netField: "sonNet" | "mahsupSonrasiNet";
  mahsupField: "mahsup" | "mahsuplasmaMiktari";
  compute: (form: AnyForm) => AnyResult;
  buildForm: () => AnyForm;
  buildSaveData: (form: AnyForm, result: AnyResult) => unknown;
  mapFromBackend: (data: unknown) => AnyForm | null;
};

const ISE_GIRIS = "2019-01-01";
const ISTEN_CIKIS = "2021-12-31";
const YUZDE: Record<HakkaniyetOrani, number | null> = {
  "1/3": null,
  "%20": 20,
  "%25": 25,
  "%30": 30,
  "%35": 35,
  "%40": 40,
  "%45": 45,
};
const round2 = (n: number) => Math.round(n * 100) / 100;

function saveSummary(m: Pick<FmModule, "totalField" | "netField">, r: AnyResult) {
  return {
    toplamFm: Number(r[m.totalField]) || 0,
    sonNet: Number(r[m.netField]) || 0,
    rowCount: Array.isArray(r.rows) ? r.rows.length : 0,
  };
}

const FM_MODULES: FmModule[] = [
  {
    name: "Standart",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetIndirimi",
    netField: "sonNet",
    mahsupField: "mahsup",
    compute: (f) => computeStandartFmResultV3(f as never) as unknown as AnyResult,
    buildForm: () => ({ ...emptyStandart(), iseGiris: ISE_GIRIS, istenCikis: ISTEN_CIKIS, davaciIn: "08:00", davaciOut: "20:00", weeklyDays: 6 }),
    buildSaveData: (f, r) => buildStandartSaveData(f as never, r as never),
    mapFromBackend: (d) => mapStandartFormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Tanıklı Standart",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetOneri",
    netField: "mahsupSonrasiNet",
    mahsupField: "mahsup",
    compute: (f) => computeTanikliFmResultV3(f as never) as unknown as AnyResult,
    buildForm: () => ({
      ...emptyTanikli(),
      iseGiris: ISE_GIRIS,
      istenCikis: ISTEN_CIKIS,
      davaciIn: "08:00",
      davaciOut: "20:00",
      weeklyDays: 6,
      taniklar: [{ id: "t1", name: "Tanık 1", dateIn: ISE_GIRIS, dateOut: ISTEN_CIKIS, in: "08:00", out: "20:00" }],
    }),
    buildSaveData: (f, r) => buildTanikliSaveData(f as never, saveSummary({ totalField: "toplamFm", netField: "mahsupSonrasiNet" }, r)),
    mapFromBackend: (d) => mapTanikliFormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Haftalık Karma",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetOneri",
    netField: "mahsupSonrasiNet",
    mahsupField: "mahsup",
    compute: (f) => computeHaftalikKarmaResultV3(f as never) as unknown as AnyResult,
    buildForm: () => ({
      ...createEmptyHaftalikKarmaForm(),
      iseGiris: ISE_GIRIS,
      istenCikis: ISTEN_CIKIS,
      dayGroups: [
        { id: "g1", dayCount: "3", startTime: "08:00", endTime: "20:00" },
        { id: "g2", dayCount: "3", startTime: "08:00", endTime: "19:00" },
      ],
    }),
    buildSaveData: (f, r) =>
      buildHaftalikKarmaSaveData(f as never, saveSummary({ totalField: "toplamFm", netField: "mahsupSonrasiNet" }, r)),
    mapFromBackend: (d) => mapHaftalikKarmaFormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Dönemsel",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetOneri",
    netField: "mahsupSonrasiNet",
    mahsupField: "mahsup",
    compute: (f) => computeDonemselResultV3(f as never) as unknown as AnyResult,
    buildForm: () => {
      const empty = createEmptyDonemselForm();
      return {
        ...empty,
        dateIn: ISE_GIRIS,
        dateOut: ISTEN_CIKIS,
        summerPattern: { ...empty.summerPattern, startTime: "08:00", endTime: "21:00" },
        winterPattern: { ...empty.winterPattern, startTime: "08:00", endTime: "19:00" },
      };
    },
    buildSaveData: (f, r) => buildDonemselSaveData(f as never, saveSummary({ totalField: "toplamFm", netField: "mahsupSonrasiNet" }, r)),
    mapFromBackend: (d) => mapDonemselFormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Dönemsel Haftalık",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetOneri",
    netField: "mahsupSonrasiNet",
    mahsupField: "mahsup",
    compute: (f) => computeDonemselHaftalikResultV3(f as never) as unknown as AnyResult,
    buildForm: () => {
      const empty = createEmptyDonemselHaftalikForm();
      return {
        ...empty,
        dateIn: ISE_GIRIS,
        dateOut: ISTEN_CIKIS,
        summerPattern: { ...empty.summerPattern, days1: "6", startTime: "08:00", endTime: "21:00" },
        winterPattern: { ...empty.winterPattern, days1: "6", startTime: "08:00", endTime: "19:00" },
      };
    },
    buildSaveData: (f, r) =>
      buildDonemselHaftalikSaveData(f as never, saveSummary({ totalField: "toplamFm", netField: "mahsupSonrasiNet" }, r)),
    mapFromBackend: (d) => mapDonemselHaftalikFormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Yeraltı İşçisi",
    rounded: true,
    totalField: "totalFm",
    hakkaniyetField: "hakkaniyetIndirimi",
    netField: "sonNet",
    mahsupField: "mahsup",
    compute: (f) => computeYeraltiResultV3(f as never) as unknown as AnyResult,
    buildForm: () => ({ ...emptyYeralti(), davaciDateIn: ISE_GIRIS, davaciDateOut: ISTEN_CIKIS, davaciIn: "08:00", davaciOut: "18:00", weeklyDays: 6 }),
    buildSaveData: (f, r) => buildYeraltiSaveData(f as never, saveSummary({ totalField: "totalFm", netField: "sonNet" }, r)),
    mapFromBackend: (d) => mapYeraltiFormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Vardiya 24",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetIndirimi",
    netField: "sonNet",
    mahsupField: "mahsup",
    compute: (f) => computeVardiya24Result(f as never) as unknown as AnyResult,
    buildForm: () => ({ ...emptyVardiya24(), iseGiris: ISE_GIRIS, istenCikis: ISTEN_CIKIS }),
    buildSaveData: (f, r) => buildVardiya24SaveData(f as never, saveSummary({ totalField: "toplamFm", netField: "sonNet" }, r)),
    mapFromBackend: (d) => mapVardiya24FormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Vardiya 48",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetIndirimi",
    netField: "sonNet",
    mahsupField: "mahsuplasmaMiktari",
    compute: (f) => computeVardiya48Result(f as never) as unknown as AnyResult,
    buildForm: () => ({ ...emptyVardiya48(), iseGiris: ISE_GIRIS, istenCikis: ISTEN_CIKIS }),
    buildSaveData: (f, r) => buildVardiya48SaveData(f as never, saveSummary({ totalField: "toplamFm", netField: "sonNet" }, r)),
    mapFromBackend: (d) => mapVardiya48FormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Gemi Adamı Günlük",
    rounded: false,
    totalField: "toplamFm",
    hakkaniyetField: "hakkaniyetIndirimi",
    netField: "sonNet",
    mahsupField: "mahsup",
    compute: (f) => computeGemiGunlukResult(f as never) as unknown as AnyResult,
    buildForm: () => ({ ...emptyGemiGunluk(), iseGiris: ISE_GIRIS, istenCikis: ISTEN_CIKIS, davaciIn: "07:00", davaciOut: "20:00", weeklyDays: 6 }),
    buildSaveData: (f, r) => buildGemiGunlukSaveData(f as never, saveSummary({ totalField: "toplamFm", netField: "sonNet" }, r)),
    mapFromBackend: (d) => mapGemiGunlukFormFromBackend(d) as unknown as AnyForm | null,
  },
  {
    name: "Gemi Adamı 7/24",
    rounded: true,
    totalField: "totalFm",
    hakkaniyetField: "hakkaniyetIndirimi",
    netField: "sonNet",
    mahsupField: "mahsup",
    compute: (f) => computeGemi724Result(f as never) as unknown as AnyResult,
    buildForm: () => ({ ...emptyGemi724(), iseGiris: ISE_GIRIS, istenCikis: ISTEN_CIKIS }),
    buildSaveData: (f, r) => buildGemi724SaveData(f as never, saveSummary({ totalField: "totalFm", netField: "sonNet" }, r)),
    mapFromBackend: (d) => mapGemi724FormFromBackend(d) as unknown as AnyForm | null,
  },
];

function withoutOran(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutOran);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k]) => k !== "hakkaniyetOrani")
      .map(([k, v]) => [k, withoutOran(v)]),
  );
}

/** Oran dışındaki sonuç alanları (toplam, brütten nete, satırlar). */
function oranDisi(m: FmModule, r: AnyResult) {
  const rows = Array.isArray(r.rows) ? (r.rows as Array<Record<string, unknown>>) : [];
  return {
    total: r[m.totalField],
    mahsupTutari: r.mahsupTutari,
    sgk: r.sgk,
    issizlik: r.issizlik,
    gelirVergisi: r.gelirVergisi,
    damgaVergisi: r.damgaVergisi,
    netYillik: r.netYillik,
    rowFm: rows.map((row) => row.fm),
  };
}

describe("hakkaniyet oranı yardımcısı", () => {
  it("V3.6 seçenekleri ve varsayılan 1/3", () => {
    expect([...HAKKANIYET_ORANLARI]).toEqual(["1/3", "%20", "%25", "%30", "%35", "%40", "%45"]);
    expect(VARSAYILAN_HAKKANIYET_ORANI).toBe("1/3");
  });

  it("geçersiz değerler 1/3 kabul edilir", () => {
    for (const bad of [undefined, null, "", 0.2, 20, "20", "%33,33", "1/4", "%50", {}]) {
      expect(normalizeHakkaniyetOrani(bad)).toBe("1/3");
    }
  });

  it("1/3 tam olarak toplam / 3, yüzdeler toplam × N / 100", () => {
    for (const total of [56652.34, 33047.189999999995, 0.01, 123456.78]) {
      expect(hesaplaHakkaniyetIndirimi(total, "1/3")).toBe(total / 3);
      expect(hesaplaHakkaniyetIndirimi(total, undefined)).toBe(total / 3);
    }
    expect(hesaplaHakkaniyetIndirimi(1000, "%20")).toBe(200);
    expect(hesaplaHakkaniyetIndirimi(1000, "%45")).toBe(450);
    expect(hakkaniyetOraniEtiketi("%30")).toBe("%30");
    expect(hakkaniyetOraniEtiketi(undefined)).toBe("1/3");
  });
});

describe.each(FM_MODULES)("$name fazla mesai", (m) => {
  const r2 = (n: number) => (m.rounded ? round2(n) : n);
  const scenario = (mahsup: string) => ({ ...m.buildForm(), [m.mahsupField]: mahsup });

  it("yeni form 1/3 ile başlar", () => {
    expect(m.buildForm().hakkaniyetOrani).toBe("1/3");
  });

  it.each(["", "5.000,50", "99999999"])("1/3 eski formülle aynı; yüzdeler yalnız hakkaniyeti değiştirir (mahsup=%s)", (mahsup) => {
    const form = scenario(mahsup);
    const base = m.compute(form);
    const total = Number(base[m.totalField]);
    const mahsupTutari = Number(base.mahsupTutari) || 0;
    expect(total).toBeGreaterThan(0);
    expect(base[m.hakkaniyetField]).toBe(r2(total / 3));
    const ozet = (r: AnyResult) => ({ ...oranDisi(m, r), hk: r[m.hakkaniyetField], net: r[m.netField] });
    expect(ozet(m.compute(withoutOran(form) as AnyForm))).toEqual(ozet(base));
    expect(ozet(m.compute({ ...form, hakkaniyetOrani: "33.33" }))).toEqual(ozet(base));

    for (const oran of HAKKANIYET_ORANLARI) {
      const yuzde = YUZDE[oran];
      if (yuzde === null) continue;
      const r = m.compute({ ...form, hakkaniyetOrani: oran });
      const hk = r2((total * yuzde) / 100);
      expect(r[m.hakkaniyetField]).toBe(hk);
      expect(r[m.netField]).toBe(Math.max(0, r2(total - hk - mahsupTutari)));
      expect(oranDisi(m, r)).toEqual(oranDisi(m, base));
    }
  });

  it.each([...HAKKANIYET_ORANLARI])("kaydet → geri yükle oranı korur (%s)", (oran) => {
    const form = { ...scenario("5.000,50"), hakkaniyetOrani: oran };
    const result = m.compute(form);
    const payload = JSON.parse(JSON.stringify(m.buildSaveData(form, result)));
    const restored = m.mapFromBackend(payload);
    expect(restored?.hakkaniyetOrani).toBe(oran);
    expect(m.compute(restored!)[m.hakkaniyetField]).toBe(result[m.hakkaniyetField]);
    expect(m.mapFromBackend(JSON.stringify({ data: payload }))?.hakkaniyetOrani).toBe(oran);
  });

  it("oran alanı olmayan eski kayıt 1/3 açılır ve tutarı değişmez", () => {
    const form = scenario("5.000,50");
    const result = m.compute(form);
    const legacy = withoutOran(JSON.parse(JSON.stringify(m.buildSaveData(form, result))));
    expect(JSON.stringify(legacy)).not.toContain("hakkaniyetOrani");
    const restored = m.mapFromBackend(legacy);
    expect(restored?.hakkaniyetOrani).toBe("1/3");
    expect(m.compute(restored!)[m.hakkaniyetField]).toBe(result[m.hakkaniyetField]);
  });
});
