import {
  LICENSE_APP_CODE,
  LICENSE_PRODUCT_NAME,
  type DesktopLicenseStatus,
  type IpcResult,
  type LicenseActivatePayload,
  type LicenseTrialPayload,
} from "../../shared/desktop-contract";
import type { LicenseClient } from "./LicenseClient";
import { buildStatus } from "./licensePolicy";

export class UnconfiguredLicenseClient implements LicenseClient {
  readonly source = "unconfigured" as const;

  async getStatus(): Promise<DesktopLicenseStatus> {
    return this.status();
  }

  async activate(_payload: LicenseActivatePayload): Promise<IpcResult<DesktopLicenseStatus>> {
    return { ok: false, message: this.status().message };
  }

  async startTrial(_payload: LicenseTrialPayload): Promise<IpcResult<DesktopLicenseStatus>> {
    return { ok: false, message: this.status().message };
  }

  async refresh(): Promise<IpcResult<DesktopLicenseStatus>> {
    return { ok: false, message: this.status().message };
  }

  private status(): DesktopLicenseStatus {
    return buildStatus({
      source: "unconfigured",
      state: "inactive",
      isMock: false,
      planLabel: LICENSE_PRODUCT_NAME,
      productCode: LICENSE_APP_CODE,
      expiresAt: null,
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulValidationAt: null,
      offlineGraceUntil: null,
      isOfflineGrace: false,
      maxDevices: null,
      maskedLicenseKey: null,
      message:
        "Lisans sunucusu adresi yapılandırılmamış. LICENSE_API_BASE tanımlayın. Lisans otomatik olarak aktif sayılmaz.",
    });
  }
}
