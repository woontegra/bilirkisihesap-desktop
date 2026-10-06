import { describe, expect, it } from "vitest";
import { isAllowedAppSettingKey } from "../db/settingsRepository";

describe("app setting keys", () => {
  it("allows icra kayıt eşlemesi ve locale", () => {
    expect(isAllowedAppSettingKey("locale")).toBe(true);
    expect(isAllowedAppSettingKey("saved-case-numeric-ids")).toBe(true);
    expect(isAllowedAppSettingKey("extra-calculations-sets")).toBe(true);
    expect(isAllowedAppSettingKey("dashboard-last-used-at")).toBe(true);
  });

  it("rejects arbitrary keys", () => {
    expect(isAllowedAppSettingKey("execute-sql")).toBe(false);
    expect(isAllowedAppSettingKey("TCMB_EVDS_API_KEY")).toBe(false);
    expect(isAllowedAppSettingKey("../etc/passwd")).toBe(false);
  });
});
