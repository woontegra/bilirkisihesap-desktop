import { afterEach, describe, expect, it, vi } from "vitest";
import { LicenseNetworkError, LicenseTransientError, postLicenseJson } from "./licenseApi";

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

  function reply(status: number, body?: unknown) {
    return vi.fn().mockResolvedValue({
      status,
      json: async () => {
        if (body === undefined) throw new SyntaxError("Unexpected token <");
        return body;
      },
    });
  }

  it.each([
    [429, { success: false, message: "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin" }],
    [408, {}],
    [500, { valid: false }],
    [502, undefined],
    [503, undefined],
  ])("HTTP %i geçici hatadır, lisans kararı sayılmaz", async (status, body) => {
    vi.stubGlobal("fetch", reply(status, body));
    const error = await postLicenseJson("https://example.test", "/trial/validate", {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LicenseTransientError);
    expect(error).not.toBeInstanceOf(LicenseNetworkError);
    expect((error as LicenseTransientError).status).toBe(status);
  });

  it("429 sunucu mesajını taşır", async () => {
    vi.stubGlobal("fetch", reply(429, { message: "Çok fazla deneme." }));
    await expect(postLicenseJson("https://example.test", "/activate", {})).rejects.toMatchObject({
      serverMessage: "Çok fazla deneme.",
    });
  });

  it("2xx JSON olmayan gövde geçici hatadır", async () => {
    vi.stubGlobal("fetch", reply(200));
    await expect(postLicenseJson("https://example.test", "/validate", {})).rejects.toBeInstanceOf(LicenseTransientError);
  });

  it.each([
    [403, { valid: false, message: "Lisans iptal edilmiş." }],
    [410, { success: false, code: "TRIAL_EXPIRED" }],
    [404, { message: "Lisans bulunamadı." }],
    [409, { message: "Cihaz limiti doldu." }],
  ])("HTTP %i açık lisans kararını olduğu gibi döndürür", async (status, body) => {
    vi.stubGlobal("fetch", reply(status, body));
    await expect(postLicenseJson("https://example.test", "/validate", {})).resolves.toEqual(body);
  });

  it.each([
    [400, {}],
    [401, { message: "Unauthorized" }],
    [404, undefined],
  ])("HTTP %i karar içermiyorsa iptal sayılmaz", async (status, body) => {
    vi.stubGlobal("fetch", reply(status, body));
    await expect(postLicenseJson("https://example.test", "/validate", {})).rejects.toBeInstanceOf(LicenseTransientError);
  });
});
