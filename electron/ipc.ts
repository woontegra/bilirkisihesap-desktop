import { ipcMain, type App, type IpcMainInvokeEvent } from "electron";
import { exportSavedCasesBackup, importSavedCasesBackup } from "./backup/savedCasesBackup";
import { IPC_CHANNELS, type IpcResult, type LicenseActivatePayload, type LicenseTrialPayload } from "../shared/desktop-contract";
import {
  archiveCalculationRecord,
  createCalculationRecord,
  createDevelopmentSampleRecord,
  getCalculationRecord,
  listCalculationRecords,
  updateCalculationRecord,
} from "./db/calculationRecordsRepository";
import { AppError, toUserMessage } from "./db/errors";
import { getSetting, setSetting } from "./db/settingsRepository";
import { getDesktopStorageInfo } from "./db/storageInfo";
import type { LicenseClient } from "./license/LicenseClient";
import {
  loadDesktopSubscriptionCatalog,
  openDesktopContact,
  openDesktopFirstPurchase,
  openDesktopRenewal,
} from "./license/subscriptionCatalog";
import { calculateKidemWithLicense } from "./kidem/kidemCalculationService";
import { getDepositInterestRates } from "./icra/depositInterestService";
import { getDashboardSummary } from "./dashboard/dashboardSummary";
import { isDevelopmentRuntime } from "./runtime";
import {
  checkForUpdates,
  dismissUpdatePrompt,
  downloadUpdate,
  getUpdateStatus,
  installUpdate,
} from "./update/updateService";
import type { UpdateCheckSource } from "../shared/updateTypes";

type AppInfoInput = {
  name: string;
  version: string;
  app: App;
};

let licenseClientRef: LicenseClient;

