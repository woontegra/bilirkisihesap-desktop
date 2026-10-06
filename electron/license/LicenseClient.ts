import type {
  DesktopLicenseStatus,
  IpcResult,
  LicenseActivatePayload,
  LicenseSource,
  LicenseTrialPayload,
} from "../../shared/desktop-contract";

export interface LicenseClient {
  readonly source: LicenseSource;
  getStatus(): Promise<DesktopLicenseStatus>;
  activate(payload: LicenseActivatePayload): Promise<IpcResult<DesktopLicenseStatus>>;
  startTrial(payload: LicenseTrialPayload): Promise<IpcResult<DesktopLicenseStatus>>;
  refresh(): Promise<IpcResult<DesktopLicenseStatus>>;
}
