import { describe, expect, it } from "vitest";
import { getCaseRouteInfo } from "./caseRoutes";

describe("getCaseRouteInfo", () => {
  it("masaüstü kıdem ve icra türlerini Türkçe etiketler", () => {
    expect(getCaseRouteInfo("kidem-is-kanunu").label).toContain("İş Kanunu");
    expect(getCaseRouteInfo("kidem-is-kanunu").path).toBe("/kidem-tazminati/30isci");
    expect(getCaseRouteInfo("icra_takip_damga").supported).toBe(true);
    expect(getCaseRouteInfo("fazla-mesai-standart").path).toBe("/fazla-mesai/standart");
  });
});
