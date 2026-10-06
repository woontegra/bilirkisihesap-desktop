import type { DesktopStorageInfo } from "../../shared/desktop-contract";
import { getBackupsPath, getDatabasePath, getLogsPath, getUserDataRoot } from "../paths";
import { countActiveCalculationRecords } from "./calculationRecordsRepository";
import { getSchemaVersion, isDatabaseOpen } from "./database";

export function getDesktopStorageInfo(): DesktopStorageInfo {
  const databasePath = getDatabasePath();
  const connected = isDatabaseOpen();
  return {
    userDataPath: getUserDataRoot(),
    plannedDatabasePath: databasePath,
    databasePath,
    backupsPath: getBackupsPath(),
    logsPath: getLogsPath(),
    ready: connected,
    connected,
    schemaVersion: connected ? getSchemaVersion() : null,
    recordCount: connected ? countActiveCalculationRecords() : 0,
  };
}
