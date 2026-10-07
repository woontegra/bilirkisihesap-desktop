import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acceptDesktopContactUrl,
  acceptDesktopProductPurchaseUrl,
  acceptDesktopPurchaseTokenUrl,
  buildDesktopContactUrl,
  buildDesktopProductPurchaseUrl,
  buildDesktopPurchaseTokenUrl,
  parseDesktopSubscriptionProduct,
  selectPurchaseWebsiteBase,
  subscriptionPrimaryAction,
  PAID_RENEWAL_NOTICE,
  TRIAL_PURCHASE_LABEL,
} from "../../shared/subscriptionAccount";

const SAAS_PRODUCT = {
  success: true,
  data: {
    name: "Bilirkişi Hesaplama Yazılımı",
    price: 2_000_000,
    priceMonthly: 200_000,
    originalPrice: 2_500_000,
  },
};

describe("parseDesktopSubscriptionProduct", () => {
  it("ignores SaaS 20.000 and 2.000 prices", () => {
    expect(parseDesktopSubscriptionProduct(SAAS_PRODUCT, "WINDOWS").options).toEqual([]);
    expect(parseDesktopSubscriptionProduct(SAAS_PRODUCT, "MACOS").options).toEqual([]);
  });

  it("shows only the Windows yearly desktop price", () => {
    const parsed = parseDesktopSubscriptionProduct(
      {
        data: {
          price: 2_000_000,
          priceMonthly: 200_000,
          windowsPriceYearly: 1_500_000,
          windowsLicenseDays: 365,
          windowsDeviceLimit: 1,
          macosPriceYearly: 1_500_000,
          windowsPriceMonthly: 200_000,
        },
      },
      "WINDOWS",
    );
    expect(parsed.options).toHaveLength(1);
    expect(parsed.options[0]).toMatchObject({
      productType: "windows-yearly",
      period: "yearly",
      normalPrice: 15_000,
      licenseDays: 365,
      maxDevices: 1,
    });
  });

  it("shows only the macOS yearly desktop price", () => {
    const parsed = parseDesktopSubscriptionProduct(
      {
        data: {
          windowsPriceYearly: 1_500_000,
          macosPriceYearly: 1_500_000,
          macosLicenseDays: 365,
        },
      },
      "MACOS",
    );
    expect(parsed.options[0]?.productType).toBe("macos-yearly");
    expect(parsed.options[0]?.normalPrice).toBe(15_000);
    expect(parsed.options[0]?.licenseDays).toBe(365);
  });
});

describe("license actions", () => {
  it("sends a trial user to first purchase and a paid user to renewal", () => {
    expect(subscriptionPrimaryAction("trial")).toBe("purchase");
    expect(subscriptionPrimaryAction("paid")).toBe("renew");
    expect(subscriptionPrimaryAction("other")).toBe("none");
    expect(TRIAL_PURCHASE_LABEL).toBe("Profesyonel Lisansa Geç");
    expect(PAID_RENEWAL_NOTICE).toContain("mevcut lisans");
  });
});

describe("product page purchase urls", () => {
  const base = "https://www.woontegra.com";

  it("opens the local website dev server in development and keeps production on woontegra.com", () => {
    const production = "https://www.woontegra.com";
    const local = "http://localhost:5174";
    expect(selectPurchaseWebsiteBase(true, local, production)).toBe(local);
    expect(selectPurchaseWebsiteBase(false, local, production)).toBe(production);
    expect(selectPurchaseWebsiteBase(true, "", production)).toBeNull();
    expect(selectPurchaseWebsiteBase(true, "  ", production)).toBeNull();
    expect(selectPurchaseWebsiteBase(false, "", production)).toBe(production);
    expect(buildDesktopProductPurchaseUrl(local, "WINDOWS")).toBe(
      "http://localhost:5174/yazilimlar/bilirkisi-hesap?platform=windows",
    );
    expect(buildDesktopProductPurchaseUrl(local, "MACOS")).toBe(
      "http://localhost:5174/yazilimlar/bilirkisi-hesap?platform=macos",
    );
    expect(buildDesktopProductPurchaseUrl("http://evil.example", "WINDOWS")).toBeNull();
    expect(buildDesktopProductPurchaseUrl("http://localhost:5174.evil.example", "WINDOWS")).toBeNull();
  });

  it("opens the product page Windows purchase and the macOS purchase on the same page", () => {
    expect(buildDesktopProductPurchaseUrl(base, "WINDOWS")).toBe(
      "https://www.woontegra.com/yazilimlar/bilirkisi-hesap?platform=windows",
    );
    expect(buildDesktopProductPurchaseUrl(base, "MACOS")).toBe(
      "https://www.woontegra.com/yazilimlar/bilirkisi-hesap?platform=macos",
    );
  });

  it("does not attach a purchase token, email, or device hash", () => {
    const url = buildDesktopProductPurchaseUrl(base, "WINDOWS");
    expect(url).not.toContain("purchaseToken");
    expect(url).not.toContain("email");
    expect(url).not.toContain("deviceHash");
    expect(url).not.toContain("satin-al");
    expect(
      acceptDesktopProductPurchaseUrl(
        "https://www.woontegra.com/yazilimlar/bilirkisi-hesap?platform=windows&purchaseToken=abc",
        base,
      ),
    ).toBeNull();
    expect(
      acceptDesktopProductPurchaseUrl(
        "https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?platform=WINDOWS",
        base,
      ),
    ).toBeNull();
  });
});

