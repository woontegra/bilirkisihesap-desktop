import { describe, expect, it } from "vitest";
import { buildTypeDistribution, countCurrentMonth } from "./dashboardAggregation";

describe("dashboard aggregation", () => {
  it("groups subtypes into Turkish categories", () => {
    const data = buildTypeDistribution([
      "kidem-is-kanunu",
      "kidem-gemi",
      "fazla-mesai-standart",
      "icra_takip_damga",
    ]);
    expect(data.find((row) => row.name === "Kıdem")?.value).toBe(2);
    expect(data.find((row) => row.name === "Fazla Mesai")?.value).toBe(1);
    expect(data.find((row) => row.name === "İcra Takip")?.value).toBe(1);
  });

  it("counts current month records", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    expect(
      countCurrentMonth(["2026-08-01T00:00:00.000Z", "2026-07-31T00:00:00.000Z"], now),
    ).toBe(1);
  });
});
