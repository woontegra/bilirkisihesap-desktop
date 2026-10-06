import { describe, expect, it } from "vitest";
import { computeDeviceHash, entitlementPlatformFromOs } from "./deviceHash";

describe("deviceHash", () => {
  it("is stable for the same process", () => {
    expect(computeDeviceHash()).toBe(computeDeviceHash());
    expect(computeDeviceHash()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("maps desktop platforms without treating linux as an entitlement", () => {
    expect(entitlementPlatformFromOs("win32")).toBe("WINDOWS");
    expect(entitlementPlatformFromOs("darwin")).toBe("MACOS");
    expect(entitlementPlatformFromOs("linux")).toBeNull();
  });
});
