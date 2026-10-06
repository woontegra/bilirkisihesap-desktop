import { describe, expect, it } from "vitest";
import { calcDurationParts, computeIsKanunuResult, DAMGA_ORAN } from "./engine";
import { findTavanForIsoDate } from "./tavanData";
import { formatMoney, parseMoneyInput, round2 } from "./money";
import { createEmptyForm } from "./model";

describe("kidem duration", () => {
  it("uses calendar Y/M/D without counting the end day as extra", () => {
    expect(calcDurationParts("2020-01-01", "2023-01-01")).toEqual({ years: 3, months: 0, days: 0 });
    expect(calcDurationParts("2020-01-15", "2023-03-10")).toEqual({ years: 3, months: 1, days: 23 });
  });

  it("handles month-end and leap year February", () => {
    expect(calcDurationParts("2020-03-31", "2020-05-01")).toEqual({ years: 0, months: 1, days: 0 });
    expect(calcDurationParts("2019-02-28", "2020-02-28")).toEqual({ years: 1, months: 0, days: 0 });
  });

  it("rejects inverted range and same-day is zero duration", () => {
    expect(calcDurationParts("2023-01-02", "2023-01-01")).toBeNull();
    expect(calcDurationParts("2023-05-05", "2023-05-05")).toEqual({ years: 0, months: 0, days: 0 });
  });
});

describe("kidem tavan", () => {
  it("selects period by exit date including known gap", () => {
    expect(findTavanForIsoDate("2024-03-15")).toBe(35058.58);
    expect(findTavanForIsoDate("2024-07-01")).toBe(41828.42);
    expect(findTavanForIsoDate("2011-08-01")).toBeNull();
    expect(findTavanForIsoDate("1999-01-01")).toBeNull();
  });
});

describe("kidem money and tax", () => {
  it("parses TR money and rounds at the same stages as the SaaS engine", () => {
    expect(parseMoneyInput("30.000,50")).toBe(30000.5);
    expect(formatMoney(125450.75)).toBe("125.450,75");
    const form = createEmptyForm();
    form.iseGirisTarihi = "2020-01-01";
    form.istenCikisTarihi = "2023-01-01";
    form.ciplakBrut = "10.000,00";
    const result = computeIsKanunuResult(form);
    expect(result.brutKidem).toBe(30000);
    expect(result.damgaVergisi).toBe(round2(result.brutKidem * DAMGA_ORAN));
    expect(result.netKidem).toBe(round2(result.brutKidem - result.damgaVergisi));
  });

  it("applies tavan when dressed wage exceeds period cap", () => {
    const form = createEmptyForm();
    form.iseGirisTarihi = "2023-01-01";
    form.istenCikisTarihi = "2024-03-01";
    form.ciplakBrut = "80.000,00";
    const result = computeIsKanunuResult(form);
    expect(result.tavanApplied).toBe(true);
    expect(result.tavan).toBe(35058.58);
    expect(result.esasAylik).toBe(35058.58);
  });

  it("includes extras in dressed wage", () => {
    const form = createEmptyForm();
    form.iseGirisTarihi = "2022-01-01";
    form.istenCikisTarihi = "2023-01-01";
    form.ciplakBrut = "10.000,00";
    form.prim = "1.000,00";
    form.extras = [{ id: "1", name: "Aidat", value: "500,00" }];
    const result = computeIsKanunuResult(form);
    expect(result.giydirilmisAylik).toBe(11500);
    expect(result.tavanApplied).toBe(false);
    expect(result.brutKidem).toBe(11500);
  });

  it("returns empty result for missing dates and wage", () => {
    const result = computeIsKanunuResult(createEmptyForm());
    expect(result.brutKidem).toBe(0);
    expect(result.duration).toBeNull();
  });
});