export function registerIpcHandlers(licenseClient: LicenseClient, appInfo: AppInfoInput): void {
  licenseClientRef = licenseClient;
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.getAppInfo, async () => ({
    name: appInfo.name,
    version: appInfo.version,
    platform: process.platform,
    arch: process.arch,
    isPackaged: appInfo.app.isPackaged,
    electronVersion: process.versions.electron,
    isDevelopmentRuntime: isDevelopmentRuntime(),
  }));

  ipcMain.handle(IPC_CHANNELS.getLicenseStatus, async () => licenseClientRef.getStatus());
  ipcMain.handle(IPC_CHANNELS.activateLicense, async (_event, payload: unknown) => {
    const record = asRecord(payload);
    const body: LicenseActivatePayload = {
      licenseKey: String(record.licenseKey ?? ""),
      activationPassword: String(record.activationPassword ?? ""),
    };
    return licenseClientRef.activate(body);
  });
  ipcMain.handle(IPC_CHANNELS.startTrial, async (_event, payload: unknown) => {
    const record = asRecord(payload);
    const body: LicenseTrialPayload = { email: String(record.email ?? "") };
    return licenseClientRef.startTrial(body);
  });
  ipcMain.handle(IPC_CHANNELS.refreshLicense, async () => licenseClientRef.refresh());
  ipcMain.handle(IPC_CHANNELS.getSubscriptionCatalog, async () =>
    loadDesktopSubscriptionCatalog(licenseClientRef),
  );
  ipcMain.handle(IPC_CHANNELS.openDesktopPurchase, async () => openDesktopFirstPurchase());
  ipcMain.handle(IPC_CHANNELS.openDesktopRenewal, async () => openDesktopRenewal());
  ipcMain.handle(IPC_CHANNELS.openDesktopContact, async () => openDesktopContact());
  ipcMain.handle(IPC_CHANNELS.getStorageInfo, async () => getDesktopStorageInfo());

  ipcMain.handle(IPC_CHANNELS.listCalculationRecords, async () => wrap(() => listCalculationRecords()));
  ipcMain.handle(IPC_CHANNELS.getCalculationRecord, async (_event, id: unknown) =>
    wrap(() => getCalculationRecord(String(id))),
  );
  ipcMain.handle(IPC_CHANNELS.createCalculationRecord, async (_event, payload: unknown) =>
    wrap(async () => {
      await assertCanWrite();
      return createCalculationRecord(asRecord(payload));
    }),
  );
  ipcMain.handle(IPC_CHANNELS.updateCalculationRecord, async (_event, id: unknown, payload: unknown) =>
    wrap(async () => {
      await assertCanWrite();
      return updateCalculationRecord(String(id), asRecord(payload));
    }),
  );
  ipcMain.handle(IPC_CHANNELS.deleteCalculationRecord, async (_event, id: unknown) =>
    wrap(async () => {
      await assertCanWrite();
      return archiveCalculationRecord(String(id));
    }),
  );
  ipcMain.handle(IPC_CHANNELS.getSetting, async (_event, key: unknown) => wrap(() => getSetting(String(key))));
  ipcMain.handle(IPC_CHANNELS.setSetting, async (_event, key: unknown, value: unknown) =>
    wrap(async () => {
      await assertCanWrite();
      return setSetting(String(key), String(value));
    }),
  );
  ipcMain.handle(IPC_CHANNELS.createDevSampleRecord, async () =>
    wrap(async () => {
      if (!isDevelopmentRuntime()) {
        throw new AppError("Bu işlem yalnızca geliştirme ortamında kullanılabilir.");
      }
      await assertCanWrite();
      return createDevelopmentSampleRecord();
    }),
  );
  ipcMain.handle(IPC_CHANNELS.calculateKidem, async (_event, payload: unknown) =>
    wrap(async () => {
      const status = await licenseClientRef.getStatus();
      return calculateKidemWithLicense(payload, status);
    }),
  );
  ipcMain.handle(IPC_CHANNELS.fetchDepositInterestRates, async (_event, payload: unknown) =>
    wrap(async () => {
      const record = asRecord(payload);
      return getDepositInterestRates({
        startDate: record.startDate,
        endDate: record.endDate,
      });
    }),
  );
  ipcMain.handle(IPC_CHANNELS.exportSavedCasesBackup, async (event: IpcMainInvokeEvent) =>
    wrap(() => exportSavedCasesBackup(event.sender)),
  );
  ipcMain.handle(IPC_CHANNELS.importSavedCasesBackup, async (event: IpcMainInvokeEvent, fileBuffer: unknown) =>
    wrap(async () => {
      await assertCanWrite();
      return importSavedCasesBackup(event.sender, toArrayBuffer(fileBuffer));
    }),
  );
  ipcMain.handle(IPC_CHANNELS.getDashboardSummary, async () =>
    wrap(async () => {
      const license = await licenseClientRef.getStatus();
      return getDashboardSummary(license);
    }),
  );

  ipcMain.handle(IPC_CHANNELS.updateGetStatus, () => getUpdateStatus());
  ipcMain.handle(IPC_CHANNELS.updateCheck, (_event, source?: UpdateCheckSource) =>
    checkForUpdates(source === "auto" ? "auto" : "manual"),
  );
  ipcMain.handle(IPC_CHANNELS.updateDownload, () => downloadUpdate());
  ipcMain.handle(IPC_CHANNELS.updateInstall, () => installUpdate());
  ipcMain.handle(IPC_CHANNELS.updateDismiss, () => {
    dismissUpdatePrompt();
  });
}

async function assertCanWrite(): Promise<void> {
  const status = await licenseClientRef.getStatus();
  if (!status.canWriteRecords) {
    throw new AppError(status.message || "Geçerli lisans olmadan kayıt değiştirilemez.");
  }
}

function toArrayBuffer(value: unknown): ArrayBuffer | undefined {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
  }
  if (value && typeof value === "object" && "data" in value && Array.isArray((value as { data: unknown }).data)) {
    return Uint8Array.from((value as { data: number[] }).data).buffer;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function wrap<T>(fn: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, message: toUserMessage(error) };
  }
}
