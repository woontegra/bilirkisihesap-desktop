import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type BetterSqlite3 from "better-sqlite3";
import { getDatabasePath } from "../paths";
import { getAppliedSchemaVersion, runMigrations } from "./migrations";

const require = createRequire(fileURLToPath(import.meta.url));
const Sqlite = require("better-sqlite3") as typeof BetterSqlite3;

let connection: BetterSqlite3.Database | null = null;

export function openDatabase(): BetterSqlite3.Database {
  if (connection) {
    return connection;
  }

  const databasePath = getDatabasePath();
  const directory = path.dirname(databasePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  const db = new Sqlite(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  runMigrations(db);
  connection = db;
  return db;
}

export function getDatabase(): BetterSqlite3.Database {
  if (!connection) {
    return openDatabase();
  }
  return connection;
}

export function closeDatabase(): void {
  if (connection) {
    connection.close();
    connection = null;
  }
}

export function isDatabaseOpen(): boolean {
  return connection != null && connection.open;
}

export function getSchemaVersion(): number | null {
  if (!isDatabaseOpen()) {
    return null;
  }
  return getAppliedSchemaVersion(getDatabase());
}
