import { beforeEach, describe, expect, it, vi } from "vitest";

const { openExternal, readStoredLicense, postLicenseJson, devMode } = vi.hoisted(() => ({
  openExternal: vi.fn(async () => {}),
  readStoredLicense: vi.fn(),
  postLicenseJson: vi.fn(),
  devMode: { current: true },
}));

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getPath: () => "C:/tmp",
    getVersion: () => "3.6.0",
  },
  shell: {
    openExternal: (...args: unknown[]) => openExternal(...args),
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
  },
}));

vi.mock("./licenseStore", () => ({
  readStoredLicense: () => readStoredLicense(),
}));

vi.mock("./licenseApi", () => ({
  licensePublicApiBase: () => "http://127.0.0.1:9/api/public/license",
  postLicenseJson: (...args: unknown[]) => postLicenseJson(...args),
  LicenseNetworkError: class LicenseNetworkError extends Error {},
}));

vi.mock("../runtime", () => ({
  isDevelopmentRuntime: () => devMode.current,
}));

vi.mock("./deviceHash", () => ({
  getEntitlementPlatform: () => "WINDOWS",
}));

import { openDesktopFirstPurchase } from "./subscriptionCatalog";

const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
const deviceHash = "ab".repeat(32);

describe("openDesktopFirstPurchase", () => {
  beforeEach(() => {
    openExternal.mockClear();
    postLicenseJson.mockReset();
    devMode.current = true;
    process.env.SUBSCRIPTION_WEBSITE_DEV_BASE = "http://localhost:5174";
    readStoredLicense.mockReturnValue({
      kind: "trial",
      licenseKey: "",
      deviceHash,
      expiresAt: "2026-10-13T00:00:00.000Z",
      lastValidatedAt: null,
      offlineGraceUntil: null,
      lastSeenAt: null,
      maxDevices: 1,
      status: "ACTIVE",
    });
    postLicenseJson.mockResolvedValue({ success: true, purchaseToken: token });
  });

  it("issues a purchase token and opens the local checkout", async () => {
    const result = await openDesktopFirstPurchase();
    expect(result.ok).toBe(true);
    expect(postLicenseJson).toHaveBeenCalledWith(
      "http://127.0.0.1:9/api/public/license",
      "/purchase-token",
      {
        appCode: "BILIRKISI_DESKTOP",
        deviceHash,
        platform: "WINDOWS",
      },
    );
    expect(openExternal).toHaveBeenCalledWith(
      `http://localhost:5174/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=${token}`,
    );
  });

  it("does not open the live site when the local website origin is missing", async () => {
    delete process.env.SUBSCRIPTION_WEBSITE_DEV_BASE;
    const result = await openDesktopFirstPurchase();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("canlı site açılmaz");
    }
    expect(postLicenseJson).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("keeps the packaged site on woontegra.com", async () => {
    devMode.current = false;
    process.env.SUBSCRIPTION_WEBSITE_DEV_BASE = "http://localhost:5174";
    const result = await openDesktopFirstPurchase();
    expect(result.ok).toBe(true);
    expect(openExternal).toHaveBeenCalledWith(
      `https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=${token}`,
    );
  });
});
