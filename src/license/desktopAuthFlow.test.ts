import { describe, expect, it } from "vitest";
import { DEFAULT_OFFLINE_GRACE_DAYS } from "../../electron/license/licensePolicy";
import {
  DEMO_EXPIRED_USER_MESSAGE,
  desktopSecurityQuestionError,
  localSecurityQuestionCode,
  normalizeDesktopUsername,
} from "../../shared/desktopAuthAccount";
import {
  desktopEntryStep,
  entryStepWithoutAuthServer,
  loginSecondaryActions,
  offlineSessionAllowed,
  sessionAllowsProtectedCall,
} from "../../shared/desktopAuthFlow";

describe("desktop user entry", () => {
  it("lets a new install choose demo or an existing license key", () => {
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "none", account: "missing", licenseOpen: false }),
    ).toBe("choose");
  });

  it("keeps a 3.6.2 paid license and asks only for a local account", () => {
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "paid", account: "missing", licenseOpen: true }),
    ).toBe("local-setup");
  });

  it("asks an existing local account for username and password", () => {
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "paid", account: "ready", licenseOpen: true }),
    ).toBe("login");
    expect(loginSecondaryActions({ step: "login", storedKind: "paid" })).toEqual(["forgot-password"]);
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "trial", account: "ready", licenseOpen: true }),
    ).toBe("login");
    expect(loginSecondaryActions({ step: "login", storedKind: "trial" })).toEqual(["forgot-password"]);
  });

  it("keeps demo and activation on a first install and renewal on a closed paid license", () => {
    expect(loginSecondaryActions({ step: "choose", storedKind: "none" })).toEqual([
      "start-demo",
      "activate-license",
    ]);
    expect(loginSecondaryActions({ step: "blocked", storedKind: "paid" })).toEqual([
      "renew-license",
      "activate-license",
    ]);
    expect(loginSecondaryActions({ step: "blocked", storedKind: "trial" })).toEqual(["activate-license"]);
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "paid", account: "ready", licenseOpen: true }),
    ).toBe("login");
  });

  it("continues an existing demo without opening a second trial", () => {
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "trial", account: "missing", licenseOpen: true }),
    ).toBe("local-setup");
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "none", account: "missing", licenseOpen: true }),
    ).toBe("choose");
  });

  it("blocks an expired license and still requires a session for protected calls", () => {
    expect(
      desktopEntryStep({ signedIn: false, storedKind: "paid", account: "ready", licenseOpen: false }),
    ).toBe("blocked");
    expect(sessionAllowsProtectedCall(false)).toBe(false);
    expect(sessionAllowsProtectedCall(true)).toBe(true);
  });

  it("keeps the existing offline grace constant and does not open a closed license", () => {
    expect(DEFAULT_OFFLINE_GRACE_DAYS).toBe(7);
    expect(
      entryStepWithoutAuthServer({ licenseOpen: false, storedKind: "paid", hasLocalAccount: true }).step,
    ).toBe("blocked");
    expect(offlineSessionAllowed({ licenseOpen: false, passwordMatches: true })).toBe(false);
  });

  it("accepts the Müvekkil Kasa security questions and an email login name", () => {
    expect(normalizeDesktopUsername("kullanici@example.com")).toBe("kullanici@example.com");
    expect(localSecurityQuestionCode("G2")).toBe("G2");
    expect(localSecurityQuestionCode("Doğduğunuz şehir nedir?")).toBe("G2");
    expect(desktopSecurityQuestionError("Kendi sorum")).toMatch(/listeden/);
  });

  it("closes an expired demo even when the local password matches", () => {
    expect(DEMO_EXPIRED_USER_MESSAGE).toContain("Deneme süreniz sona ermiştir");
    expect(
      desktopEntryStep({ signedIn: true, storedKind: "trial", account: "ready", licenseOpen: false }),
    ).toBe("blocked");
    expect(
      desktopEntryStep({ signedIn: true, storedKind: "trial", account: "ready", licenseOpen: true }),
    ).toBe("app");
    expect(offlineSessionAllowed({ licenseOpen: false, passwordMatches: true })).toBe(false);
  });

  it("lets a local password open an active paid license without an auth server", () => {
    expect(
      entryStepWithoutAuthServer({ licenseOpen: true, storedKind: "paid", hasLocalAccount: true }),
    ).toEqual({ step: "login", needsInternetForFirstLogin: false });
    expect(offlineSessionAllowed({ licenseOpen: true, passwordMatches: true })).toBe(true);
    expect(offlineSessionAllowed({ licenseOpen: true, passwordMatches: false })).toBe(false);
  });
});
