import { describe, expect, it } from "vitest";
import * as donemsel from "../donemsel/ubgtCatalog";
import * as donemselHaftalik from "../donemsel-haftalik/ubgtCatalog";
import * as gemiAdami724 from "../gemi-adami-7-24/ubgtCatalog";
import * as gemiAdamiGunluk from "../gemi-adami-gunluk/ubgtCatalog";
import * as haftalikKarma from "../haftalik-karma/ubgtCatalog";
import * as standart from "../standart/ubgtCatalog";
import * as tanikliStandart from "../tanikli-standart/ubgtCatalog";
import * as vardiya24 from "../vardiya-24/ubgtCatalog";
import * as vardiya48 from "../vardiya-48/ubgtCatalog";
import * as yeraltiIsci from "../yeralti-isci/ubgtCatalog";

const modules = {
  donemsel,
  donemselHaftalik,
  gemiAdami724,
  gemiAdamiGunluk,
  haftalikKarma,
  standart,
  tanikliStandart,
  vardiya24,
  vardiya48,
  yeraltiIsci,
};

const yearDates = (year: number) =>
  standart.getUbgtCatalogForRange(`${year}-01-01`, `${year}-12-31`).map((e) => e.date);

const byDate = (year: number) =>
  new Map(standart.getUbgtCatalogForRange(`${year}-01-01`, `${year}-12-31`).map((e) => [e.date, e]));

