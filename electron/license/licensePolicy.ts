import type { DesktopLicenseStatus, LicenseState } from "../../shared/desktop-contract";

/** Woontegra Lisans Server `config.offlineGraceDays`. */
export const DEFAULT_OFFLINE_GRACE_DAYS = 7;

const CLOCK_SKEW_MS = 5 * 60 * 1000;

export function maskLicenseKey(licenseKey: string): string {
  const normalized = licenseKey.trim().toUpperCase();
  if (normalized.length <= 8) {
    return "••••";
  }
  return `${normalized.slice(0, 7)}••••${normalized.slice(-4)}`;
}

export function mapServerMessageToState(message: string | undefined): LicenseState | null {
  const text = (message ?? "").toLocaleLowerCase("tr-TR");
  if (!text) {
    return null;
  }
  if (text.includes("program kodu eşleşmiyor") || text.includes("işletim sisteminde kullanılamaz")) {
    return "invalid_product";
  }
  if (text.includes("cihaz limiti")) {
    return "device_limit";
  }
  if (text.includes("süresi dolmuş")) {
    return "expired";
  }
  if (text.includes("iptal edilmiş") || text.includes("pasif durumda")) {
    return "revoked";
  }
  if (text.includes("cihaz kayıtlı değil") || text.includes("lisans bulunamadı")) {
    return "pending";
  }
  return null;
}

export function addDaysIso(fromIso: string, days: number): string {
  const date = new Date(fromIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function isExpiredAt(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) {
    return false;
  }
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) {
    return false;
  }
  return expiresMs < nowMs;
}

export function detectClockAnomaly(lastSeenAt: string | null | undefined, nowMs: number): boolean {
  if (!lastSeenAt) {
    return false;
  }
  const lastMs = Date.parse(lastSeenAt);
  if (Number.isNaN(lastMs)) {
    return false;
  }
  return nowMs + CLOCK_SKEW_MS < lastMs;
}

export function remainingDays(expiresAt: string | null | undefined, nowMs: number): number | null {
  if (!expiresAt) {
    return null;
  }
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) {
    return null;
  }
  return Math.ceil((expiresMs - nowMs) / (24 * 60 * 60 * 1000));
}

export function userMessageForState(state: LicenseState, serverMessage?: string): string {
  if (serverMessage?.trim()) {
    return serverMessage.trim();
  }
  switch (state) {
    case "active":
      return "Lisansınız başarıyla etkinleştirildi.";
    case "expired":
      return "Bu lisansın kullanım süresi sona ermiş.";
    case "device_limit":
      return "Bu lisans için cihaz sınırına ulaşılmış.";
    case "invalid_product":
      return "Bu lisans Bilirkişi Hesap Masaüstü için geçerli değil.";
    case "unreachable":
      return "Lisans sunucusuna şu anda ulaşılamıyor.";
    case "offline_expired":
      return "Çevrimdışı kullanım süresi doldu. İnternet bağlantısı ile yeniden doğrulama gerekli.";
    case "revoked":
      return "Lisans pasif veya bu cihazın erişimi iptal edilmiş.";
    case "clock_anomaly":
      return "Sistem saati geriye alınmış görünüyor. Lisans doğrulaması durduruldu.";
    case "pending":
      return "Lisans aktivasyonu bekleniyor.";
    default:
      return "Lisans durumu belirlenemedi.";
  }
}

export function buildStatus(
  partial: Omit<DesktopLicenseStatus, "canWriteRecords" | "canReadRecords">,
): DesktopLicenseStatus {
  return {
    ...partial,
    canReadRecords: true,
    canWriteRecords: partial.isMock || partial.state === "active",
  };
}
