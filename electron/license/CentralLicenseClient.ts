import { app } from "electron";
import {
  LICENSE_APP_CODE,
  LICENSE_PRODUCT_NAME,
  type DesktopLicenseStatus,
  type IpcResult,
  type LicenseActivatePayload,
  type LicenseTrialPayload,
} from "../../shared/desktop-contract";
import type { LicenseClient } from "./LicenseClient";
import {
  LicenseNetworkError,
  licensePublicApiBase,
  postLicenseJson,
  type LicenseActivateApiResponse,
  type LicenseValidateApiResponse,
} from "./licenseApi";
import { computeDeviceHash, getDeviceName, getEntitlementPlatform } from "./deviceHash";
import {
  DEFAULT_OFFLINE_GRACE_DAYS,
  addDaysIso,
  buildStatus,
  detectClockAnomaly,
  isExpiredAt,
  mapServerMessageToState,
  maskLicenseKey,
  userMessageForState,
} from "./licensePolicy";
import { readStoredLicense, touchLastSeen, writeStoredLicense, type StoredLicenseRecord } from "./licenseStore";
import { paidRecordFromHandoff } from "./paidHandoff";

function apiBase(): string {
  return licensePublicApiBase();
}

export class CentralLicenseClient implements LicenseClient {
  readonly source = "central" as const;

  async getStatus(): Promise<DesktopLicenseStatus> {
    return this.resolveStatus();
  }

  async activate(payload: LicenseActivatePayload): Promise<IpcResult<DesktopLicenseStatus>> {
    const licenseKey = payload.licenseKey.replace(/\s+/g, "").toUpperCase();
    const activationPassword = payload.activationPassword.trim();
    if (!licenseKey || !activationPassword) {
      return { ok: false, message: "Lisans anahtarı ve aktivasyon şifresi zorunludur." };
    }

    const platform = getEntitlementPlatform();
    if (!platform) {
      return { ok: false, message: "Bu deneme ve lisans yalnız Windows veya macOS üzerinde çalışır." };
    }
    const deviceHash = computeDeviceHash();
    try {
      const out = await postLicenseJson<LicenseActivateApiResponse>(apiBase(), "/activate", {
        licenseKey,
        activationPassword,
        appCode: LICENSE_APP_CODE,
        deviceHash,
        deviceName: getDeviceName(),
        platform,
        appVersion: app.getVersion(),
      });
      if (!out.success) {
        const state = mapServerMessageToState(out.message) ?? "pending";
        return { ok: false, message: userMessageForState(state, out.message) };
      }
      const now = new Date().toISOString();
      writeStoredLicense({
        kind: "paid",
        licenseKey,
        deviceHash,
        expiresAt: out.expiresAt ?? null,
        lastValidatedAt: now,
        offlineGraceUntil: addDaysIso(now, DEFAULT_OFFLINE_GRACE_DAYS),
        lastSeenAt: now,
        maxDevices: null,
        status: "ACTIVE",
      });
      return { ok: true, data: await this.resolveStatus() };
    } catch (error) {
      if (error instanceof LicenseNetworkError) {
        return { ok: false, message: userMessageForState("unreachable") };
      }
      return { ok: false, message: "Lisans etkinleştirilemedi." };
    }
  }

