import { beforeEach, describe, expect, it } from "vitest";
import { applyManualWagePeriodsToRowBruts } from "@/features/manual-brut-wage/manualBrutApply";
import {
  addTemplate,
  deleteTemplate,
  loadTemplatesSafe,
  updateTemplate,
} from "./storage";

function installMemoryStorage(): void {
  const bag = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => bag.get(key) ?? null,
        setItem: (key: string, value: string) => {
          bag.set(key, value);
        },
        removeItem: (key: string) => {
          bag.delete(key);
        },
      },
    },
  });
}

const PERIOD_KEY = "2024-01-01_2024-12-31";

describe("manuel brüt yerel şablonlar", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("adsız veya taban altı kaydı reddeder", () => {
    expect(addTemplate("   ", { [PERIOD_KEY]: 25000 })).toBeNull();
    expect(addTemplate("Test", { [PERIOD_KEY]: 100 })).toBeNull();
    expect(loadTemplatesSafe().templates).toEqual([]);
  });

  it("kaydeder, yeniden okur, günceller ve siler", () => {
    const created = addTemplate("Parite testi", { [PERIOD_KEY]: 25000 });
    expect(created?.name).toBe("Parite testi");
    expect(loadTemplatesSafe().templates).toHaveLength(1);
    expect(loadTemplatesSafe().templates[0]?.periods[PERIOD_KEY]).toBe(25000);

    expect(updateTemplate(created!.id, "Parite testi güncel", { [PERIOD_KEY]: 26000 })).toBe(true);
    expect(loadTemplatesSafe().templates[0]?.name).toBe("Parite testi güncel");
    expect(loadTemplatesSafe().templates[0]?.periods[PERIOD_KEY]).toBe(26000);

    const applied = applyManualWagePeriodsToRowBruts(loadTemplatesSafe().templates[0]!.periods, [
      { id: "row-1", startISO: "2024-06-15" },
    ]);
    expect(applied.applied).toBe(1);
    expect(applied.brutById["row-1"]).toBe(26000);

    deleteTemplate(created!.id);
    expect(loadTemplatesSafe().templates).toEqual([]);
  });
});
