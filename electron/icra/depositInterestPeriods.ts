export type CachedDepositMonth = {
  period: string;
  startDate: string;
  endDate: string;
  rate: number;
};

export type DepositInterestPeriod = {
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  source: "TCMB_EVDS";
  currency: "TRY";
  maturity: "ONE_YEAR_OR_LESS";
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function addMonths(isoDate: string, count: number): string {
  const [year, month] = isoDate.split("-").map((v) => Number(v));
  const dt = new Date(Date.UTC(year, month - 1 + count, 1));
  return dt.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, count: number): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + count);
  return dt.toISOString().slice(0, 10);
}

export function monthEnd(isoDate: string): string {
  return addDays(addMonths(monthStart(isoDate), 1), -1);
}

export function diffDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

export function buildMonthList(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  let cursor = monthStart(startDate);
  const endMonth = monthStart(endDate);
  while (cursor <= endMonth) {
    months.push(monthKey(cursor));
    cursor = addMonths(cursor, 1);
  }
  return months;
}

export function buildRatePeriods(
  monthlyRows: CachedDepositMonth[],
  startDate: string,
  endDate: string,
): DepositInterestPeriod[] {
  const periods: DepositInterestPeriod[] = [];
  const sorted = [...monthlyRows].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const endExclusive = addDays(endDate, 1);

  for (const row of sorted) {
    const rawStart = row.startDate;
    const rawEndExclusive = addDays(row.endDate, 1);
    const overlapStart = rawStart > startDate ? rawStart : startDate;
    const overlapEndExclusive = rawEndExclusive < endExclusive ? rawEndExclusive : endExclusive;
    if (overlapStart >= overlapEndExclusive) continue;
    periods.push({
      startDate: overlapStart,
      endDate: addDays(overlapEndExclusive, -1),
      days: diffDays(overlapStart, overlapEndExclusive),
      rate: row.rate,
      source: "TCMB_EVDS",
      currency: "TRY",
      maturity: "ONE_YEAR_OR_LESS",
    });
  }

  return periods;
}
