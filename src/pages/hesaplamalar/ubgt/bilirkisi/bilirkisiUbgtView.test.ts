import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyForm, STORAGE_KEY, type SavedCase } from "../model";
import { loadCasesSafe } from "../storage";
import { buildCetvelDisplayRows } from "../ubgtCetvelRows";
import { buildBilirkisiUbgtPreviewSections } from "./buildBilirkisiUbgtPreviewSections";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

beforeEach(() => {
  const local = memoryStorage();
  vi.stubGlobal("window", { localStorage: local });
  vi.stubGlobal("localStorage", local);
});

describe("Bilirkişi UBGT görünümü", () => {
  it("önizleme cetvelinde kişi kolonu yoktur", () => {
    const form = createEmptyForm("bilirkisi");
    const rows = buildCetvelDisplayRows(
      [
        {
          period: "01.01.2024 - 31.12.2024",
          wage: 30000,
          coefficient: 1,
          dailyWage: 1000,
          ubgtDays: 4,
          ubgtTotal: 4000,
          persons: ["Eski Davacı"],
        },
      ],
      {},
      [],
      [],
    );
    const sections = buildBilirkisiUbgtPreviewSections({
      form,
      displayPeriods: rows,
      displayTotalDays: 4,
      displayBrutForNet: 4000,
      effectiveNet: {
        ssk: 0,
        issizlik: 0,
        gelirVergisi: 0,
        gelirVergisiDilimleri: "",
        damgaVergisi: 0,
        netAmount: 4000,
      },
      hakkaniyet: 0,
      settleNum: 0,
    });
    const cetvel = sections.find((section) => section.id === "ubgt-hesaplama-cetveli");
    expect(cetvel?.headers).toEqual([
      "Dönem",
      "Ücret (BRÜT)",
      "Katsayı",
      "Günlük ücret",
      "UBGT günleri",
      "UBGT ücreti",
    ]);
    expect(cetvel?.headers).not.toContain("Kişi(ler)");
    expect(cetvel?.rows[0]).toHaveLength(6);
  });

  it("otomatik satırın UBGT günü override ile değişir", () => {
    const rows = buildCetvelDisplayRows(
      [
        {
          period: "01.01.2024 - 31.12.2024",
          wage: 30000,
          coefficient: 1,
          dailyWage: 1000,
          ubgtDays: 4,
          ubgtTotal: 4000,
        },
      ],
      { "0": { ubgtDays: "9" } },
      [],
      [],
    );
    expect(rows[0]?.source).toBe("auto");
    expect(rows[0]?.ubgtDaysDisplay).toBe("9");
    expect(rows[0]?.ubgtDays).toBe(9);
    expect(rows[0]?.ubgtTotal).toBe(9000);
  });

  it("eski kayıt açılınca kişi ve gün override kaybolmaz", () => {
    const form = createEmptyForm("bilirkisi");
    form.dateRanges[0] = {
      ...form.dateRanges[0],
      person: "Eski Davacı",
      start: "2024-01-01",
      end: "2024-12-31",
    };
    form.periodOverrides = { "0": { ubgtDays: "7" } };
    const saved: SavedCase = {
      id: "eski-1",
      name: "Eski bilirkişi",
      savedAt: "2024-06-01T00:00:00.000Z",
      form,
      results: {
        periods: [],
        ubgtDayEntries: [],
        toplamBrut: 0,
        toplamNet: {
          ssk: 0,
          issizlik: 0,
          gelirVergisi: 0,
          damgaVergisi: 0,
          netAmount: 0,
          gelirVergisiDilimleri: "",
        },
        totalDays: 0,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cases: [saved] }));
    const loaded = loadCasesSafe("bilirkisi");
    expect(loaded.ok).toBe(true);
    expect(loaded.items[0]?.form.dateRanges[0]?.person).toBe("Eski Davacı");
    expect(loaded.items[0]?.form.dateRanges[0]?.start).toBe("2024-01-01");
    expect(loaded.items[0]?.form.periodOverrides["0"]?.ubgtDays).toBe("7");
  });
});
