import { afterEach, describe, expect, it, vi } from "vitest";
import { LicenseNetworkError, postLicenseJson } from "./licenseApi";

describe("licenseApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts JSON to activate/validate routes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ valid: true, expiresAt: "2027-01-01T00:00:00.000Z", offlineGraceDays: 7 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const data = await postLicenseJson("https://example.test/api/public/license", "/validate", {
      licenseKey: "WTG-TEST",
      appCode: "BILIRKISI_DESKTOP",
      deviceHash: "abc",
    });
    expect(data.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/public/license/validate",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as Record<string, string>;
    expect(body).not.toHaveProperty("inputJson");
    expect(body.appCode).toBe("BILIRKISI_DESKTOP");
  });

  it("maps fetch failure to LicenseNetworkError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(postLicenseJson("https://example.test", "/activate", {})).rejects.toBeInstanceOf(LicenseNetworkError);
  });
});
