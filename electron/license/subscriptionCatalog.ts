import { shell } from "electron";
import { isDevelopmentRuntime } from "../runtime";
import {
  buildDesktopContactUrl,
  buildDesktopPurchaseTokenUrl,
  buildDesktopRenewalUrl,
  emptySubscriptionCatalog,
  parseDesktopSubscriptionProduct,
  selectPurchaseWebsiteBase,
  type DesktopLicenseKind,
  type DesktopSubscriptionCatalog,
} from "../../shared/subscriptionAccount";
import { LICENSE_APP_CODE, type IpcResult } from "../../shared/desktop-contract";
import { getEntitlementPlatform } from "./deviceHash";
import { LicenseNetworkError, licensePublicApiBase, postLicenseJson } from "./licenseApi";
import { readStoredLicense } from "./licenseStore";
import { purchaseIssueFailureMessage } from "./purchaseIssueMessage";
import type { LicenseClient } from "./LicenseClient";

const WEBSITE_BASE = (process.env.SUBSCRIPTION_WEBSITE_BASE?.trim() || "https://www.woontegra.com").replace(
  /\/$/,
  "",
);

function licenseKind(statusMock: boolean): DesktopLicenseKind {
  if (statusMock) return "other";
  const stored = readStoredLicense();
  if (stored?.kind === "trial") return "trial";
  if (stored?.licenseKey) return "paid";
  return "other";
}

async function readJson(url: string): Promise<{ ok: boolean; body: unknown }> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const body = (await response.json().catch(() => ({}))) as unknown;
  return { ok: response.ok, body };
}

export async function loadDesktopSubscriptionCatalog(
  licenseClient: LicenseClient,
): Promise<DesktopSubscriptionCatalog> {
  const status = await licenseClient.getStatus();
  const kind = licenseKind(status.isMock);
  const platform = getEntitlementPlatform();
  if (status.isMock) {
    return emptySubscriptionCatalog({ licenseKind: "other", platform });
  }
  try {
    const result = await readJson(`${WEBSITE_BASE}/api/bh/product`);
    if (!result.ok) {
      return emptySubscriptionCatalog({
        licenseKind: kind,
        platform,
        loadError: "Lisans paket bilgisi yüklenemedi.",
      });
    }
    return {
      ...emptySubscriptionCatalog({ licenseKind: kind, platform }),
      ...parseDesktopSubscriptionProduct(result.body, platform),
      loadError: null,
    };
  } catch {
    return emptySubscriptionCatalog({
      licenseKind: kind,
      platform,
      loadError: "Lisans paket bilgisi yüklenemedi.",
    });
  }
}

const LOCAL_SITE_MISSING =
  "Yerel web sitesi adresi bulunamadı. Geliştirme ortamında canlı site açılmaz.";

export async function openDesktopFirstPurchase(): Promise<IpcResult<{ message: string }>> {
  const stored = readStoredLicense();
  if (stored?.kind !== "trial") {
    return { ok: false, message: "Profesyonel lisans satın alma yalnız deneme ekranından açılır." };
  }
  const platform = getEntitlementPlatform();
  if (!platform) {
    return { ok: false, message: "Satın alma yalnız Windows veya macOS için açılır." };
  }
  const deviceHash = stored.deviceHash?.trim().toLowerCase() || "";
  if (!/^[a-f0-9]{64}$/.test(deviceHash)) {
    return { ok: false, message: "Satın alma bağlantısı oluşturulamadı." };
  }
  const purchaseBase = selectPurchaseWebsiteBase(
    isDevelopmentRuntime(),
    process.env.SUBSCRIPTION_WEBSITE_DEV_BASE,
    WEBSITE_BASE,
  );
  if (!purchaseBase) {
    return { ok: false, message: LOCAL_SITE_MISSING };
  }

  let issued: { success?: boolean; purchaseToken?: string; message?: string; error?: string };
  try {
    issued = await postLicenseJson(licensePublicApiBase(), "/purchase-token", {
      appCode: LICENSE_APP_CODE,
      deviceHash,
      platform,
    });
  } catch (error) {
    if (error instanceof LicenseNetworkError) {
      return { ok: false, message: "Satın alma bağlantısı oluşturulamadı." };
    }
    return { ok: false, message: "Satın alma bağlantısı oluşturulamadı." };
  }

  const purchaseToken = issued.purchaseToken?.trim() || "";
  if (!issued.success || !purchaseToken) {
    return { ok: false, message: purchaseIssueFailureMessage(issued) };
  }
  const url = buildDesktopPurchaseTokenUrl(purchaseBase, purchaseToken);
  if (!url || url.includes("deviceHash=") || url.includes("email=") || url.includes("platform=")) {
    return { ok: false, message: "Satın alma sayfası açılamadı." };
  }
  await shell.openExternal(url);
  return { ok: true, data: { message: "Satın alma sayfası tarayıcıda açıldı." } };
}

export async function openDesktopRenewal(): Promise<IpcResult<{ message: string }>> {
  const stored = readStoredLicense();
  if (!stored || stored.kind === "trial" || !stored.licenseKey) {
    return { ok: false, message: "Lisans yenileme yalnız ücretli lisans için açılır." };
  }
  const platform = getEntitlementPlatform();
  if (!platform) return { ok: false, message: "Yenileme yalnız Windows veya macOS için açılır." };
  const deviceHash = stored.deviceHash?.trim().toLowerCase() || "";
  if (!/^[a-f0-9]{64}$/.test(deviceHash)) return { ok: false, message: "Yenileme bağlantısı oluşturulamadı." };
  const purchaseBase = selectPurchaseWebsiteBase(
    isDevelopmentRuntime(),
    process.env.SUBSCRIPTION_WEBSITE_DEV_BASE,
    WEBSITE_BASE,
  );
  if (!purchaseBase) return { ok: false, message: LOCAL_SITE_MISSING };
  let issued: { ok?: boolean; purchaseUrl?: string; renewalToken?: string; message?: string };
  try {
    const response = await fetch(`${purchaseBase}/api/public/desktop-license/renewal-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ licenseKey: stored.licenseKey, deviceHash, appCode: LICENSE_APP_CODE }),
      signal: AbortSignal.timeout(20_000),
    });
    issued = (await response.json().catch(() => ({}))) as typeof issued;
    if (!response.ok || issued.ok === false) {
      return { ok: false, message: issued.message || "Yenileme bağlantısı oluşturulamadı." };
    }
  } catch {
    return { ok: false, message: "Yenileme bağlantısı oluşturulamadı." };
  }
  let fromUrl = "";
  try {
    fromUrl = issued.purchaseUrl ? new URL(issued.purchaseUrl).searchParams.get("renewalToken") || "" : "";
  } catch {
    fromUrl = "";
  }
  const token = issued.renewalToken?.trim() || fromUrl;
  const url = buildDesktopRenewalUrl(purchaseBase, token, platform);
  if (!url || url.includes("licenseKey=") || url.includes("deviceHash=")) {
    return { ok: false, message: "Yenileme sayfası açılamadı." };
  }
  await shell.openExternal(url);
  return { ok: true, data: { message: "Yenileme sayfası tarayıcıda açıldı." } };
}

export async function openDesktopContact(): Promise<IpcResult<{ message: string }>> {
  const url = buildDesktopContactUrl(WEBSITE_BASE);
  if (!url) return { ok: false, message: "İletişim sayfası açılamadı." };
  await shell.openExternal(url);
  return { ok: true, data: { message: "İletişim sayfası tarayıcıda açıldı." } };
}
