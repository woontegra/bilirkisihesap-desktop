import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  buildStatus,
  DEFAULT_OFFLINE_GRACE_DAYS,
  detectClockAnomaly,
  isExpiredAt,
  mapServerMessageToState,
  maskLicenseKey,
} from "./licensePolicy";

describe("licensePolicy", () => {
  it("maps central server Turkish messages", () => {
    expect(mapServerMessageToState("Program kodu eşleşmiyor")).toBe("invalid_product");
    expect(mapServerMessageToState("Bu lisans bu işletim sisteminde kullanılamaz")).toBe("invalid_product");
    expect(mapServerMessageToState("Cihaz limiti aşıldı (2 cihaz)")).toBe("device_limit");
    expect(mapServerMessageToState("Lisans süresi dolmuş")).toBe("expired");
    expect(mapServerMessageToState("Lisans pasif durumda")).toBe("revoked");
    expect(mapServerMessageToState("Bu cihazın erişimi iptal edilmiş")).toBe("revoked");
    expect(mapServerMessageToState("Cihaz kayıtlı değil")).toBe("pending");
    expect(mapServerMessageToState("Sunucu hatası")).toBeNull();
  });

  it("applies 7-day grace from last validation", () => {
    const from = "2026-01-01T00:00:00.000Z";
    expect(addDaysIso(from, DEFAULT_OFFLINE_GRACE_DAYS)).toBe("2026-01-08T00:00:00.000Z");
  });

  it("detects clock rollback beyond skew", () => {
    const last = "2026-08-24T12:00:00.000Z";
    const earlier = Date.parse("2026-08-24T11:50:00.000Z");
    expect(detectClockAnomaly(last, earlier)).toBe(true);
    expect(detectClockAnomaly(last, Date.parse("2026-08-24T12:01:00.000Z"))).toBe(false);
  });

  it("treats past expiresAt as expired", () => {
    expect(isExpiredAt("2020-01-01T00:00:00.000Z", Date.parse("2026-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("masks license keys and allows write only when active or mock", () => {
    expect(maskLicenseKey("WTG-AAAA-BBBB-CCCC")).toMatch(/^WTG-AAA/);
    expect(
      buildStatus({
        source: "central",
        state: "expired",
        isMock: false,
        planLabel: "x",
        productCode: "BILIRKISI_DESKTOP",
        expiresAt: null,
        lastCheckedAt: null,
        lastSuccessfulValidationAt: null,
        offlineGraceUntil: null,
        isOfflineGrace: false,
        maxDevices: null,
        maskedLicenseKey: null,
        message: "x",
      }).canWriteRecords,
    ).toBe(false);
    expect(
      buildStatus({
        source: "central",
        state: "active",
        isMock: false,
        planLabel: "x",
        productCode: "BILIRKISI_DESKTOP",
        expiresAt: null,
        lastCheckedAt: null,
        lastSuccessfulValidationAt: null,
        offlineGraceUntil: null,
        isOfflineGrace: true,
        maxDevices: null,
        maskedLicenseKey: null,
        message: "x",
      }).canWriteRecords,
    ).toBe(true);
  });
});
