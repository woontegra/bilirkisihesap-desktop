import type { LicenseState } from "../../shared/desktop-contract";

/** Hesap ekranları yalnız sunucunun ACTIVE saydığı durumda açılır. Çevrimdışı süre de state=active kalır. */
export function canEnterLicensedApp(status: { state: LicenseState } | null | undefined): boolean {
  return status?.state === "active";
}

export function isProtectedCalculationStorageKey(key: string): boolean {
  return (
    key.startsWith("bilirkisi-hesap-") ||
    key.startsWith("bilirkisi-desktop:case-") ||
    key.startsWith("puantaj_fm_templates") ||
    key.startsWith("puantaj_smart_import") ||
    key.startsWith("aktuerya:manual-wage-template")
  );
}

export function licensedLocalWriteDecision(allowed: boolean, key: string): "allow" | "block" {
  if (!allowed && isProtectedCalculationStorageKey(key)) {
    return "block";
  }
  return "allow";
}
