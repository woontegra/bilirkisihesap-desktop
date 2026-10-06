import { describe, expect, it } from "vitest";
import { createBackupFile, parseBackupFile } from "./bhbackupFormat";

describe("bhbackup format", () => {
  it("round-trips calculation cases", () => {
    const payload = {
      meta: {
        app: "bilirkisihesap-desktop",
        version: 1,
        createdAt: "2026-08-25T00:00:00.000Z",
        totalCases: 1,
      },
      cases: [
        {
          name: "Örnek",
          type: "kidem-is-kanunu",
          data: { form: { iseGirisTarihi: "2020-01-01" }, results: { netKidem: 10 } },
          originalCreatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    };
    const file = createBackupFile(payload);
    expect(parseBackupFile(file)).toEqual(payload);
  });

  it("rejects tampered files", () => {
    const file = createBackupFile({
      meta: { app: "bilirkisihesap-desktop", version: 1, createdAt: "x", totalCases: 0 },
      cases: [],
    });
    file[20] = file[20] ^ 1;
    expect(() => parseBackupFile(file)).toThrow(/signature|Geçersiz|Invalid/i);
  });
});
