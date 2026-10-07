import { describe, expect, it } from "vitest";
import { paidRecordFromHandoff } from "./paidHandoff";

describe("paid handoff record", () => {
  it("replaces a trial store shape with the paid license", () => {
    const record = paidRecordFromHandoff("ab".repeat(32), {
      success: true,
      licenseKey: "bh-paid-key",
      expiresAt: "2027-10-06T00:00:00.000Z",
      maxDevices: 1,
    });
    expect(record?.kind).toBe("paid");
    expect(record?.licenseKey).toBe("BH-PAID-KEY");
    expect(record?.deviceHash).toBe("ab".repeat(32));
    expect(record?.maxDevices).toBe(1);
    expect(record?.status).toBe("ACTIVE");
  });
});
