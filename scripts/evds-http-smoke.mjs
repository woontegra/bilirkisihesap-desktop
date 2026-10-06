import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const file = path.join(root, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function toEvdsDate(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

function parseEvdsPeriod(rawDate) {
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7);
  return null;
}

loadEnv();
const apiKey = String(process.env.TCMB_EVDS_API_KEY ?? "").trim();
const seriesCode = process.env.TCMB_EVDS_HIGHEST_DEPOSIT_TRY_SERIES_CODE || "TP.TRY.MT04.S";
const responseField = process.env.TCMB_EVDS_HIGHEST_DEPOSIT_TRY_RESPONSE_FIELD || seriesCode.replaceAll(".", "_");

const startYear = 2019;
const endYear = 2025;
const periods = new Map();
const httpStatuses = [];
let fetchedCount = 0;
let sampleKeys = [];

if (!apiKey) {
  console.log(JSON.stringify({ keyPresent: false, ok: false, message: "no-key" }));
  process.exit(1);
}

for (let year = startYear; year <= endYear; year += 1) {
  const startDate = year === 2019 ? "2019-05-11" : `${year}-01-01`;
  const endDate = year === 2025 ? "2025-08-12" : `${year}-12-31`;
  const params = new URLSearchParams({
    series: seriesCode,
    startDate: toEvdsDate(startDate),
    endDate: toEvdsDate(endDate),
    type: "json",
    formulas: "0",
  });
  const url = `https://evds3.tcmb.gov.tr/igmevdsms-dis/${params.toString()}`;
  const response = await fetch(url, {
    headers: { key: apiKey },
    signal: AbortSignal.timeout(60000),
  });
  httpStatuses.push(response.status);
  const text = await response.text();
  if (!response.ok) {
    console.log(
      JSON.stringify({
        keyPresent: true,
        keyLength: apiKey.length,
        ok: false,
        httpStatuses,
        message: `EVDS HTTP ${response.status}`,
        bodyKind: text.trim().startsWith("<") ? "html" : "other",
      }),
    );
    process.exit(1);
  }
  const payload = JSON.parse(text);
  const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.Items) ? payload.Items : [];
  fetchedCount += items.length;
  if (items[0] && typeof items[0] === "object") sampleKeys = Object.keys(items[0]);
  for (const item of items) {
    const rawDate = item?.Tarih ?? item?.DATE ?? item?.date;
    const rawRate = item?.[responseField] ?? item?.value ?? item?.VALUE;
    const period = parseEvdsPeriod(rawDate);
    const rate = Number(String(rawRate ?? "").replace(",", "."));
    if (!period || !Number.isFinite(rate)) continue;
    if (!periods.has(period)) periods.set(period, rate);
  }
}

const keys = [...periods.keys()].sort();
console.log(
  JSON.stringify({
    keyPresent: true,
    keyLength: apiKey.length,
    ok: keys.length > 0,
    seriesCode,
    httpStatuses,
    fetchedCount,
    parsedPeriodCount: keys.length,
    firstPeriod: keys[0] ?? null,
    lastPeriod: keys[keys.length - 1] ?? null,
    sampleKeys,
    headerName: "key",
  }),
);
