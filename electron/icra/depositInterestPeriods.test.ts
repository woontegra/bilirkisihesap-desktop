import { describe, expect, it } from "vitest";
import { buildMonthList, buildRatePeriods } from "./depositInterestPeriods";

describe("icra deposit interest periods", () => {
  it("splits a range across monthly TCMB rows like the SaaS controller", () => {
    const months = buildMonthList("2024-12-15", "2025-01-10");
    expect(months).toEqual(["2024-12", "2025-01"]);

    const periods = buildRatePeriods(
      [
        { period: "2024-12", startDate: "2024-12-01", endDate: "2024-12-31", rate: 50 },
        { period: "2025-01", startDate: "2025-01-01", endDate: "2025-01-31", rate: 48 },
      ],
      "2024-12-15",
      "2025-01-10",
    );

    expect(periods).toEqual([
      {
        startDate: "2024-12-15",
        endDate: "2024-12-31",
        days: 17,
        rate: 50,
        source: "TCMB_EVDS",
        currency: "TRY",
        maturity: "ONE_YEAR_OR_LESS",
      },
      {
        startDate: "2025-01-01",
        endDate: "2025-01-10",
        days: 10,
        rate: 48,
        source: "TCMB_EVDS",
        currency: "TRY",
        maturity: "ONE_YEAR_OR_LESS",
      },
    ]);
  });
});
