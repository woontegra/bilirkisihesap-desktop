import { describe, expect, it, vi } from "vitest";
import { dispatchToolAction, NAV_GROUPS } from "@/shell/nav";
import {
  calculatePressDailyInterest,
  daysBetween,
  formatDateTr,
  formatMoney,
  parseAmount,
} from "./pressDailyInterest";

describe("Basın iş günlük %5 faiz", () => {
  it("Kategori Etiketinin altında openInterestCalculator çağırır", () => {
    const tools = NAV_GROUPS.find((group) => group.id === "tools");
    const interest = tools?.items[4];
    expect(interest?.label).toBe("Faiz Hesaplayıcı");
    expect(interest?.action).toBe("open-interest");
    expect(tools?.items[3]?.action).toBe("add-tag");
    const addNote = vi.fn();
    const openTagModal = vi.fn();
    const openInterestCalculator = vi.fn();
    dispatchToolAction("open-interest", { addNote, openTagModal, openInterestCalculator });
    expect(openInterestCalculator).toHaveBeenCalledTimes(1);
    expect(addNote).not.toHaveBeenCalled();
    expect(openTagModal).not.toHaveBeenCalled();
  });

  it("20.000,00 tutarı 10 günde anaparanın yüzde 5’i ile çarpar", () => {
    expect(parseAmount("20.000,00")).toBe(20000);
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
    const result = calculatePressDailyInterest("20.000,00", "2026-01-01", "2026-01-11");
    expect(result).toEqual({
      days: 10,
      dailyInterest: 1000,
      totalInterest: 10000,
      total: 30000,
    });
    expect(formatMoney(result!.dailyInterest)).toBe("1.000,00");
    expect(formatDateTr("2026-01-01")).toBe("01.01.2026");
  });

  it("aynı gün, ters tarih ve boş tutarda sonuç üretmez", () => {
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
    expect(daysBetween("2026-03-10", "2026-03-01")).toBe(0);
    expect(calculatePressDailyInterest("", "2026-01-01", "2026-01-11")).toBeNull();
    expect(calculatePressDailyInterest("0", "2026-01-01", "2026-01-11")).toBeNull();
    expect(calculatePressDailyInterest("100", "2026-01-11", "2026-01-01")).toBeNull();
  });

  it("icra yasal faiz tablosundan bağımsızdır", () => {
    const result = calculatePressDailyInterest("10000", "2026-08-01", "2026-09-01");
    expect(result?.days).toBe(31);
    expect(result?.totalInterest).toBe(15500);
    expect(result?.totalInterest).not.toBe(263.29);
  });
});
