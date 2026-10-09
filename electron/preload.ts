import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { IPC_CHANNELS, IPC_EVENTS, type DesktopApi } from "../shared/desktop-contract";
import type { UpdateCheckSource, UpdateStatusSnapshot } from "../shared/updateTypes";

const api: DesktopApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getAppInfo),
  getLicenseStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getLicenseStatus),
  activateLicense: (payload) => ipcRenderer.invoke(IPC_CHANNELS.activateLicense, payload),
  startTrial: (payload) => ipcRenderer.invoke(IPC_CHANNELS.startTrial, payload),
  refreshLicense: () => ipcRenderer.invoke(IPC_CHANNELS.refreshLicense),
  getSubscriptionCatalog: () => ipcRenderer.invoke(IPC_CHANNELS.getSubscriptionCatalog),
  openDesktopPurchase: () => ipcRenderer.invoke(IPC_CHANNELS.openDesktopPurchase),
  openDesktopRenewal: () => ipcRenderer.invoke(IPC_CHANNELS.openDesktopRenewal),
  openDesktopContact: () => ipcRenderer.invoke(IPC_CHANNELS.openDesktopContact),
  getStorageInfo: () => ipcRenderer.invoke(IPC_CHANNELS.getStorageInfo),
  listCalculationRecords: () => ipcRenderer.invoke(IPC_CHANNELS.listCalculationRecords),
  getCalculationRecord: (id) => ipcRenderer.invoke(IPC_CHANNELS.getCalculationRecord, id),
  createCalculationRecord: (payload) => ipcRenderer.invoke(IPC_CHANNELS.createCalculationRecord, payload),
  updateCalculationRecord: (id, payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateCalculationRecord, id, payload),
  deleteCalculationRecord: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteCalculationRecord, id),
  listCalculationFolders: () => ipcRenderer.invoke(IPC_CHANNELS.listCalculationFolders),
  createCalculationFolder: (name) => ipcRenderer.invoke(IPC_CHANNELS.createCalculationFolder, name),
  renameCalculationFolder: (id, name) => ipcRenderer.invoke(IPC_CHANNELS.renameCalculationFolder, id, name),
  deleteCalculationFolder: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteCalculationFolder, id),
  moveCalculationRecordsToFolder: (recordIds, folderId) =>
    ipcRenderer.invoke(IPC_CHANNELS.moveCalculationRecordsToFolder, recordIds, folderId),
  getSetting: (key) => ipcRenderer.invoke(IPC_CHANNELS.getSetting, key),
  setSetting: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.setSetting, key, value),
  createDevSampleRecord: () => ipcRenderer.invoke(IPC_CHANNELS.createDevSampleRecord),
  calculateKidem: (payload) => ipcRenderer.invoke(IPC_CHANNELS.calculateKidem, payload),
  fetchDepositInterestRates: (payload) =>
    ipcRenderer.invoke(IPC_CHANNELS.fetchDepositInterestRates, payload),
  exportSavedCasesBackup: () => ipcRenderer.invoke(IPC_CHANNELS.exportSavedCasesBackup),
  importSavedCasesBackup: (fileBuffer) =>
    ipcRenderer.invoke(IPC_CHANNELS.importSavedCasesBackup, fileBuffer),
  getDashboardSummary: () => ipcRenderer.invoke(IPC_CHANNELS.getDashboardSummary),
  updateGetStatus: () => ipcRenderer.invoke(IPC_CHANNELS.updateGetStatus),
  updateCheck: (source?: UpdateCheckSource) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateCheck, source ?? "manual"),
  updateDownload: () => ipcRenderer.invoke(IPC_CHANNELS.updateDownload),
  updateInstall: () => ipcRenderer.invoke(IPC_CHANNELS.updateInstall),
  updateDismiss: () => ipcRenderer.invoke(IPC_CHANNELS.updateDismiss),
  onUpdateStatusChanged: (listener) => {
    const handler = (_event: IpcRendererEvent, status: UpdateStatusSnapshot) => listener(status);
    ipcRenderer.on(IPC_EVENTS.updateStatusChanged, handler);
    return () => {
      ipcRenderer.removeListener(IPC_EVENTS.updateStatusChanged, handler);
    };
  },
  getDesktopAuthView: () => ipcRenderer.invoke(IPC_CHANNELS.desktopAuthView),
  sendDesktopAuthCode: (kind) => ipcRenderer.invoke(IPC_CHANNELS.desktopAuthSendCode, kind),
  createDesktopAuthAccount: (input) => ipcRenderer.invoke(IPC_CHANNELS.desktopAuthCreateAccount, input),
  loginDesktopAuth: (input) => ipcRenderer.invoke(IPC_CHANNELS.desktopAuthLogin, input),
  logoutDesktopAuth: () => ipcRenderer.invoke(IPC_CHANNELS.desktopAuthLogout),
  startDesktopAuthReset: (username) => ipcRenderer.invoke(IPC_CHANNELS.desktopAuthForgotStart, username),
  completeDesktopAuthReset: (input) => ipcRenderer.invoke(IPC_CHANNELS.desktopAuthForgotComplete, input),
};

contextBridge.exposeInMainWorld("bilirkisiDesktop", api);
