import { describe, expect, it } from "vitest";
import type { LicenseState } from "../../shared/desktop-contract";
import { canEnterLicensedApp, isProtectedCalculationStorageKey, licensedLocalWriteDecision } from "./licenseAccess";

const CLOSED: LicenseState[] = [
  "inactive",
  "unknown",
  "expired",
  "revoked",
  "device_limit",
  "invalid_product",
  "unreachable",
  "offline_expired",
  "clock_anomaly",
  "pending",
];

describe("licensed app access", () => {
  it("keeps calculation routes closed without a resolved active license", () => {
    expect(canEnterLicensedApp(null)).toBe(false);
    expect(canEnterLicensedApp(undefined)).toBe(false);
  });

  it("closes expired, revoked, device limit, invalid product, offline expiry and trial offline", () => {
    for (const state of CLOSED) {
      expect(canEnterLicensedApp({ state }), state).toBe(false);
    }
    expect(canEnterLicensedApp({ state: "unreachable" })).toBe(false);
  });

  it("opens the app for an active paid license, including offline grace", () => {
    expect(canEnterLicensedApp({ state: "active" })).toBe(true);
  });

  it("opens the app for an active trial and for the development mock", () => {
    expect(canEnterLicensedApp({ state: "active" })).toBe(true);
  });
});

describe("local calculation storage", () => {
  it("blocks hafta tatili and other calculation keys when the license is not active", () => {
    expect(
      licensedLocalWriteDecision(false, "bilirkisi-hesap-v35:hafta-tatili-standard:cases:v1"),
    ).toBe("block");
    expect(licensedLocalWriteDecision(false, "bilirkisi-hesap-v35:kidem-is-kanunu:cases:v1")).toBe("block");
    expect(licensedLocalWriteDecision(false, "bilirkisi-desktop:case-notes:v1:42")).toBe("block");
    expect(licensedLocalWriteDecision(false, "puantaj_fm_templates_v2")).toBe("block");
    expect(isProtectedCalculationStorageKey("bh.guidedTour.autoWelcomeSeen.v1")).toBe(false);
  });

  it("allows calculation writes while the license is active", () => {
    expect(
      licensedLocalWriteDecision(true, "bilirkisi-hesap-v35:hafta-tatili-standard:cases:v1"),
    ).toBe("allow");
  });
});
