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

  const data = (await response.json().catch(() => ({}))) as T;
  return data;
}
