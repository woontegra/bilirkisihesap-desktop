import { mapServerMessageToState } from "./licensePolicy";

export type LicenseActivateApiResponse = {
  success?: boolean;
  message?: string;
  expiresAt?: string;
};

export type LicenseValidateApiResponse = {
  valid?: boolean;
  licenseKey?: string;
  appCode?: string;
  expiresAt?: string;
  status?: string;
  maxDevices?: number;
  offlineGraceDays?: number;
  message?: string;
};

export class LicenseNetworkError extends Error {
  constructor() {
    super("LICENSE_NETWORK");
    this.name = "LicenseNetworkError";
  }
}

/** Sunucuya ulaşıldı ama lisans kararı dönmedi (429, 408, 5xx veya karar içermeyen yanıt). İptal anlamına gelmez. */
export class LicenseTransientError extends Error {
  readonly status: number;
  readonly serverMessage: string | null;

  constructor(status: number, serverMessage: string | null = null) {
    super(`LICENSE_TRANSIENT_${status}`);
    this.name = "LicenseTransientError";
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

export function isTransientLicenseHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readServerMessage(body: Record<string, unknown> | null): string | null {
  const message = body?.message ?? body?.error;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

/** 4xx gövdesi yalnız açık bir lisans kararı taşıyorsa kesin sayılır. */
function carriesLicenseDecision(body: Record<string, unknown> | null): boolean {
  if (!body) return false;
  if (body.valid === false || body.success === false) return true;
  if (typeof body.code === "string" && body.code.trim()) return true;
  return mapServerMessageToState(readServerMessage(body) ?? undefined) !== null;
}

export function licensePublicApiBase(): string {
  const fromEnv = process.env.LICENSE_API_BASE?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://lisans-server-backend-production.up.railway.app/api/public/license";
}

export async function postLicenseJson<T>(baseUrl: string, route: string, body: Record<string, unknown>): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${route}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new LicenseNetworkError();
  }

  const status = typeof response.status === "number" ? response.status : 200;
  const parsed = (await response.json().then(
    (value: unknown) => ({ ok: true as const, value }),
    () => ({ ok: false as const, value: undefined }),
  )) as { ok: boolean; value: unknown };
  const record = parsed.ok ? asRecord(parsed.value) : null;

  if (isTransientLicenseHttpStatus(status)) {
    throw new LicenseTransientError(status, readServerMessage(record));
  }
  if (status >= 200 && status < 300) {
    if (!parsed.ok) throw new LicenseTransientError(status);
    return parsed.value as T;
  }
  if (!carriesLicenseDecision(record)) {
    throw new LicenseTransientError(status, readServerMessage(record));
  }
  return record as T;
}
