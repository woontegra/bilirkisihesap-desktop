import type { UpdateActionResult, UpdateCheckSource, UpdateStatusSnapshot } from "./updateTypes";

export const IPC_CHANNELS = {
  getAppInfo: "desktop:get-app-info",
  getLicenseStatus: "desktop:get-license-status",
  getStorageInfo: "desktop:get-storage-info",
  listCalculationRecords: "desktop:list-calculation-records",
  getCalculationRecord: "desktop:get-calculation-record",
  createCalculationRecord: "desktop:create-calculation-record",
  updateCalculationRecord: "desktop:update-calculation-record",
  deleteCalculationRecord: "desktop:delete-calculation-record",
  getSetting: "desktop:get-setting",
  setSetting: "desktop:set-setting",
  createDevSampleRecord: "desktop:create-dev-sample-record",
  activateLicense: "desktop:activate-license",
  startTrial: "desktop:start-trial",
  refreshLicense: "desktop:refresh-license",
  calculateKidem: "desktop:calculate-kidem",
  fetchDepositInterestRates: "desktop:fetch-deposit-interest-rates",
  exportSavedCasesBackup: "desktop:export-saved-cases-backup",
  importSavedCasesBackup: "desktop:import-saved-cases-backup",
  getDashboardSummary: "desktop:get-dashboard-summary",
  updateGetStatus: "desktop:update-get-status",
  updateCheck: "desktop:update-check",
  updateDownload: "desktop:update-download",
  updateInstall: "desktop:update-install",
  updateDismiss: "desktop:update-dismiss",
} as const;

