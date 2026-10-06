/**
 * Kıdem Tazminatı (İş Kanununa Göre) — frontendV3.5 is-kanunu/engine.ts
 * bağımsız kopyası. Ağ yok; yalnızca model + tavanData + money.
 */

import type { DurationParts, ExtraItem, IsKanunuFormSnapshot, IsKanunuResult } from "./model";
import { parseMoneyInput, formatMoney, round2 } from "./money";
import { findTavanForIsoDate } from "./tavanData";

/** Damga vergisi oranı: binde 7,59 */
export const DAMGA_ORAN = 0.00759;

export { parseMoneyInput, formatMoney };

type DateParts = { y: number; m: number; d: number };

export function parseIsoDateParts(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function comparableKey(p: DateParts): number {
  return p.y * 10000 + p.m * 100 + p.d;
}

export function calcDurationParts(startIso: string, endIso: string): DurationParts | null {
  const start = parseIsoDateParts(startIso);
  const end = parseIsoDateParts(endIso);
  if (!start || !end) return null;
  if (comparableKey(end) < comparableKey(start)) return null;

  let years = end.y - start.y;
  let months = end.m - start.m;
  let days = end.d - start.d;

  if (days < 0) {
    const borrowMonthRaw = end.m - 1;
    const borrowYear = borrowMonthRaw === 0 ? end.y - 1 : end.y;
    const borrowMonth = borrowMonthRaw === 0 ? 12 : borrowMonthRaw;
    days += daysInMonth(borrowYear, borrowMonth);
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }
  return { years, months, days };
}

export function formatDurationLabel(duration: DurationParts | null): string {
  if (!duration) return "—";
  return `${duration.years} Yıl ${duration.months} Ay ${duration.days} Gün`;
}

export function validateDateRange(startIso: string, endIso: string): string | null {
  if (!startIso || !endIso) return null;
  const duration = calcDurationParts(startIso, endIso);
  if (!duration) return "İşten çıkış tarihi, işe giriş tarihinden önce olamaz.";
  return null;
}

/** Eklenti: (12 aylık toplam / 360) × 30 */
export function computeEklentiResult(months: string[]): number {
  const sum = months.reduce((acc, v) => acc + parseMoneyInput(v), 0);
  return (sum / 360) * 30;
}

type WageFields = Pick<
  IsKanunuFormSnapshot,
  "ciplakBrut" | "prim" | "ikramiye" | "yol" | "yemek" | "extras"
>;

export function computeGiydirilmisAylik(form: WageFields): number {
  const base =
    parseMoneyInput(form.ciplakBrut) +
    parseMoneyInput(form.prim) +
    parseMoneyInput(form.ikramiye) +
    parseMoneyInput(form.yol) +
    parseMoneyInput(form.yemek);
  const extrasSum = form.extras.reduce((sum: number, item: ExtraItem) => sum + parseMoneyInput(item.value), 0);
  return round2(base + extrasSum);
}

function emptyResult(): IsKanunuResult {
  return {
    duration: null,
    durationLabel: formatDurationLabel(null),
    giydirilmisAylik: 0,
    tavan: null,
    tavanApplied: false,
    esasAylik: 0,
    brutKidem: 0,
    damgaVergisi: 0,
    netKidem: 0,
    shortTenureWarning: false,
  };
}

export function computeIsKanunuResult(form: IsKanunuFormSnapshot): IsKanunuResult {
  const giydirilmisAylik = computeGiydirilmisAylik(form);
  if (!form.iseGirisTarihi && !form.istenCikisTarihi && giydirilmisAylik <= 0) {
    return emptyResult();
  }

  const duration = calcDurationParts(form.iseGirisTarihi, form.istenCikisTarihi);
  const durationLabel = formatDurationLabel(duration);
  const tavan = form.istenCikisTarihi ? findTavanForIsoDate(form.istenCikisTarihi) : null;
  const tavanApplied = tavan != null && giydirilmisAylik > tavan;
  const esasAylik = tavanApplied && tavan != null ? tavan : giydirilmisAylik;

  let brutKidem = 0;
  if (duration && esasAylik > 0) {
    brutKidem = round2(
      esasAylik * duration.years + (esasAylik / 12) * duration.months + (esasAylik / 365) * duration.days,
    );
  }

  const damgaVergisi = round2(brutKidem * DAMGA_ORAN);
  const netKidem = round2(brutKidem - damgaVergisi);
  const shortTenureWarning =
    !!duration && duration.years === 0 && duration.months * 30 + duration.days < 365;

  return {
    duration,
    durationLabel,
    giydirilmisAylik,
    tavan,
    tavanApplied,
    esasAylik,
    brutKidem,
    damgaVergisi,
    netKidem,
    shortTenureWarning,
  };
}

export function parseKidemFormPayload(payload: unknown): IsKanunuFormSnapshot {
  const record = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const extrasRaw = Array.isArray(record.extras) ? record.extras : [];
  return {
    iseGirisTarihi: String(record.iseGirisTarihi ?? ""),
    istenCikisTarihi: String(record.istenCikisTarihi ?? ""),
    ciplakBrut: String(record.ciplakBrut ?? ""),
    prim: String(record.prim ?? ""),
    ikramiye: String(record.ikramiye ?? ""),
    yol: String(record.yol ?? ""),
    yemek: String(record.yemek ?? ""),
    notes: String(record.notes ?? ""),
    extras: extrasRaw.map((item, index) => {
      const row = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      return {
        id: String(row.id ?? `ek-${index}`),
        name: String(row.name ?? ""),
        value: String(row.value ?? ""),
      };
    }),
  };
}
