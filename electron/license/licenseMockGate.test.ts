import { describe, expect, it } from "vitest";
import { shouldUseMockLicense } from "./licenseMockGate";

describe("license mock gate", () => {
  it("enables mock for unpackaged development by default", () => {
    expect(
      shouldUseMockLicense({ packaged: false, licenseUseMock: undefined, nodeEnv: "development" }),
    ).toBe(true);
  });

  it("never enables mock for packaged builds", () => {
    expect(shouldUseMockLicense({ packaged: true, licenseUseMock: "1", nodeEnv: "development" })).toBe(false);
  });

  it("stays off when LICENSE_USE_MOCK=0", () => {
    expect(
      shouldUseMockLicense({ packaged: false, licenseUseMock: "0", nodeEnv: "development" }),
    ).toBe(false);
  });

  it("stays off when NODE_ENV is production", () => {
    expect(
      shouldUseMockLicense({ packaged: false, licenseUseMock: "1", nodeEnv: "production" }),
    ).toBe(false);
  });
});
