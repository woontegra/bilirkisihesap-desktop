import { get as httpsGet } from "node:https";

export type EvdsNormalizedRow = {
  rateDate: string;
  rate: number;
};

const MONTH_NAME_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function toEvdsDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

function parseEvdsPeriod(rawDate: unknown): string | null {
  if (!rawDate || typeof rawDate !== "string") return null;
  const s = rawDate.trim();

  if (/^\d{4}-\d{1,2}$/.test(s)) {
    const [y, m] = s.split("-");
    return `${y}-${String(Number(m)).padStart(2, "0")}`;
  }
  if (/^\d{1,2}-\d{4}$/.test(s)) {
    const [m, y] = s.split("-");
    return `${y}-${String(Number(m)).padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-");
    return `${y}-${m}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [, m, y] = s.split("-");
    return `${y}-${m}`;
  }
  if (/^[A-Za-zÇĞİÖŞÜçğıöşü]+-\d{4}$/.test(s)) {
    const [rawMonth, y] = s.split("-");
    const month = MONTH_NAME_MAP[rawMonth.toLowerCase()];
    if (!month) return null;
    return `${y}-${month}`;
  }
  if (/^\d{4}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+$/.test(s)) {
    const [y, rawMonth] = s.split(/\s+/);
    const month = MONTH_NAME_MAP[rawMonth.toLowerCase()];
    if (!month) return null;
    return `${y}-${month}`;
  }
  return null;
}

function parseRateValue(rawValue: unknown): number | null {
  if (rawValue == null) return null;
  const str = String(rawValue).trim();
  if (!str) return null;
  const value = Number(str.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function requestEvds(url: string, apiKey: string): Promise<{ status: number; contentType: string; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsGet(url, { headers: { key: apiKey } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          contentType: String(res.headers["content-type"] ?? ""),
          text: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error("EVDS isteği zaman aşımına uğradı."));
    });
  });
}

export function getDepositSeriesConfig(): { seriesCode: string; responseField: string; apiKey: string } {
  const seriesCode = process.env.TCMB_EVDS_HIGHEST_DEPOSIT_TRY_SERIES_CODE || "TP.TRY.MT04.S";
  const responseField =
    process.env.TCMB_EVDS_HIGHEST_DEPOSIT_TRY_RESPONSE_FIELD || seriesCode.replaceAll(".", "_");
  const apiKey = String(process.env.TCMB_EVDS_API_KEY ?? "").trim();
  return { seriesCode, responseField, apiKey };
}

const EVDS_BASE_URL = "https://evds3.tcmb.gov.tr/igmevdsms-dis/";

export async function fetchEvdsSeriesData(input: {
  apiKey: string;
  seriesCode: string;
  responseField: string;
  startDate: string;
  endDate: string;
}): Promise<{ rows: EvdsNormalizedRow[]; fetchedCount: number; httpStatus: number; sampleKeys: string[] }> {
  const params = new URLSearchParams({
    series: input.seriesCode,
    startDate: toEvdsDate(input.startDate),
    endDate: toEvdsDate(input.endDate),
    type: "json",
    formulas: "0",
  });
  const url = `${EVDS_BASE_URL}${params.toString()}`;
  const response = await requestEvds(url, input.apiKey);
  const text = response.text;
  const contentType = response.contentType.toLowerCase();
  const httpStatus = response.status;

  if (httpStatus < 200 || httpStatus >= 300) {
    throw new Error(`EVDS isteği başarısız (${httpStatus}).`);
  }
  if (contentType.includes("text/html") || text.trim().startsWith("<!DOCTYPE")) {
    throw new Error("TCMB EVDS3 API JSON yerine HTML döndürdü. Endpoint veya header key kontrol edilmeli.");
  }
  if (!contentType.includes("application/json") && !text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    throw new Error("TCMB EVDS beklenmeyen içerik döndürdü.");
  }

  const payload = JSON.parse(text) as { items?: unknown; Items?: unknown };
  const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.Items) ? payload.Items : [];
  if (!Array.isArray(items)) {
    throw new Error("TCMB EVDS JSON döndürdü ancak items alanı bulunamadı.");
  }

  const sampleKeys =
    items[0] && typeof items[0] === "object" ? Object.keys(items[0] as Record<string, unknown>) : [];

  const rows: EvdsNormalizedRow[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const rawDate = rec.Tarih ?? rec.DATE ?? rec.date;
    const rawRate = rec[input.responseField] ?? rec.value ?? rec.VALUE;
    const period = parseEvdsPeriod(rawDate);
    const rate = parseRateValue(rawRate);
    if (!period || rate == null) continue;
    rows.push({ rateDate: `${period}-01`, rate });
  }

  return { rows, fetchedCount: items.length, httpStatus, sampleKeys };
}
