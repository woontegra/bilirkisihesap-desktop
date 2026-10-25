/**
 * Standart Fazla Mesai — UBGT (Ulusal Bayram ve Genel Tatil) gün kataloğu.
 * Statik, tamamen lokal bir kopyadır (ağ isteği yoktur); tarihler resmî tatil
 * takvimiyle uyumludur. Bu dosya yalnızca bu klasöre aittir.
 *
 * Dini bayram tarihleri 1996–2026 için doğrulanmıştır (Diyanet takvimi ve
 * dönemin resmî tatil listeleri). 1 Mayıs 2009'dan, 15 Temmuz 2017'den itibaren
 * listelenir.
 */

export type UbgtCatalogEntry = {
  date: string;
  holidayId: string;
  label: string;
  /** 28 Ekim gibi yarım günlük tatillerde 0,5; diğerlerinde 1. */
  days: number;
};

type FixedHoliday = {
  id: string;
  label: string;
  days: number;
  month: number;
  day: number;
  fromYear?: number;
};

const FIXED_HOLIDAYS: FixedHoliday[] = [
  { id: "1-ocak", label: "Yılbaşı", days: 1, month: 1, day: 1 },
  { id: "23-nisan", label: "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı", days: 1, month: 4, day: 23 },
  { id: "1-mayis", label: "1 Mayıs Emek ve Dayanışma Günü", days: 1, month: 5, day: 1, fromYear: 2009 },
  { id: "19-mayis", label: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı", days: 1, month: 5, day: 19 },
  { id: "15-temmuz", label: "15 Temmuz Demokrasi ve Millî Birlik Günü", days: 1, month: 7, day: 15, fromYear: 2017 },
  { id: "30-agustos", label: "30 Ağustos Zafer Bayramı", days: 1, month: 8, day: 30 },
  { id: "28-ekim", label: "28 Ekim (yarım gün)", days: 0.5, month: 10, day: 28 },
  { id: "29-ekim", label: "29 Ekim Cumhuriyet Bayramı", days: 1, month: 10, day: 29 },
];

/** Dini bayram "arife" başlangıç tarihleri (ay-gün, o yıla ait); diğer günler buradan türetilir. */
const RELIGIOUS_ANCHORS: { year: number; ramazanArife: string; kurbanArife: string }[] = [
  { year: 2010, ramazanArife: "09-08", kurbanArife: "11-15" },
  { year: 2011, ramazanArife: "08-29", kurbanArife: "11-05" },
  { year: 2012, ramazanArife: "08-18", kurbanArife: "10-24" },
  { year: 2013, ramazanArife: "08-07", kurbanArife: "10-14" },
  { year: 2014, ramazanArife: "07-27", kurbanArife: "10-03" },
  { year: 2015, ramazanArife: "07-16", kurbanArife: "09-23" },
  { year: 2016, ramazanArife: "07-04", kurbanArife: "09-11" },
  { year: 2017, ramazanArife: "06-24", kurbanArife: "08-31" },
  { year: 2018, ramazanArife: "06-14", kurbanArife: "08-20" },
  { year: 2019, ramazanArife: "06-03", kurbanArife: "08-10" },
  { year: 2020, ramazanArife: "05-23", kurbanArife: "07-30" },
  { year: 2021, ramazanArife: "05-12", kurbanArife: "07-19" },
  { year: 2022, ramazanArife: "05-01", kurbanArife: "07-08" },
  { year: 2023, ramazanArife: "04-20", kurbanArife: "06-27" },
  { year: 2024, ramazanArife: "04-09", kurbanArife: "06-15" },
  { year: 2025, ramazanArife: "03-29", kurbanArife: "06-05" },
];

/**
 * RELIGIOUS_ANCHORS dışındaki dini bayram dönemleri (1996–2009 ve 2026); bayram günleri arifeden türetilir.
 * Dönemler yıla bağlı değildir: aynı yılda iki bayram olabilir (2000 Ramazan, 2006 Kurban) ve bayram
 * günleri yıl sınırını aşabilir (30.12.2006–03.01.2007).
 */
const EK_RELIGIOUS_PERIODS: { kind: "ramazan" | "kurban"; arife: string }[] = [
  { kind: "ramazan", arife: "1996-02-19" },
  { kind: "kurban", arife: "1996-04-27" },
  { kind: "ramazan", arife: "1997-02-08" },
  { kind: "kurban", arife: "1997-04-17" },
  { kind: "ramazan", arife: "1998-01-28" },
  { kind: "kurban", arife: "1998-04-06" },
  { kind: "ramazan", arife: "1999-01-18" },
  { kind: "kurban", arife: "1999-03-27" },
  { kind: "ramazan", arife: "2000-01-07" },
  { kind: "kurban", arife: "2000-03-15" },
  { kind: "ramazan", arife: "2000-12-26" },
  { kind: "kurban", arife: "2001-03-04" },
  { kind: "ramazan", arife: "2001-12-15" },
  { kind: "kurban", arife: "2002-02-21" },
  { kind: "ramazan", arife: "2002-12-04" },
  { kind: "kurban", arife: "2003-02-10" },
  { kind: "ramazan", arife: "2003-11-24" },
  { kind: "kurban", arife: "2004-01-31" },
  { kind: "ramazan", arife: "2004-11-13" },
  { kind: "kurban", arife: "2005-01-19" },
  { kind: "ramazan", arife: "2005-11-02" },
  { kind: "kurban", arife: "2006-01-09" },
  { kind: "ramazan", arife: "2006-10-22" },
  { kind: "kurban", arife: "2006-12-30" },
  { kind: "ramazan", arife: "2007-10-11" },
  { kind: "kurban", arife: "2007-12-19" },
  { kind: "ramazan", arife: "2008-09-29" },
  { kind: "kurban", arife: "2008-12-07" },
  { kind: "ramazan", arife: "2009-09-19" },
  { kind: "kurban", arife: "2009-11-26" },
  { kind: "ramazan", arife: "2026-03-19" },
  { kind: "kurban", arife: "2026-05-26" },
];

function addIsoDays(iso: string, amount: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + amount);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function buildReligiousEntriesForYear(year: number): UbgtCatalogEntry[] {
  const anchor = RELIGIOUS_ANCHORS.find((a) => a.year === year);
  if (!anchor) return [];
  const ramazanArife = `${year}-${anchor.ramazanArife}`;
  const kurbanArife = `${year}-${anchor.kurbanArife}`;
  return [
    { date: ramazanArife, holidayId: "ramazan-arife", label: "Ramazan Bayramı Arife", days: 0.5 },
    { date: addIsoDays(ramazanArife, 1), holidayId: "ramazan-1", label: "Ramazan Bayramı 1. Gün", days: 1 },
    { date: addIsoDays(ramazanArife, 2), holidayId: "ramazan-2", label: "Ramazan Bayramı 2. Gün", days: 1 },
    { date: addIsoDays(ramazanArife, 3), holidayId: "ramazan-3", label: "Ramazan Bayramı 3. Gün", days: 1 },
    { date: kurbanArife, holidayId: "kurban-arife", label: "Kurban Bayramı Arife", days: 0.5 },
    { date: addIsoDays(kurbanArife, 1), holidayId: "kurban-1", label: "Kurban Bayramı 1. Gün", days: 1 },
    { date: addIsoDays(kurbanArife, 2), holidayId: "kurban-2", label: "Kurban Bayramı 2. Gün", days: 1 },
    { date: addIsoDays(kurbanArife, 3), holidayId: "kurban-3", label: "Kurban Bayramı 3. Gün", days: 1 },
    { date: addIsoDays(kurbanArife, 4), holidayId: "kurban-4", label: "Kurban Bayramı 4. Gün", days: 1 },
  ];
}

function buildReligiousEntriesForPeriod(period: { kind: "ramazan" | "kurban"; arife: string }): UbgtCatalogEntry[] {
  const { arife } = period;
  if (period.kind === "ramazan") {
    return [
      { date: arife, holidayId: "ramazan-arife", label: "Ramazan Bayramı Arife", days: 0.5 },
      { date: addIsoDays(arife, 1), holidayId: "ramazan-1", label: "Ramazan Bayramı 1. Gün", days: 1 },
      { date: addIsoDays(arife, 2), holidayId: "ramazan-2", label: "Ramazan Bayramı 2. Gün", days: 1 },
      { date: addIsoDays(arife, 3), holidayId: "ramazan-3", label: "Ramazan Bayramı 3. Gün", days: 1 },
    ];
  }
  return [
    { date: arife, holidayId: "kurban-arife", label: "Kurban Bayramı Arife", days: 0.5 },
    { date: addIsoDays(arife, 1), holidayId: "kurban-1", label: "Kurban Bayramı 1. Gün", days: 1 },
    { date: addIsoDays(arife, 2), holidayId: "kurban-2", label: "Kurban Bayramı 2. Gün", days: 1 },
    { date: addIsoDays(arife, 3), holidayId: "kurban-3", label: "Kurban Bayramı 3. Gün", days: 1 },
    { date: addIsoDays(arife, 4), holidayId: "kurban-4", label: "Kurban Bayramı 4. Gün", days: 1 },
  ];
}

export const UBGT_CATALOG_MIN_YEAR = 1996;
export const UBGT_CATALOG_MAX_YEAR = 2026;
/** Dini bayram tarihleri bu yıldan sonrası için katalogda henüz mevcut değil. */
export const UBGT_RELIGIOUS_DATA_MAX_YEAR = 2026;

/** [startISO, endISO] aralığındaki tüm UBGT günlerini (sabit + dini) döner, tarih sırasıyla. */
export function getUbgtCatalogForRange(startISO: string, endISO: string): UbgtCatalogEntry[] {
  const s = String(startISO ?? "").slice(0, 10);
  const e = String(endISO ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e) || s > e) return [];

  const startYear = Math.max(UBGT_CATALOG_MIN_YEAR, Number(s.slice(0, 4)));
  const endYear = Math.min(UBGT_CATALOG_MAX_YEAR, Number(e.slice(0, 4)));
  const out: UbgtCatalogEntry[] = [];

  for (let year = startYear; year <= endYear; year++) {
    for (const h of FIXED_HOLIDAYS) {
      if (h.fromYear && year < h.fromYear) continue;
      const iso = `${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`;
      if (iso >= s && iso <= e) out.push({ date: iso, holidayId: h.id, label: h.label, days: h.days });
    }
    if (year <= UBGT_RELIGIOUS_DATA_MAX_YEAR) {
      for (const entry of buildReligiousEntriesForYear(year)) {
        if (entry.date >= s && entry.date <= e) out.push(entry);
      }
    }
  }
  for (const period of EK_RELIGIOUS_PERIODS) {
    for (const entry of buildReligiousEntriesForPeriod(period)) {
      if (entry.date >= s && entry.date <= e) out.push(entry);
    }
  }

  out.sort((a, b) => a.date.localeCompare(b.date));

  // Picker seçimi tarihe göre tutulur; aynı güne denk gelen tatiller (ör. 01.01.2007
  // Yılbaşı + Kurban 2. Gün) tek satırda birleştirilir.
  const merged: UbgtCatalogEntry[] = [];
  for (const entry of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.date === entry.date) {
      merged[merged.length - 1] = {
        ...prev,
        label: `${prev.label} + ${entry.label}`,
        days: Math.max(prev.days, entry.days),
      };
    } else {
      merged.push(entry);
    }
  }
  return merged;
}

export type UbgtYearGroup = { year: number; entries: UbgtCatalogEntry[] };

/** Katalog girdilerini yıla göre gruplar (picker'da yıl başlıklı bölümler için). */
export function groupUbgtCatalogByYear(entries: UbgtCatalogEntry[]): UbgtYearGroup[] {
  const byYear = new Map<number, UbgtCatalogEntry[]>();
  for (const entry of entries) {
    const year = Number(entry.date.slice(0, 4));
    const list = byYear.get(year);
    if (list) list.push(entry);
    else byYear.set(year, [entry]);
  }
  return Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => ({ year, entries: list }));
}
