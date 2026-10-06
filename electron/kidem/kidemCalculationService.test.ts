import { describe, expect, it } from "vitest";
import { buildStatus } from "../license/licensePolicy";
import { AppError } from "../db/errors";
import { assertCanCalculate, calculateKidemWithLicense } from "./kidemCalculationService";

function expiredStatus() {
  return buildStatus({
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
    message: "Lisans süresi doldu.",
  });
}

function mockActiveStatus() {
  return buildStatus({
    source: "mock",
    state: "active",
    isMock: true,
    planLabel: "mock",
    productCode: "BILIRKISI_DESKTOP",
    expiresAt: null,
    lastCheckedAt: null,
    lastSuccessfulValidationAt: null,
    offlineGraceUntil: null,
    isOfflineGrace: false,
    maxDevices: null,
    maskedLicenseKey: null,
    message: "mock",
  });
}

describe("kidem license gate", () => {
  it("blocks calculation without write permission", () => {
    expect(() => assertCanCalculate(expiredStatus())).toThrow(AppError);
    expect(() =>
      calculateKidemWithLicense(
        {
          iseGirisTarihi: "2020-01-01",
          istenCikisTarihi: "2023-01-01",
          ciplakBrut: "10000",
        },
        expiredStatus(),
      ),
    ).toThrow(/lisans/i);
  });

  it("calculates when mock/active license allows writes", () => {
    const out = calculateKidemWithLicense(
      {
        iseGirisTarihi: "2020-01-01",
        istenCikisTarihi: "2023-01-01",
        ciplakBrut: "10.000,00",
      },
      mockActiveStatus(),
    );
    expect(out.result.brutKidem).toBe(30000);
  });

  it("rejects inverted dates", () => {
    expect(() =>
      calculateKidemWithLicense(
        {
          iseGirisTarihi: "2023-01-02",
          istenCikisTarihi: "2023-01-01",
          ciplakBrut: "10.000,00",
        },
        mockActiveStatus(),
      ),
    ).toThrow();
  });
});
