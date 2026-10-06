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

export class MockLicenseClient implements LicenseClient {
  readonly source = "mock" as const;

  async getStatus(): Promise<DesktopLicenseStatus> {
    return this.status();
  }

  async activate(_payload: LicenseActivatePayload): Promise<IpcResult<DesktopLicenseStatus>> {
    return { ok: true, data: this.status() };
  }

  async startTrial(_payload: LicenseTrialPayload): Promise<IpcResult<DesktopLicenseStatus>> {
    return { ok: true, data: this.status() };
  }

  async refresh(): Promise<IpcResult<DesktopLicenseStatus>> {
    return { ok: true, data: this.status() };
  }

  private status(): DesktopLicenseStatus {
    return buildStatus({
      source: "mock",
      state: "active",
      isMock: true,
      planLabel: "Geliştirme (mock)",
      productCode: LICENSE_APP_CODE,
      expiresAt: null,
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulValidationAt: new Date().toISOString(),
      offlineGraceUntil: null,
      isOfflineGrace: false,
      maxDevices: null,
      maskedLicenseKey: null,
      message: `Bu durum gerçek lisans doğrulaması değildir (${LICENSE_PRODUCT_NAME} mock). Yalnızca unpackaged development ortamında açılır; production paketinde etkinleşmez. Gerçek lisans için: npm run dev:license`,
    });
  }
}
