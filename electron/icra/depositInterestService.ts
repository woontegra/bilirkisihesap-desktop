import { AppError } from "../db/errors";
import { getDatabase } from "../db/database";
import {
  buildMonthList,
  buildRatePeriods,
  isIsoDate,
  monthEnd,
  monthKey,
  monthStart,
  type CachedDepositMonth,
  type DepositInterestPeriod,
} from "./depositInterestPeriods";
import { fetchEvdsSeriesData, getDepositSeriesConfig } from "./tcmbEvds";

const SOURCE = "TCMB_EVDS";
const CURRENCY = "TRY";
const MATURITY = "ONE_YEAR_OR_LESS";

export type DepositInterestRatesResult = {
  periods: DepositInterestPeriod[];
};

function loadCachedMonths(periods: string[]): Map<string, CachedDepositMonth> {
  if (periods.length === 0) return new Map();
  const placeholders = periods.map(() => "?").join(", ");
  const rows = getDatabase()
    .prepare(
      `SELECT period, start_date, end_date, rate
       FROM deposit_interest_rates
       WHERE source = ? AND currency = ? AND maturity = ? AND period IN (${placeholders})
       ORDER BY period ASC`,
    )
    .all(SOURCE, CURRENCY, MATURITY, ...periods) as Array<{
    period: string;
    start_date: string;
    end_date: string;
    rate: number;
  }>;
  const map = new Map<string, CachedDepositMonth>();
  for (const row of rows) {
    map.set(row.period, {
      period: row.period,
      startDate: row.start_date,
      endDate: row.end_date,
      rate: Number(row.rate),
    });
  }
  return map;
}

function upsertMonths(rows: CachedDepositMonth[]): void {
  const stmt = getDatabase().prepare(
    `INSERT INTO deposit_interest_rates
      (period, start_date, end_date, rate, source, currency, maturity, updated_at)
     VALUES (@period, @startDate, @endDate, @rate, @source, @currency, @maturity, @updatedAt)
     ON CONFLICT(period) DO UPDATE SET
       start_date = excluded.start_date,
       end_date = excluded.end_date,
       rate = excluded.rate,
       updated_at = excluded.updated_at`,
  );
  const now = new Date().toISOString();
  const tx = getDatabase().transaction((items: CachedDepositMonth[]) => {
    for (const item of items) {
      stmt.run({
        period: item.period,
        startDate: item.startDate,
        endDate: item.endDate,
        rate: item.rate,
        source: SOURCE,
        currency: CURRENCY,
        maturity: MATURITY,
        updatedAt: now,
      });
    }
  });
  tx(rows);
}

async function syncFromEvds(startDate: string, endDate: string): Promise<void> {
  const { seriesCode, responseField, apiKey } = getDepositSeriesConfig();
  if (!apiKey) {
    throw new AppError("TCMB EVDS API anahtarı veya mevduat faiz seri kodu tanımlı değil.");
  }

  const windows: Array<{ startDate: string; endDate: string }> = [];
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  for (let year = startYear; year <= endYear; year += 1) {
    const windowStart = year === startYear ? startDate : `${year}-01-01`;
    const windowEnd = year === endYear ? endDate : `${year}-12-31`;
    if (windowStart <= windowEnd) windows.push({ startDate: windowStart, endDate: windowEnd });
  }

  const unique = new Map<string, CachedDepositMonth>();
  let fetchedCount = 0;
  for (const window of windows) {
    const chunk = await fetchEvdsSeriesData({
      apiKey,
      seriesCode,
      responseField,
      startDate: window.startDate,
      endDate: window.endDate,
    });
    fetchedCount += chunk.fetchedCount;
    for (const row of chunk.rows) {
      const period = monthKey(row.rateDate);
      if (unique.has(period)) continue;
      unique.set(period, {
        period,
        startDate: monthStart(row.rateDate),
        endDate: monthEnd(row.rateDate),
        rate: row.rate,
      });
    }
  }

  if (fetchedCount === 0 || unique.size === 0) {
    throw new AppError("TCMB EVDS’den veri çekildi ancak ilgili seride kayıt bulunamadı.");
  }
  upsertMonths([...unique.values()]);
}

export async function getDepositInterestRates(payload: unknown): Promise<DepositInterestRatesResult> {
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const startDate = record.startDate;
  const endDate = record.endDate;
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw new AppError("startDate ve endDate zorunludur.");
  }
  if (startDate > endDate) {
    throw new AppError("Faiz başlangıç tarihi, icra takip tarihinden sonra olamaz.");
  }

  const requiredMonths = buildMonthList(startDate, endDate);
  let byMonth = loadCachedMonths(requiredMonths);
  let missingMonths = requiredMonths.filter((month) => !byMonth.has(month));

  if (missingMonths.length > 0 && getDepositSeriesConfig().apiKey) {
    try {
      await syncFromEvds(startDate, endDate);
      byMonth = loadCachedMonths(requiredMonths);
      missingMonths = requiredMonths.filter((month) => !byMonth.has(month));
    } catch (error) {
      if (byMonth.size === 0) {
        throw error instanceof AppError ? error : new AppError("Mevduat faiz oranları alınamadı.");
      }
    }
  }

  if (missingMonths.length > 0) {
    throw new AppError(
      `Seçilen tarih aralığında eksik ay oran verisi var: ${missingMonths.join(", ")}. TCMB henüz bu aylar için veri yayınlamamış olabilir; eksik veriler tamamlanmadan hesaplama yapılamaz.`,
    );
  }

  const monthlyRows = requiredMonths.map((month) => byMonth.get(month)).filter((row): row is CachedDepositMonth => !!row);
  return { periods: buildRatePeriods(monthlyRows, startDate, endDate) };
}
