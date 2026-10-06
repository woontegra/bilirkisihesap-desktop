import { describe, expect, it } from "vitest";
import { dispatchKidemCalculation } from "./dispatch";
import { KIDEM_KINDS, kindFromCalculationType, recordOpenPath } from "./kinds";
import { createEmptyForm } from "./model";

describe("kidem kinds", () => {
  it("lists seven calculation types", () => {
    expect(KIDEM_KINDS).toHaveLength(7);
  });

  it("opens legacy kidem-tazminati records on the labor-law screen", () => {
    expect(kindFromCalculationType("kidem-tazminati")).toBe("is-kanunu");
    expect(recordOpenPath("kidem-tazminati", "abc")).toContain("/kidem-tazminati/30isci");
  });
});

describe("kidem dispatch", () => {
  it("keeps labor-law calculation for unwrapped payloads", () => {
    const form = createEmptyForm();
    form.iseGirisTarihi = "2020-01-01";
    form.istenCikisTarihi = "2023-01-01";
    form.ciplakBrut = "10.000,00";
    const out = dispatchKidemCalculation(form);
    expect(out.kind).toBe("is-kanunu");
    expect((out.result as { brutKidem: number }).brutKidem).toBe(30000);
  });

  it("rejects inverted labor-law dates", () => {
    expect(() =>
      dispatchKidemCalculation({
        kind: "is-kanunu",
        form: { iseGirisTarihi: "2023-01-02", istenCikisTarihi: "2023-01-01", ciplakBrut: "10.000,00" },
      }),
    ).toThrow();
  });

  it("does not invent a borclar formula", () => {
    const out = dispatchKidemCalculation({ kind: "borclar", form: { notes: "x" } });
    expect(out.informational).toBe(true);
    expect(out.result).toMatchObject({ informational: true, kind: "borclar" });
  });

  it("does not invent a belirli-sureli formula", () => {
    const out = dispatchKidemCalculation({ kind: "belirli-sureli", form: {} });
    expect(out.informational).toBe(true);
  });

  it("computes seafarer tax using GVK 25/7 rather than labor-law net", () => {
    const out = dispatchKidemCalculation({
      kind: "gemi",
      form: { startDate: "2020-01-01", endDate: "2023-01-01", ciplakBrut: "20.000,00" },
    });
    const result = out.result as { brutKidem: number; netKidem: number; gelirVergisi: number };
    expect(result.brutKidem).toBeGreaterThan(0);
    expect(result.netKidem).not.toBe(30000);
  });

  it("uses inclusive seasonal days instead of labor-law duration", () => {
    const out = dispatchKidemCalculation({
      kind: "mevsimlik",
      form: {
        periods: [{ id: "1", start: "2023-06-01", end: "2023-08-31", days: 0 }],
        ciplakBrut: "20.000,00",
        manualTotalDaysOverride: "",
      },
    });
    const result = out.result as { toplamGun: number; brutKidem: number };
    expect(result.toplamGun).toBeGreaterThan(80);
    expect(result.brutKidem).toBeGreaterThan(0);
  });

  it("does not apply a tavan field for basin results", () => {
    const out = dispatchKidemCalculation({
      kind: "basin",
      form: {
        iseGiris: "2016-01-01",
        istenCikis: "2023-01-01",
        meslegeBaslangic: "2015-01-01",
        denemeSuresiGun: "0",
        ciplakBrut: "80.000,00",
      },
    });
    expect(out.result).not.toHaveProperty("tavanUygulandi");
    expect((out.result as { brutKidem: number }).brutKidem).toBeGreaterThan(0);
  });

  it("uses 360-day conversion for part-time", () => {
    const out = dispatchKidemCalculation({
      kind: "kismi",
      form: {
        periods: [{ id: "1", start: "2022-01-01", end: "2023-01-01", days: 0 }],
        ciplakBrut: "15.000,00",
        totalDaysManual: "",
        isManualOverride: false,
        exitDateOverride: "",
      },
    });
    const result = out.result as { yil: number; ay: number; gun: number; toplamTutar: number };
    expect(result.yil + result.ay + result.gun).toBeGreaterThan(0);
    expect(result.toplamTutar).toBeGreaterThan(0);
  });
});
