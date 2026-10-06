import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const { readFileSync } = require("node:fs");
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
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(0, 7) : null;
}

function monthEnd(period) {
  const [y, m] = period.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m, 0));
  return dt.toISOString().slice(0, 10);
}

loadEnv();
const apiKey = String(process.env.TCMB_EVDS_API_KEY ?? "").trim();
const seriesCode = process.env.TCMB_EVDS_HIGHEST_DEPOSIT_TRY_SERIES_CODE || "TP.TRY.MT04.S";
const responseField = process.env.TCMB_EVDS_HIGHEST_DEPOSIT_TRY_RESPONSE_FIELD || seriesCode.replaceAll(".", "_");
if (!apiKey) {
  console.log(JSON.stringify({ ok: false, message: "no-key" }));
  process.exit(1);
}

const periods = new Map();
for (let year = 2019; year <= 2025; year += 1) {
  const startDate = year === 2019 ? "2019-05-11" : `${year}-01-01`;
  const endDate = year === 2025 ? "2025-08-12" : `${year}-12-31`;
  const params = new URLSearchParams({
    series: seriesCode,
    startDate: toEvdsDate(startDate),
    endDate: toEvdsDate(endDate),
    type: "json",
    formulas: "0",
  });
  const response = await fetch(`https://evds3.tcmb.gov.tr/igmevdsms-dis/${params.toString()}`, {
    headers: { key: apiKey },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    console.log(JSON.stringify({ ok: false, httpStatus: response.status }));
    process.exit(1);
  }
  const payload = await response.json();
  const items = payload.items ?? payload.Items ?? [];
  for (const item of items) {
    const period = parseEvdsPeriod(item?.Tarih);
    const rate = Number(String(item?.[responseField] ?? "").replace(",", "."));
    if (period && Number.isFinite(rate) && !periods.has(period)) periods.set(period, rate);
  }
}

const roaming = path.join(os.homedir(), "AppData", "Roaming");
const dbPaths = [];
if (existsSync(roaming)) {
  for (const name of readdirSync(roaming)) {
    const candidate = path.join(roaming, name, "data", "bilirkisi.sqlite");
    if (existsSync(candidate)) dbPaths.push(candidate);
  }
}

const now = new Date().toISOString();
const written = [];
for (const dbPath of dbPaths) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS deposit_interest_rates (
      period TEXT PRIMARY KEY NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      rate REAL NOT NULL,
      source TEXT NOT NULL,
      currency TEXT NOT NULL,
      maturity TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const stmt = db.prepare(`
    INSERT INTO deposit_interest_rates
      (period, start_date, end_date, rate, source, currency, maturity, updated_at)
    VALUES (@period, @startDate, @endDate, @rate, 'TCMB_EVDS', 'TRY', 'ONE_YEAR_OR_LESS', @updatedAt)
    ON CONFLICT(period) DO UPDATE SET
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      rate = excluded.rate,
      updated_at = excluded.updated_at
  `);
  const tx = db.transaction(() => {
    for (const [period, rate] of periods) {
      stmt.run({
        period,
        startDate: `${period}-01`,
        endDate: monthEnd(period),
        rate,
        updatedAt: now,
      });
    }
  });
  tx();
  const count = db.prepare("SELECT COUNT(*) AS n FROM deposit_interest_rates").get().n;
  db.close();
  written.push({ dbPath: path.basename(path.dirname(path.dirname(dbPath))), sqliteCount: count });
}

const keys = [...periods.keys()].sort();
console.log(
  JSON.stringify({
    ok: true,
    keyPresent: true,
    parsedPeriodCount: keys.length,
    firstPeriod: keys[0] ?? null,
    lastPeriod: keys[keys.length - 1] ?? null,
    databasesUpdated: written.length,
    sqliteCounts: written.map((row) => row.sqliteCount),
  }),
);