describe("FM UBGT kataloğu (1996–2026)", () => {
  it("10 modül aynı listeyi ve sınırları üretir", () => {
    const ref = standart.getUbgtCatalogForRange("1996-01-01", "2026-12-31");
    for (const [name, mod] of Object.entries(modules)) {
      expect(mod.UBGT_CATALOG_MIN_YEAR, name).toBe(1996);
      expect(mod.UBGT_CATALOG_MAX_YEAR, name).toBe(2026);
      expect(mod.UBGT_RELIGIOUS_DATA_MAX_YEAR, name).toBe(2026);
      expect(mod.getUbgtCatalogForRange("1996-01-01", "2026-12-31"), name).toEqual(ref);
    }
  });

  it("1996: dini bayramlar listelenir, 1 Mayıs ve 15 Temmuz yoktur", () => {
    expect(yearDates(1996)).toEqual([
      "1996-01-01",
      "1996-02-19", "1996-02-20", "1996-02-21", "1996-02-22",
      "1996-04-23",
      "1996-04-27", "1996-04-28", "1996-04-29", "1996-04-30", "1996-05-01",
      "1996-05-19", "1996-08-30", "1996-10-28", "1996-10-29",
    ]);
    expect(byDate(1996).get("1996-05-01")?.holidayId).toBe("kurban-4");
  });

  it("2005", () => {
    expect(yearDates(2005)).toEqual([
      "2005-01-01",
      "2005-01-19", "2005-01-20", "2005-01-21", "2005-01-22", "2005-01-23",
      "2005-04-23", "2005-05-19", "2005-08-30", "2005-10-28", "2005-10-29",
      "2005-11-02", "2005-11-03", "2005-11-04", "2005-11-05",
    ]);
    const m = byDate(2005);
    expect(m.get("2005-01-19")?.days).toBe(0.5);
    expect(m.get("2005-11-02")?.holidayId).toBe("ramazan-arife");
  });

  it("2006: iki Kurban Bayramı; Aralık bayramı 2007'ye taşar", () => {
    expect(yearDates(2006)).toEqual([
      "2006-01-01",
      "2006-01-09", "2006-01-10", "2006-01-11", "2006-01-12", "2006-01-13",
      "2006-04-23", "2006-05-19", "2006-08-30",
      "2006-10-22", "2006-10-23", "2006-10-24", "2006-10-25",
      "2006-10-28", "2006-10-29",
      "2006-12-30", "2006-12-31",
    ]);
  });

  it("2007: Ocak'taki Kurban günleri ve Aralık'taki ikinci Kurban listelenir", () => {
    expect(yearDates(2007)).toEqual([
      "2007-01-01", "2007-01-02", "2007-01-03",
      "2007-04-23", "2007-05-19", "2007-08-30",
      "2007-10-11", "2007-10-12", "2007-10-13", "2007-10-14",
      "2007-10-28", "2007-10-29",
      "2007-12-19", "2007-12-20", "2007-12-21", "2007-12-22", "2007-12-23",
    ]);
    const m = byDate(2007);
    expect(m.get("2007-01-01")?.label).toBe("Yılbaşı + Kurban Bayramı 2. Gün");
    expect(m.get("2007-01-01")?.days).toBe(1);
    expect(m.get("2007-01-03")?.holidayId).toBe("kurban-4");
  });

  it("2008", () => {
    expect(yearDates(2008)).toEqual([
      "2008-01-01", "2008-04-23", "2008-05-19", "2008-08-30",
      "2008-09-29", "2008-09-30", "2008-10-01", "2008-10-02",
      "2008-10-28", "2008-10-29",
      "2008-12-07", "2008-12-08", "2008-12-09", "2008-12-10", "2008-12-11",
    ]);
  });

  it("2009: 1 Mayıs ilk kez listelenir", () => {
    expect(yearDates(2009)).toEqual([
      "2009-01-01", "2009-04-23", "2009-05-01", "2009-05-19", "2009-08-30",
      "2009-09-19", "2009-09-20", "2009-09-21", "2009-09-22",
      "2009-10-28", "2009-10-29",
      "2009-11-26", "2009-11-27", "2009-11-28", "2009-11-29", "2009-11-30",
    ]);
  });

  it("2005–2009 aralığı picker'da yıl yıl gruplanır", () => {
    const groups = standart.groupUbgtCatalogByYear(standart.getUbgtCatalogForRange("2005-01-01", "2009-12-31"));
    expect(groups.map((g) => [g.year, g.entries.length])).toEqual([
      [2005, 15], [2006, 17], [2007, 17], [2008, 15], [2009, 16],
    ]);
  });

  it("mevcut 2010 verisi aynı kalır", () => {
    expect(yearDates(2010)).toEqual([
      "2010-01-01", "2010-04-23", "2010-05-01", "2010-05-19", "2010-08-30",
      "2010-09-08", "2010-09-09", "2010-09-10", "2010-09-11",
      "2010-10-28", "2010-10-29",
      "2010-11-15", "2010-11-16", "2010-11-17", "2010-11-18", "2010-11-19",
    ]);
  });

  it("2025: Ramazan arifesi 29 Mart, 1. gün 30 Mart", () => {
    expect(yearDates(2025)).toEqual([
      "2025-01-01",
      "2025-03-29", "2025-03-30", "2025-03-31", "2025-04-01",
      "2025-04-23", "2025-05-01", "2025-05-19",
      "2025-06-05", "2025-06-06", "2025-06-07", "2025-06-08", "2025-06-09",
      "2025-07-15", "2025-08-30", "2025-10-28", "2025-10-29",
    ]);
    const m = byDate(2025);
    expect(m.get("2025-03-29")?.holidayId).toBe("ramazan-arife");
    expect(m.get("2025-03-29")?.days).toBe(0.5);
    expect(m.get("2025-03-30")?.holidayId).toBe("ramazan-1");
    expect(m.get("2025-03-30")?.days).toBe(1);
  });

  it("2026: dini bayramlar dahil", () => {
    expect(yearDates(2026)).toEqual([
      "2026-01-01",
      "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22",
      "2026-04-23", "2026-05-01", "2026-05-19",
      "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30",
      "2026-07-15", "2026-08-30", "2026-10-28", "2026-10-29",
    ]);
  });

  it("aralık sınırları, tarih başına tek satır ve 31 yıl", () => {
    expect(standart.getUbgtCatalogForRange("2006-12-31", "2007-01-02").map((e) => e.date)).toEqual([
      "2006-12-31", "2007-01-01", "2007-01-02",
    ]);
    expect(standart.getUbgtCatalogForRange("1990-01-01", "1995-12-31")).toEqual([]);
    const all = standart.getUbgtCatalogForRange("1996-01-01", "2026-12-31").map((e) => e.date);
    expect(new Set(all).size).toBe(all.length);
    expect(standart.groupUbgtCatalogByYear(standart.getUbgtCatalogForRange("1996-01-01", "2026-12-31")).map((g) => g.year))
      .toEqual(Array.from({ length: 31 }, (_, i) => 1996 + i));
  });
});
