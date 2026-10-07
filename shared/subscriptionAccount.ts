/**
 * Masaüstü lisans bilgisi ekranı.
 * Fiyat yalnız public ürün yanıtındaki windowsPriceYearly / macosPriceYearly alanından okunur.
 * Web abonelik price / priceMonthly kullanılmaz. Yenileme token’ı üretilmez.
 */

export type DesktopEntitlementPlatform = "WINDOWS" | "MACOS";

export type DesktopLicenseKind = "trial" | "paid" | "other";

export type SubscriptionOption = {
  productType: string;
  period: "yearly";
  label: string;
  normalPrice: number;
  licenseDays: number | null;
  maxDevices: number | null;
  currency: "TRY";
};

export type DesktopSubscriptionCatalog = {
  licenseKind: DesktopLicenseKind;
  platform: DesktopEntitlementPlatform | null;
  startsAt: string | null;
  options: SubscriptionOption[];
  message: string | null;
  loadError: string | null;
};

export type SubscriptionProgress = {
  hasSubscription: boolean;
  totalDays: number;
  daysUsed: number;
  daysRemaining: number;
  remainingPct: number;
};

export const TRIAL_PURCHASE_LABEL = "Profesyonel Lisansa Geç";
export const TRIAL_PURCHASE_HINT =
  "Bilirkişi Hesap ödeme sayfasına yönlendirileceksiniz. Paket, deneme cihazına bağlı satın alma bağlantısından gelir.";
export const PAID_RENEWAL_NOTICE = "Yenileme mevcut lisansın süresini uzatır. Yeni bir lisans oluşturulmaz.";
export const RENEW_LABEL = "Lisansı Yenile";
export const CONTACT_LABEL = "İletişime Geç";

const DAY_MS = 86_400_000;
const SITE_HOSTS = new Set(["woontegra.com", "www.woontegra.com"]);
const PRODUCT_PATH = "/yazilimlar/bilirkisi-hesap";
const FIRST_PURCHASE_PATH = "/yazilimlar/bilirkisi-hesap/satin-al";
const CONTACT_PATH = "/iletisim";

export function emptySubscriptionCatalog(
  patch: Partial<DesktopSubscriptionCatalog> = {},
): DesktopSubscriptionCatalog {
  return {
    licenseKind: "other",
    platform: null,
    startsAt: null,
    options: [],
    message: null,
    loadError: null,
    ...patch,
  };
}

export function subscriptionPrimaryAction(kind: DesktopLicenseKind): "purchase" | "renew" | "none" {
  if (kind === "trial") return "purchase";
  if (kind === "paid") return "renew";
  return "none";
}

