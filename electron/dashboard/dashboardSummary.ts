import type { DashboardSummary, DesktopLicenseStatus } from "../../shared/desktop-contract";
import { LICENSE_PRODUCT_NAME } from "../../shared/desktop-contract";
import { listCalculationRecords } from "../db/calculationRecordsRepository";
import { getSetting, setSetting } from "../db/settingsRepository";
import { remainingDays } from "../license/licensePolicy";
import {
  buildMonthlyCounts,
  buildTypeDistribution,
  countCurrentMonth,
  toRecentRecord,
} from "./dashboardAggregation";

export const DASHBOARD_LAST_USED_KEY = "dashboard-last-used-at";

const STATE_LABELS: Record<DesktopLicenseStatus["state"], string> = {
  active: "Aktif",
  inactive: "Pasif",
  unknown: "Bilinmiyor",
  expired: "Süresi doldu",
  revoked: "İptal",
  device_limit: "Cihaz limiti",
  invalid_product: "Geçersiz ürün",
  unreachable: "Sunucuya ulaşılamadı",
  offline_expired: "Çevrimdışı süre doldu",
  clock_anomaly: "Saat tutarsızlığı",
  pending: "Beklemede",
};

export function getDashboardSummary(license: DesktopLicenseStatus, now = new Date()): DashboardSummary {
  const previousUsed = getSetting(DASHBOARD_LAST_USED_KEY)?.value ?? null;
  const records = listCalculationRecords();
  const dates = records.map((row) => row.createdAt);
  const latest = records[0] ?? null;

  setSetting(DASHBOARD_LAST_USED_KEY, now.toISOString());

  return {
    totalCalculations: records.length,
    currentMonthCalculations: countCurrentMonth(dates, now),
    lastUsedAt: previousUsed,
    latestRecord: latest ? { title: latest.title } : null,
    typeDistribution: buildTypeDistribution(records.map((row) => row.calculationType)),
    monthlyCounts: buildMonthlyCounts(dates, now),
    createdAtDates: dates,
    recentRecords: records.slice(0, 10).map(toRecentRecord),
    licenseSummary: {
      state: license.state,
      stateLabel: STATE_LABELS[license.state],
      planLabel: license.planLabel,
      productCode: license.productCode,
      productName: license.productCode ? LICENSE_PRODUCT_NAME : null,
      expiresAt: license.expiresAt,
      remainingDays: remainingDays(license.expiresAt, now.getTime()),
      lastSuccessfulValidationAt: license.lastSuccessfulValidationAt,
      offlineGraceUntil: license.offlineGraceUntil,
      isOfflineGrace: license.isOfflineGrace,
      maxDevices: license.maxDevices,
      isMock: license.isMock,
    },
  };
}
