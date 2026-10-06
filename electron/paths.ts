import path from "node:path";
import { app } from "electron";

export function getUserDataRoot(): string {
  return app.getPath("userData");
}

export function getDatabasePath(): string {
  return path.join(getUserDataRoot(), "data", "bilirkisi.sqlite");
}

export function getPlannedDatabasePath(): string {
  return getDatabasePath();
}

export function getBackupsPath(): string {
  return path.join(getUserDataRoot(), "backups");
}

export function getLogsPath(): string {
  return app.getPath("logs");
}