export function buildDesktopRenewalUrl(websiteBase: string, renewalToken: string, platform: DesktopEntitlementPlatform): string | null {
  const token = renewalToken.trim();
  if (!token || token.includes("licenseKey") || token.includes("deviceHash")) return null;
  let url: URL;
  try {
    url = new URL(`${websiteBase.replace(/\/$/, "")}${FIRST_PURCHASE_PATH}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.search = "";
  url.searchParams.set("renewalToken", token);
  url.searchParams.set("platform", platform);
  return url.toString();
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function unwrapProduct(payload: unknown): Record<string, unknown> {
  let current = asRecord(payload);
  for (let depth = 0; depth < 3; depth += 1) {
    const data = asRecord(current.data);
    if (Object.keys(data).length === 0) break;
    current = data;
  }
  return current;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function kurusToTl(value: unknown): number | null {
  const amount = asFiniteNumber(value);
  if (amount === null || amount < 0) return null;
  return amount / 100;
}

function asDateText(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  return Number.isNaN(Date.parse(text)) ? null : text;
}

function asWholeDays(value: unknown): number | null {
  const amount = asFiniteNumber(value);
  if (amount === null || !Number.isInteger(amount) || amount < 1) return null;
  return amount;
}

export function calculateRemainingDays(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const remainingMs = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(remainingMs)) return null;
  return Math.max(0, Math.ceil(remainingMs / DAY_MS));
}

export function buildSubscriptionProgress(
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date(),
): SubscriptionProgress | null {
  if (!startsAt || !endsAt) return null;
  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || Number.isNaN(now.getTime())) {
    return null;
  }
  const totalMs = endDate.getTime() - startDate.getTime();
  const totalDays = Math.max(1, Math.round(totalMs / DAY_MS));
  const remainingMs = endDate.getTime() - now.getTime();
  const daysRemaining =
    remainingMs <= 0 ? 0 : Math.min(totalDays, Math.max(0, Math.ceil(remainingMs / DAY_MS)));
  const daysUsed = Math.min(totalDays, Math.max(0, totalDays - daysRemaining));
  const remainingPct = Math.min(100, Math.max(0, (daysRemaining / totalDays) * 100));
  return { hasSubscription: true, totalDays, daysUsed, daysRemaining, remainingPct };
}

function platformPrefix(platform: DesktopEntitlementPlatform): "windows" | "macos" {
  return platform === "WINDOWS" ? "windows" : "macos";
}

/**
 * Public BH ürün yanıtından yalnız bu platformun yıllık masaüstü fiyatını alır.
 * `price` ve `priceMonthly` yok sayılır. Aylık masaüstü paketi okunmaz.
 */
export function parseDesktopSubscriptionProduct(
  payload: unknown,
  platform: DesktopEntitlementPlatform | null,
): Pick<DesktopSubscriptionCatalog, "startsAt" | "options" | "message"> {
  const product = unwrapProduct(payload);
  const startsAt = asDateText(product.licenseStartsAt) ?? asDateText(product.subscriptionStartsAt);
  const message = asText(product.message);
  if (!platform) return { startsAt, options: [], message };
  const prefix = platformPrefix(platform);
  const normalPrice = kurusToTl(product[`${prefix}PriceYearly`]);
  if (normalPrice === null) return { startsAt, options: [], message };
  const licenseDays = asWholeDays(product[`${prefix}LicenseDays`]);
  const maxDevices = asWholeDays(product[`${prefix}DeviceLimit`]);
  const suppliedLabel = asText(product[`${prefix}PriceLabel`]);
  return {
    startsAt,
    message,
    options: [
      {
        productType: `${prefix}-yearly`,
        period: "yearly",
        label: suppliedLabel ?? (licenseDays ? `Yıllık Profesyonel · ${licenseDays} gün` : "Yıllık Profesyonel"),
        normalPrice,
        licenseDays,
        maxDevices,
        currency: "TRY",
      },
    ],
  };
}

function sameSite(url: URL, base: URL): boolean {
  if (SITE_HOSTS.has(url.hostname) && SITE_HOSTS.has(base.hostname)) return true;
  return url.hostname === base.hostname;
}

function isLoopbackHttp(url: URL): boolean {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

function allowsProductPurchaseOrigin(url: URL, base: URL): boolean {
  if (isLoopbackHttp(url) && isLoopbackHttp(base) && url.host === base.host) return true;
  return url.protocol === "https:" && base.protocol === "https:" && sameSite(url, base);
}

export function selectPurchaseWebsiteBase(
  development: boolean,
  devBase: string | null | undefined,
  productionBase: string,
): string | null {
  const local = devBase?.trim().replace(/\/$/, "") || "";
  if (development) return local || null;
  return productionBase.replace(/\/$/, "");
}

export function buildDesktopProductPurchaseUrl(
  websiteBase: string,
  platform: DesktopEntitlementPlatform,
): string | null {
  let base: URL;
  try {
    base = new URL(websiteBase);
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && !isLoopbackHttp(base)) return null;
  const url = new URL(PRODUCT_PATH, base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("platform", platform === "MACOS" ? "macos" : "windows");
  return acceptDesktopProductPurchaseUrl(url.toString(), websiteBase);
}

export function acceptDesktopProductPurchaseUrl(raw: string, websiteBase: string): string | null {
  let url: URL;
  let base: URL;
  try {
    url = new URL(raw);
    base = new URL(websiteBase);
  } catch {
    return null;
  }
  if (!allowsProductPurchaseOrigin(url, base)) return null;
  if (url.pathname !== PRODUCT_PATH) return null;
  const platform = (url.searchParams.get("platform") || "").toLowerCase();
  if (platform !== "windows" && platform !== "macos") return null;
  for (const key of url.searchParams.keys()) {
    if (key !== "platform") return null;
  }
  return url.toString();
}

export function buildDesktopPurchaseTokenUrl(websiteBase: string, purchaseToken: string): string | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(purchaseToken) || purchaseToken.includes("@") || /^[a-fA-F0-9]{64}$/.test(purchaseToken)) {
    return null;
  }
  let base: URL;
  try {
    base = new URL(websiteBase);
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && !isLoopbackHttp(base)) return null;
  const url = new URL(FIRST_PURCHASE_PATH, base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("purchaseToken", purchaseToken);
  return acceptDesktopPurchaseTokenUrl(url.toString(), websiteBase);
}

export function acceptDesktopPurchaseTokenUrl(raw: string, websiteBase: string): string | null {
  let url: URL;
  let base: URL;
  try {
    url = new URL(raw);
    base = new URL(websiteBase);
  } catch {
    return null;
  }
  if (!allowsProductPurchaseOrigin(url, base)) return null;
  if (url.pathname !== FIRST_PURCHASE_PATH) return null;
  const token = url.searchParams.get("purchaseToken") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  for (const key of url.searchParams.keys()) {
    if (key !== "purchaseToken") return null;
  }
  if (
    url.searchParams.has("renew") ||
    url.searchParams.has("renewalToken") ||
    url.searchParams.has("plan") ||
    url.searchParams.has("platform") ||
    url.searchParams.has("email") ||
    url.searchParams.has("deviceHash")
  ) {
    return null;
  }
  return url.toString();
}

export function buildDesktopContactUrl(websiteBase: string): string | null {
  let base: URL;
  try {
    base = new URL(websiteBase);
  } catch {
    return null;
  }
  if (base.protocol !== "https:") return null;
  const url = new URL(CONTACT_PATH, base);
  url.search = "";
  return acceptDesktopContactUrl(url.toString(), websiteBase);
}

export function acceptDesktopContactUrl(raw: string, websiteBase: string): string | null {
  let url: URL;
  let base: URL;
  try {
    url = new URL(raw);
    base = new URL(websiteBase);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || base.protocol !== "https:" || !sameSite(url, base)) return null;
  if (url.pathname !== CONTACT_PATH) return null;
  if (url.search) return null;
  return url.toString();
}

export function formatSubscriptionDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatSubscriptionMoney(value: number | null, currency: string): string {
  if (value === null) return "—";
  const normalized = currency.toUpperCase() === "TL" ? "TRY" : currency.toUpperCase();
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: normalized,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  }
}

export function platformLabel(platform: DesktopEntitlementPlatform | null): string {
  if (platform === "WINDOWS") return "Windows";
  if (platform === "MACOS") return "macOS";
  return "—";
}