  async startTrial(payload: LicenseTrialPayload): Promise<IpcResult<DesktopLicenseStatus>> {
    const email = payload.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Geçerli bir e-posta adresi girin." };
    }
    const platform = getEntitlementPlatform();
    if (!platform) {
      return { ok: false, message: "Bu deneme yalnız Windows veya macOS üzerinde başlatılabilir." };
    }
    const deviceHash = computeDeviceHash();
    try {
      const out = await postLicenseJson<LicenseValidateApiResponse & { success?: boolean; code?: string }>(
        apiBase(),
        "/trial",
        {
          appCode: LICENSE_APP_CODE,
          email,
          deviceHash,
          platform,
          deviceName: getDeviceName(),
          appVersion: app.getVersion(),
        },
      );
      if (!out.success || !out.expiresAt) {
        const state = mapServerMessageToState(out.message) ?? "pending";
        return { ok: false, message: userMessageForState(state, out.message) };
      }
      const now = new Date().toISOString();
      writeStoredLicense({
        kind: "trial",
        licenseKey: "",
        deviceHash,
        expiresAt: out.expiresAt,
        lastValidatedAt: now,
        offlineGraceUntil: null,
        lastSeenAt: now,
        maxDevices: 1,
        status: "ACTIVE",
      });
      return { ok: true, data: await this.resolveStatus() };
    } catch (error) {
      if (error instanceof LicenseNetworkError) {
        return { ok: false, message: userMessageForState("unreachable") };
      }
      return { ok: false, message: "Ücretsiz deneme başlatılamadı." };
    }
  }

  async refresh(): Promise<IpcResult<DesktopLicenseStatus>> {
    const status = await this.resolveStatus();
    if (status.state === "unreachable" || status.state === "offline_expired") {
      return { ok: false, message: status.message };
    }
    return { ok: true, data: status };
  }

  private async resolveStatus(): Promise<DesktopLicenseStatus> {
    const now = Date.now();
    let stored = readStoredLicense();
    if (stored && (stored.licenseKey || stored.kind === "trial")) {
      if (detectClockAnomaly(stored.lastSeenAt, now)) {
        return this.fromStore(stored, {
          state: "clock_anomaly",
          message: userMessageForState("clock_anomaly"),
        });
      }
      touchLastSeen(stored);
    }

    if (stored?.kind === "trial") {
      const claimed = await this.claimPaidHandoff(stored);
      if (!claimed) return this.resolveTrialStatus(stored, now);
      stored = claimed;
    }

    if (!stored?.licenseKey || stored.status === "NONE") {
      return buildStatus({
        source: "central",
        state: "pending",
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
        message: userMessageForState("pending"),
      });
    }

    if (stored.deviceHash !== computeDeviceHash()) {
      return buildStatus({
        source: "central",
        state: "pending",
        isMock: false,
        planLabel: LICENSE_PRODUCT_NAME,
        productCode: LICENSE_APP_CODE,
        expiresAt: stored.expiresAt,
        lastCheckedAt: new Date().toISOString(),
        lastSuccessfulValidationAt: stored.lastValidatedAt,
        offlineGraceUntil: stored.offlineGraceUntil,
        isOfflineGrace: false,
        maxDevices: stored.maxDevices,
        maskedLicenseKey: maskLicenseKey(stored.licenseKey),
        message: "Bu lisans kaydı bu cihaza ait değil. Yeniden etkinleştirme gerekir.",
      });
    }

    if (isExpiredAt(stored.expiresAt, now)) {
      writeStoredLicense({ ...stored, status: "LOCKED" });
      return this.fromStore(stored, {
        state: "expired",
        message: userMessageForState("expired"),
      });
    }

    try {
      const out = await postLicenseJson<LicenseValidateApiResponse>(apiBase(), "/validate", {
        licenseKey: stored.licenseKey,
        appCode: LICENSE_APP_CODE,
        deviceHash: stored.deviceHash,
        platform: getEntitlementPlatform(),
      });
      if (!out.valid) {
        const state = mapServerMessageToState(out.message) ?? "revoked";
        writeStoredLicense({ ...stored, status: "LOCKED", lastSeenAt: new Date().toISOString() });
        return this.fromStore(stored, {
          state,
          message: userMessageForState(state, out.message),
        });
      }
      const validatedAt = new Date().toISOString();
      const graceDays = out.offlineGraceDays ?? DEFAULT_OFFLINE_GRACE_DAYS;
      const next: StoredLicenseRecord = {
        ...stored,
        kind: "paid",
        expiresAt: out.expiresAt ?? stored.expiresAt,
        lastValidatedAt: validatedAt,
        offlineGraceUntil: addDaysIso(validatedAt, graceDays),
        lastSeenAt: validatedAt,
        maxDevices: out.maxDevices ?? stored.maxDevices,
        status: "ACTIVE",
      };
      writeStoredLicense(next);
      return this.fromStore(next, {
        state: "active",
        isOfflineGrace: false,
        message: userMessageForState("active", out.message),
      });
    } catch (error) {
      if (!(error instanceof LicenseNetworkError)) {
        return this.fromStore(stored, {
          state: "unreachable",
          message: userMessageForState("unreachable"),
        });
      }
      const graceUntil = stored.offlineGraceUntil ? Date.parse(stored.offlineGraceUntil) : 0;
      if (stored.status === "ACTIVE" && graceUntil >= now && !isExpiredAt(stored.expiresAt, now)) {
        return this.fromStore(stored, {
          state: "active",
          isOfflineGrace: true,
          message: "Lisans sunucusuna ulaşılamadı. Son doğrulama bilgisiyle devam ediyorsunuz.",
        });
      }
      writeStoredLicense({ ...stored, status: "LOCKED" });
      return this.fromStore(stored, {
        state: "offline_expired",
        message: userMessageForState("offline_expired"),
      });
    }
  }

  private async claimPaidHandoff(stored: StoredLicenseRecord): Promise<StoredLicenseRecord | null> {
    const platform = getEntitlementPlatform();
    if (!platform || stored.kind !== "trial") return null;
    try {
      const out = await postLicenseJson<{
        success?: boolean;
        licenseKey?: string;
        expiresAt?: string;
        maxDevices?: number;
      }>(apiBase(), "/purchase-handoff", {
        appCode: LICENSE_APP_CODE,
        deviceHash: stored.deviceHash,
        platform,
      });
      const next = paidRecordFromHandoff(stored.deviceHash, out);
      if (!next) return null;
      writeStoredLicense(next);
      return next;
    } catch {
      return null;
    }
  }

  private async resolveTrialStatus(stored: StoredLicenseRecord, now: number): Promise<DesktopLicenseStatus> {
    const platform = getEntitlementPlatform();
    if (!platform) {
      return this.fromStore(stored, {
        state: "invalid_product",
        isOfflineGrace: false,
        offlineGraceUntil: null,
        message: "Bu deneme yalnız Windows veya macOS üzerinde doğrulanabilir.",
      });
    }
    if (isExpiredAt(stored.expiresAt, now)) {
      writeStoredLicense({ ...stored, kind: "trial", status: "LOCKED", offlineGraceUntil: null });
      return this.fromStore(stored, {
        state: "expired",
        isOfflineGrace: false,
        offlineGraceUntil: null,
        message: "7 günlük ücretsiz deneme süreniz sona erdi.",
      });
    }
    try {
      const out = await postLicenseJson<LicenseValidateApiResponse & { success?: boolean; valid?: boolean; code?: string }>(
        apiBase(),
        "/trial/validate",
        {
          appCode: LICENSE_APP_CODE,
          deviceHash: stored.deviceHash,
          platform,
        },
      );
      if (!out.success || !out.valid) {
        const expired = out.code === "TRIAL_EXPIRED" || mapServerMessageToState(out.message) === "expired";
        writeStoredLicense({ ...stored, kind: "trial", status: "LOCKED", offlineGraceUntil: null });
        return this.fromStore(stored, {
          state: expired ? "expired" : mapServerMessageToState(out.message) ?? "revoked",
          isOfflineGrace: false,
          offlineGraceUntil: null,
          message: expired
            ? "7 günlük ücretsiz deneme süreniz sona erdi."
            : userMessageForState(mapServerMessageToState(out.message) ?? "revoked", out.message),
        });
      }
      const validatedAt = new Date().toISOString();
      const next: StoredLicenseRecord = {
        ...stored,
        kind: "trial",
        licenseKey: "",
        expiresAt: out.expiresAt ?? stored.expiresAt,
        lastValidatedAt: validatedAt,
        offlineGraceUntil: null,
        lastSeenAt: validatedAt,
        maxDevices: 1,
        status: "ACTIVE",
      };
      writeStoredLicense(next);
      return this.fromStore(next, {
        state: "active",
        isOfflineGrace: false,
        offlineGraceUntil: null,
        planLabel: "7 günlük deneme",
        message: out.message?.trim() || "Deneme lisansı geçerli.",
      });
    } catch (error) {
      if (!(error instanceof LicenseNetworkError)) {
        return this.fromStore(stored, {
          state: "unreachable",
          isOfflineGrace: false,
          offlineGraceUntil: null,
          message: userMessageForState("unreachable"),
        });
      }
      return this.fromStore(stored, {
        state: "unreachable",
        isOfflineGrace: false,
        offlineGraceUntil: null,
        message: "Deneme lisansı çevrimdışı kullanılamaz. Lisans sunucusuna bağlanıp tekrar deneyin.",
      });
    }
  }

  private fromStore(
    stored: StoredLicenseRecord,
    patch: Partial<DesktopLicenseStatus> & { state: DesktopLicenseStatus["state"]; message: string },
  ): DesktopLicenseStatus {
    return buildStatus({
      source: "central",
      isMock: false,
      planLabel: LICENSE_PRODUCT_NAME,
      productCode: LICENSE_APP_CODE,
      expiresAt: stored.expiresAt,
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulValidationAt: stored.lastValidatedAt,
      offlineGraceUntil: stored.offlineGraceUntil,
      isOfflineGrace: false,
      maxDevices: stored.maxDevices,
      maskedLicenseKey: stored.licenseKey ? maskLicenseKey(stored.licenseKey) : null,
      ...patch,
    });
  }
}