export const IPC_EVENTS = {
  updateStatusChanged: "desktop:update-status-changed",
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
export type IpcEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

export const CALCULATION_TYPES = [
  "kidem-tazminati",
  "kidem-is-kanunu",
  "kidem-borclar",
  "kidem-gemi",
  "kidem-mevsimlik",
  "kidem-basin",
  "kidem-kismi",
  "kidem-belirli-sureli",
  "ihbar-tazminati",
  "fazla-mesai",
  "yillik-izin",
  "ubgt",
  "hafta-tatili",
] as const;

export type CalculationType = string;

export const CALCULATION_TYPE_LABELS: Record<string, string> = {
  "kidem-tazminati": "Kıdem – İş Kanununa Göre",
  "kidem-is-kanunu": "Kıdem – İş Kanununa Göre",
  "kidem-borclar": "Kıdem – Borçlar Kanunu İşçi Alacağı",
  "kidem-gemi": "Kıdem – Gemi Adamları",
  "kidem-mevsimlik": "Kıdem – Mevsimlik İşçi",
  "kidem-basin": "Kıdem – Basın İş",
  "kidem-kismi": "Kıdem – Kısmi Süreli / Part Time",
  "kidem-belirli-sureli": "Kıdem – Belirli Süreli İş Sözleşmesi",
  "ihbar-tazminati": "İhbar Tazminatı",
  "fazla-mesai": "Fazla Mesai",
  "yillik-izin": "Yıllık İzin",
  ubgt: "UBGT",
  "hafta-tatili": "Hafta Tatili",
};

export type DesktopAppInfo = {
  name: string;
  version: string;
  platform:
    | "win32"
    | "darwin"
    | "linux"
    | "aix"
    | "android"
    | "freebsd"
    | "haiku"
    | "openbsd"
    | "sunos"
    | "cygwin"
    | "netbsd";
  arch: string;
  isPackaged: boolean;
  electronVersion: string;
  isDevelopmentRuntime: boolean;
};

export type DesktopStorageInfo = {
  userDataPath: string;
  plannedDatabasePath: string;
  databasePath: string;
  backupsPath: string;
  logsPath: string;
  ready: boolean;
  connected: boolean;
  schemaVersion: number | null;
  recordCount: number;
};

export const LICENSE_APP_CODE = "BILIRKISI_DESKTOP";

export const LICENSE_PRODUCT_NAME = "Bilirkişi Hesap Masaüstü";

export type LicenseSource = "mock" | "unconfigured" | "central";

export type LicenseState =
  | "active"
  | "inactive"
  | "unknown"
  | "expired"
  | "revoked"
  | "device_limit"
  | "invalid_product"
  | "unreachable"
  | "offline_expired"
  | "clock_anomaly"
  | "pending";

export type DesktopLicenseStatus = {
  source: LicenseSource;
  state: LicenseState;
  isMock: boolean;
  planLabel: string;
  productCode: string | null;
  expiresAt: string | null;
  lastCheckedAt: string | null;
  lastSuccessfulValidationAt: string | null;
  offlineGraceUntil: string | null;
  isOfflineGrace: boolean;
  maxDevices: number | null;
  maskedLicenseKey: string | null;
  canWriteRecords: boolean;
  canReadRecords: boolean;
  message: string;
};

export type LicenseActivatePayload = {
  licenseKey: string;
  activationPassword: string;
};

export type LicenseTrialPayload = {
  email: string;
};

export type IpcResult<T> = { ok: true; data: T } | { ok: false; message: string };

export type JsonObject = Record<string, unknown>;

export type CalculationRecord = {
  id: string;
  calculationType: CalculationType;
  title: string;
  inputJson: JsonObject;
  resultJson: JsonObject | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type CalculationRecordInput = {
  calculationType: CalculationType;
  title: string;
  inputJson?: unknown;
  resultJson?: unknown;
  notes?: string | null;
};

export type CalculationRecordUpdate = {
  title?: string;
  notes?: string | null;
  inputJson?: unknown;
  resultJson?: unknown;
};

export type AppSetting = {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardLicenseSummary = {
  state: LicenseState;
  stateLabel: string;
  planLabel: string;
  productCode: string | null;
  productName: string | null;
  expiresAt: string | null;
  remainingDays: number | null;
  lastSuccessfulValidationAt: string | null;
  offlineGraceUntil: string | null;
  isOfflineGrace: boolean;
  maxDevices: number | null;
  isMock: boolean;
};

export type DashboardRecentRecord = {
  id: string;
  title: string;
  calculationType: string;
  createdAt: string;
  netTotal: number | null;
};

export type DashboardSummary = {
  totalCalculations: number;
  currentMonthCalculations: number;
  lastUsedAt: string | null;
  latestRecord: { title: string } | null;
  typeDistribution: { name: string; value: number }[];
  monthlyCounts: { key: string; label: string; count: number }[];
  createdAtDates: string[];
  recentRecords: DashboardRecentRecord[];
  licenseSummary: DashboardLicenseSummary;
};

export type DepositInterestPeriodDto = {
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  source: "TCMB_EVDS";
  currency: "TRY";
  maturity: "ONE_YEAR_OR_LESS";
};

export type DesktopApi = {
  getAppInfo: () => Promise<DesktopAppInfo>;
  getLicenseStatus: () => Promise<DesktopLicenseStatus>;
  activateLicense: (payload: LicenseActivatePayload) => Promise<IpcResult<DesktopLicenseStatus>>;
  startTrial: (payload: LicenseTrialPayload) => Promise<IpcResult<DesktopLicenseStatus>>;
  refreshLicense: () => Promise<IpcResult<DesktopLicenseStatus>>;
  getStorageInfo: () => Promise<DesktopStorageInfo>;
  listCalculationRecords: () => Promise<IpcResult<CalculationRecord[]>>;
  getCalculationRecord: (id: string) => Promise<IpcResult<CalculationRecord>>;
  createCalculationRecord: (payload: CalculationRecordInput) => Promise<IpcResult<CalculationRecord>>;
  updateCalculationRecord: (
    id: string,
    payload: CalculationRecordUpdate,
  ) => Promise<IpcResult<CalculationRecord>>;
  deleteCalculationRecord: (id: string) => Promise<IpcResult<{ id: string }>>;
  getSetting: (key: string) => Promise<IpcResult<AppSetting | null>>;
  setSetting: (key: string, value: string) => Promise<IpcResult<AppSetting>>;
  createDevSampleRecord: () => Promise<IpcResult<CalculationRecord>>;
  calculateKidem: (payload: unknown) => Promise<IpcResult<JsonObject>>;
  fetchDepositInterestRates: (payload: {
    startDate: string;
    endDate: string;
  }) => Promise<IpcResult<{ periods: DepositInterestPeriodDto[] }>>;
  exportSavedCasesBackup: () => Promise<IpcResult<{ cancelled: boolean; filename?: string }>>;
  importSavedCasesBackup: (
    fileBuffer: ArrayBuffer,
  ) => Promise<IpcResult<{ cancelled: boolean; message: string; imported: number; skipped: number }>>;
  getDashboardSummary: () => Promise<IpcResult<DashboardSummary>>;
  updateGetStatus: () => Promise<UpdateStatusSnapshot>;
  updateCheck: (source?: UpdateCheckSource) => Promise<UpdateActionResult>;
  updateDownload: () => Promise<UpdateActionResult>;
  updateInstall: () => Promise<UpdateActionResult>;
  updateDismiss: () => Promise<void>;
  onUpdateStatusChanged: (listener: (status: UpdateStatusSnapshot) => void) => () => void;
};
