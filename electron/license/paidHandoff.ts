export type PaidHandoffResponse = {
  success?: boolean;
  licenseKey?: string;
  expiresAt?: string;
  maxDevices?: number;
};

export type StoredPaidLicense = {
  kind: "paid";
  licenseKey: string;
  deviceHash: string;
  expiresAt: string | null;
  lastValidatedAt: null;
  offlineGraceUntil: null;
  lastSeenAt: string;
  maxDevices: number;
  status: "ACTIVE";
};

/** purchase-handoff yanıtını yerel lisans kaydına çevirir. Deneme kaydının yerini ücretli kayıt alır. */
export function paidRecordFromHandoff(
  deviceHash: string,
  response: PaidHandoffResponse,
  now = new Date().toISOString(),
): StoredPaidLicense | null {
  const licenseKey = response.licenseKey?.replace(/\s+/g, "").toUpperCase() || "";
  if (!response.success || !licenseKey || !deviceHash) return null;
  return {
    kind: "paid",
    licenseKey,
    deviceHash,
    expiresAt: response.expiresAt ?? null,
    lastValidatedAt: null,
    offlineGraceUntil: null,
    lastSeenAt: now,
    maxDevices: response.maxDevices ?? 1,
    status: "ACTIVE",
  };
}