describe("first purchase and contact urls", () => {
  const base = "https://www.woontegra.com";
  const token = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

  it("opens the local checkout with only the opaque purchase token", () => {
    const local = "http://localhost:5174";
    const url = buildDesktopPurchaseTokenUrl(local, token);
    expect(url).toBe(
      "http://localhost:5174/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
    );
    expect(url).not.toContain("platform=");
    expect(url).not.toContain("email");
    expect(url).not.toContain("deviceHash");
    expect(buildDesktopPurchaseTokenUrl("http://evil.example", token)).toBeNull();
    expect(
      acceptDesktopPurchaseTokenUrl(
        `http://127.0.0.1:5174/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=${token}`,
        local,
      ),
    ).toBeNull();
  });

  it("opens checkout with only the opaque purchase token", () => {
    const url = buildDesktopPurchaseTokenUrl(base, token);
    expect(url).toBe(
      "https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ",
    );
    expect(url).not.toContain("email");
    expect(url).not.toContain("deviceHash");
    expect(url).not.toContain("platform=");
    expect(url).not.toContain("renew");
    expect(url).not.toContain("plan=");
  });

  it("rejects email, device hash, renewal and platform query values", () => {
    expect(buildDesktopPurchaseTokenUrl(base, "user@example.com")).toBeNull();
    expect(buildDesktopPurchaseTokenUrl(base, "a".repeat(64))).toBeNull();
    expect(
      acceptDesktopPurchaseTokenUrl(
        `https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=${token}&email=user@example.com`,
        base,
      ),
    ).toBeNull();
    expect(
      acceptDesktopPurchaseTokenUrl(
        `https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=${token}&deviceHash=${"ab".repeat(32)}`,
        base,
      ),
    ).toBeNull();
    expect(
      acceptDesktopPurchaseTokenUrl(
        `https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?purchaseToken=${token}&renewalToken=abc`,
        base,
      ),
    ).toBeNull();
    expect(
      acceptDesktopPurchaseTokenUrl(
        "https://www.woontegra.com/yazilimlar/bilirkisi-hesap/satin-al?platform=WINDOWS",
        base,
      ),
    ).toBeNull();
    expect(
      acceptDesktopPurchaseTokenUrl(
        "https://www.woontegra.com/api/public/desktop-license/renewal-link?purchaseToken=" + token,
        base,
      ),
    ).toBeNull();
  });

  it("keeps first purchase on purchase-token and paid renewal on the existing renewal link", () => {
    const opener = readFileSync("electron/license/subscriptionCatalog.ts", "utf8");
    const purchase = opener.slice(
      opener.indexOf("export async function openDesktopFirstPurchase"),
      opener.indexOf("export async function openDesktopRenewal"),
    );
    expect(purchase).not.toContain("renewal-link");
    expect(purchase).not.toContain("renewalToken");
    expect(opener).toContain("renewal-link");
    expect(opener).not.toContain("startSubscriptionRenewal");
    expect(opener).not.toContain("Aboneliği Uzat");
    expect(opener).toContain('"/purchase-token"');
    expect(opener).toContain("buildDesktopPurchaseTokenUrl");
    expect(opener).toContain("deviceHash");
    expect(opener).not.toContain("buildDesktopProductPurchaseUrl");
    expect(opener).not.toContain("?platform=");
    const panel = readFileSync("src/license/SubscriptionAccountPanel.tsx", "utf8");
    expect(panel).toContain("Yıllık Profesyonel Lisans");
    expect(panel).toContain("TRIAL_PURCHASE_LABEL");
    expect(panel).not.toContain("Yıllık masaüstü paketi bu ürün yanıtında yok");
    expect(panel).not.toContain("Yıllık Profesyonel paket");
    expect(panel).toContain('catalog?.licenseKind === "trial"');
    const client = readFileSync("electron/license/centralLicenseClient.ts", "utf8");
    const store = readFileSync("electron/license/licenseStore.ts", "utf8");
    expect(client).not.toContain("localStorage.clear");
    expect(client).not.toContain("DELETE FROM");
    expect(store).not.toContain("localStorage.clear");
    expect(store).not.toContain("DELETE FROM");
  });

  it("uses the site contact page and nothing else", () => {
    expect(buildDesktopContactUrl(base)).toBe("https://www.woontegra.com/iletisim");
    expect(acceptDesktopContactUrl("https://www.woontegra.com/iletisim?wa=1", base)).toBeNull();
    expect(acceptDesktopContactUrl("https://example.com/iletisim", base)).toBeNull();
  });
});
