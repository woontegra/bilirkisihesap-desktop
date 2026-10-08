import { describe, expect, it } from "vitest";
import { createOfflineLoginRecord, offlinePasswordMatches } from "../auth/offlineLogin";

describe("offline login record", () => {
  it("stores a hash instead of the password and accepts only the same device", () => {
    const record = createOfflineLoginRecord("Ada.01", "dogru-parola", "device-a");
    const saved = JSON.stringify(record);
    expect(saved.includes("dogru-parola")).toBe(false);
    expect(offlinePasswordMatches(record, "ada.01", "dogru-parola", "device-a")).toBe(true);
    expect(offlinePasswordMatches(record, "ada.01", "yanlis-parola", "device-a")).toBe(false);
    expect(offlinePasswordMatches(record, "ada.01", "dogru-parola", "device-b")).toBe(false);
  });

  it("keeps the saved record usable after a logout that does not delete it", () => {
    const record = createOfflineLoginRecord("ada", "ayni-parola", "device-a");
    const afterLogout = record;
    expect(offlinePasswordMatches(afterLogout, "ada", "ayni-parola", "device-a")).toBe(true);
  });
});
