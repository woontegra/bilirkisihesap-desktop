import { app } from "electron";
import type { LicenseClient } from "./LicenseClient";
import { CentralLicenseClient } from "./CentralLicenseClient";
import { MockLicenseClient } from "./MockLicenseClient";
import { UnconfiguredLicenseClient } from "./UnconfiguredLicenseClient";
import { isDevelopmentRuntime } from "../runtime";
import { shouldUseMockLicense } from "./licenseMockGate";

export function createLicenseClient(): LicenseClient {
  if (
    shouldUseMockLicense({
      packaged: !isDevelopmentRuntime(),
      licenseUseMock: process.env.LICENSE_USE_MOCK,
      nodeEnv: process.env.NODE_ENV,
    })
  ) {
    return new MockLicenseClient();
  }
  if (process.env.LICENSE_API_BASE?.trim() === "") {
    return new UnconfiguredLicenseClient();
  }
  if (app.isPackaged && process.env.LICENSE_USE_MOCK === "1") {
    return new UnconfiguredLicenseClient();
  }
  return new CentralLicenseClient();
}
