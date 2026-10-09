import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredLicenseRecord } from "./licenseStore";

const HASH = "ab".repeat(32);

const { store, platform } = vi.hoisted(() => ({
  store: {
    record: null as StoredLicenseRecord | null,
    writes: [] as StoredLicenseRecord[],
  },
  platform: { current: "WINDOWS" as "WINDOWS" | "MACOS" },
}));

vi.mock("electron", () => ({
  app: { isPackaged: false, getPath: () => "/tmp", getVersion: () => "3.6.4" },
  safeStorage: { isEncryptionAvailable: () => false },
}));

vi.mock("./licenseStore", () => ({
  readStoredLicense: () => (store.record ? { ...store.record } : null),
  writeStoredLicense: (record: StoredLicenseRecord) => {
    store.record = { ...record };
    store.writes.push({ ...record });
  },
  touchLastSeen: (record: StoredLicenseRecord) => {
    const next = { ...record, lastSeenAt: new Date().toISOString() };
    store.record = { ...next };
    return next;
  },
}));

vi.mock("./deviceHash", () => ({
  computeDeviceHash: () => HASH,
  getDeviceName: () => "test-device",
  getEntitlementPlatform: () => platform.current,
}));

vi.mock("../db/database", () => ({ getDatabase: () => ({}) }));

vi.mock("../auth/localDesktopUser", () => ({
  countLocalUsers: () => 1,
  loginLocalUser: vi.fn(),
  resetLocalPassword: vi.fn(),
  setupLocalUser: vi.fn(),
  localSecurityQuestion: vi.fn(),
}));

import { CentralLicenseClient, LICENSE_STATUS_CACHE_TTL_MS } from "./CentralLicenseClient";
import { getDesktopAuthView } from "../auth/desktopAuthApi";
import { getDesktopSession, setDesktopSession } from "../auth/desktopUserSession";

type Reply = { status: number; body?: unknown; nonJson?: boolean };
type Handler = (route: string) => Reply | "network";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

let handler: Handler;
const fetchMock = vi.fn(async (url: string) => {
  const route = new URL(url).pathname.replace("/api/public/license", "");
  const reply = handler(route);
  if (reply === "network") throw new TypeError("fetch failed");
  return {
    status: reply.status,
    ok: reply.status >= 200 && reply.status < 300,
    json: async () => {
      if (reply.nonJson) throw new SyntaxError("Unexpected token <");
      return reply.body ?? {};
    },
  };
});

function routeCalls(route: string): number {
  return fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname === `/api/public/license${route}`).length;
}

function validatedTrial(overrides: Partial<StoredLicenseRecord> = {}): StoredLicenseRecord {
  return {
    kind: "trial",
    licenseKey: "",
    deviceHash: HASH,
    expiresAt: iso(5 * DAY),
    lastValidatedAt: iso(-60_000),
    offlineGraceUntil: null,
    lastSeenAt: iso(-60_000),
    maxDevices: 1,
    status: "ACTIVE",
    ...overrides,
  };
}

function paidLicense(overrides: Partial<StoredLicenseRecord> = {}): StoredLicenseRecord {
  return {
    kind: "paid",
    licenseKey: "WTG-AAAA-BBBB-CCCC",
    deviceHash: HASH,
    expiresAt: iso(300 * DAY),
    lastValidatedAt: iso(-DAY),
    offlineGraceUntil: iso(6 * DAY),
    lastSeenAt: iso(-60_000),
    maxDevices: 2,
    status: "ACTIVE",
    ...overrides,
  };
}

const TRIAL_OK: Reply = { status: 200, body: { success: true, valid: true, expiresAt: iso(5 * DAY) } };
const PAID_OK: Reply = { status: 200, body: { valid: true, expiresAt: iso(300 * DAY), offlineGraceDays: 7 } };
const NO_HANDOFF: Reply = { status: 200, body: { success: false } };
const RATE_LIMITED: Reply = { status: 429, body: { success: false, message: "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin" } };

function lockedWrites(): StoredLicenseRecord[] {
  return store.writes.filter((w) => w.status === "LOCKED");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  store.record = null;
  store.writes = [];
  platform.current = "WINDOWS";
  setDesktopSession(null);
  process.env.LICENSE_API_BASE = "https://license.test/api/public/license";
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.LICENSE_API_BASE;
});

describe("CentralLicenseClient — geçici sunucu hataları (deneme)", () => {
  it.each([
    ["429", RATE_LIMITED],
    ["408", { status: 408, body: {} }],
    ["500", { status: 500, body: { message: "Internal" } }],
    ["503 HTML", { status: 503, nonJson: true }],
    ["404 karar içermeyen HTML", { status: 404, nonJson: true }],
    ["200 JSON olmayan gövde", { status: 200, nonJson: true }],
  ] as const)("%s doğrulanmış aktif denemeyi kilitlemez", async (_label, reply) => {
    store.record = validatedTrial();
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : reply);
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("active");
    expect(status.isOfflineGrace).toBe(true);
    expect(status.canWriteRecords).toBe(true);
    expect(lockedWrites()).toHaveLength(0);
    expect(store.record?.status).toBe("ACTIVE");
  });

  it("hiç doğrulanmamış yeni deneme geçici hatada açılmaz ama kilitlenmez", async () => {
    store.record = validatedTrial({ lastValidatedAt: null });
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : RATE_LIMITED);
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("unreachable");
    expect(lockedWrites()).toHaveLength(0);
  });

  it("LOCKED kayıtlı deneme geçici hatada açılmaz", async () => {
    store.record = validatedTrial({ status: "LOCKED" });
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : RATE_LIMITED);
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("unreachable");
  });

  it("kayıtlı bitiş tarihi geçmiş deneme geçici hatada da süresi dolmuş sayılır", async () => {
    store.record = validatedTrial({ expiresAt: iso(-1000) });
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : RATE_LIMITED);
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("expired");
    expect(store.record?.status).toBe("LOCKED");
  });

  it("çevrimdışı deneme kuralı değişmez", async () => {
    store.record = validatedTrial();
    handler = () => "network";
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("unreachable");
    expect(lockedWrites()).toHaveLength(0);
  });
});

describe("CentralLicenseClient — gerçek sunucu kararları korunur", () => {
  it.each([200, 403])("deneme iptali (HTTP %i) kilitler", async (code) => {
    store.record = validatedTrial();
    handler = (route) =>
      route === "/purchase-handoff"
        ? NO_HANDOFF
        : { status: code, body: { success: false, valid: false, message: "Lisans iptal edilmiş." } };
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("revoked");
    expect(store.record?.status).toBe("LOCKED");
  });

  it("sunucu TRIAL_EXPIRED dönerse deneme biter", async () => {
    store.record = validatedTrial();
    handler = (route) =>
      route === "/purchase-handoff" ? NO_HANDOFF : { status: 410, body: { success: false, code: "TRIAL_EXPIRED" } };
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("expired");
    expect(store.record?.status).toBe("LOCKED");
  });

  it("ücretli lisans cihaz sınırı kilitler", async () => {
    store.record = paidLicense();
    handler = () => ({ status: 200, body: { valid: false, message: "Cihaz limiti doldu." } });
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("device_limit");
    expect(store.record?.status).toBe("LOCKED");
  });

  it("ücretli lisans süre bitimi (403 + mesaj) kilitler", async () => {
    store.record = paidLicense();
    handler = () => ({ status: 403, body: { message: "Lisans süresi dolmuş." } });
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("expired");
    expect(store.record?.status).toBe("LOCKED");
  });
});

describe("CentralLicenseClient — ücretli offline grace", () => {
  it("429 grace içindeyse aktif kalır, kilit yazmaz", async () => {
    store.record = paidLicense();
    handler = () => RATE_LIMITED;
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("active");
    expect(status.isOfflineGrace).toBe(true);
    expect(lockedWrites()).toHaveLength(0);
  });

  it("429 grace bitmişse açılmaz ama license.bin kilitlenmez", async () => {
    store.record = paidLicense({ offlineGraceUntil: iso(-1000) });
    handler = () => ({ status: 500, body: {} });
    const status = await new CentralLicenseClient().getStatus();
    expect(status.state).toBe("offline_expired");
    expect(lockedWrites()).toHaveLength(0);
  });

  it("ağ hatası kuralları aynen sürer", async () => {
    store.record = paidLicense();
    handler = () => "network";
    expect((await new CentralLicenseClient().getStatus()).state).toBe("active");

    store.record = paidLicense({ offlineGraceUntil: iso(-1000) });
    const expired = await new CentralLicenseClient().getStatus();
    expect(expired.state).toBe("offline_expired");
    expect(store.record?.status).toBe("LOCKED");
  });
});

describe("CentralLicenseClient — eşzamanlı istek ve önbellek", () => {
  it("eşzamanlı getStatus çağrıları tek tur sunucu isteğine iner", async () => {
    store.record = validatedTrial();
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : TRIAL_OK);
    const client = new CentralLicenseClient();
    const results = await Promise.all(Array.from({ length: 6 }, () => client.getStatus()));
    expect(results.every((s) => s.state === "active")).toBe(true);
    expect(routeCalls("/purchase-handoff")).toBe(1);
    expect(routeCalls("/trial/validate")).toBe(1);
  });

  it("TTL içinde önbellekten döner, TTL sonunda yeniden doğrular ve iptali gösterir", async () => {
    store.record = validatedTrial();
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : TRIAL_OK);
    const client = new CentralLicenseClient();
    await client.getStatus();
    vi.setSystemTime(NOW + LICENSE_STATUS_CACHE_TTL_MS - 1);
    await client.getStatus();
    expect(routeCalls("/trial/validate")).toBe(1);

    handler = (route) =>
      route === "/purchase-handoff" ? NO_HANDOFF : { status: 200, body: { success: false, valid: false, message: "Lisans iptal edilmiş." } };
    vi.setSystemTime(NOW + LICENSE_STATUS_CACHE_TTL_MS);
    expect((await client.getStatus()).state).toBe("revoked");
    expect((await client.getStatus()).state).toBe("revoked");
    expect(routeCalls("/trial/validate")).toBe(3);
  });

  it("refresh önbelleği atlar ve iptali hemen gösterir", async () => {
    store.record = validatedTrial();
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : TRIAL_OK);
    const client = new CentralLicenseClient();
    await client.getStatus();
    handler = (route) =>
      route === "/purchase-handoff" ? NO_HANDOFF : { status: 200, body: { success: false, valid: false, message: "Lisans iptal edilmiş." } };
    const refreshed = await client.refresh();
    expect(refreshed.ok).toBe(true);
    expect(refreshed.ok && refreshed.data.state).toBe("revoked");
    expect((await client.getStatus()).state).toBe("revoked");
  });

  it("önbellekteki aktif durum bitiş tarihi geçince kullanılmaz", async () => {
    store.record = validatedTrial({ expiresAt: iso(10_000) });
    handler = (route) =>
      route === "/purchase-handoff" ? NO_HANDOFF : { status: 200, body: { success: true, valid: true, expiresAt: iso(10_000) } };
    const client = new CentralLicenseClient();
    expect((await client.getStatus()).state).toBe("active");
    vi.setSystemTime(NOW + 10_001);
    expect((await client.getStatus()).state).toBe("expired");
  });

  it("aktivasyon önbelleği geçersiz kılar", async () => {
    store.record = validatedTrial();
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : TRIAL_OK);
    const client = new CentralLicenseClient();
    expect((await client.getStatus()).planLabel).toBe("7 günlük deneme");

    handler = (route) => {
      if (route === "/activate") return { status: 200, body: { success: true, expiresAt: iso(300 * DAY) } };
      return PAID_OK;
    };
    const activated = await client.activate({ licenseKey: "WTG-AAAA-BBBB-CCCC", activationPassword: "x" });
    expect(activated.ok).toBe(true);
    expect(routeCalls("/validate")).toBe(1);
    expect(store.record?.kind).toBe("paid");
    const after = await client.getStatus();
    expect(after.maskedLicenseKey).not.toBeNull();
  });

  it("yeni deneme ilk doğrulamadan önce geçici hata hakkı almaz", async () => {
    handler = (route) => {
      if (route === "/trial") return { status: 200, body: { success: true, expiresAt: iso(7 * DAY) } };
      if (route === "/purchase-handoff") return NO_HANDOFF;
      return RATE_LIMITED;
    };
    const started = await new CentralLicenseClient().startTrial({ email: "a@b.co", phone: "5551112233", fullName: "A" } as never);
    expect(started.ok && started.data.state).toBe("unreachable");
    expect(store.record?.status).toBe("ACTIVE");
    expect(lockedWrites()).toHaveLength(0);
  });

  it("aktivasyonda 429 sunucu mesajını gösterir", async () => {
    handler = () => RATE_LIMITED;
    const out = await new CentralLicenseClient().activate({ licenseKey: "WTG-AAAA-BBBB-CCCC", activationPassword: "x" });
    expect(out).toEqual({ ok: false, message: "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin" });
    expect(store.record).toBeNull();
  });
});

describe("Aktif demo sırasında İhbar → Lisans → Ayarlar geçişi", () => {
  it.each(["WINDOWS", "MACOS"] as const)("%s: 429 gelse de oturum kapanmaz", async (os) => {
    platform.current = os;
    store.record = validatedTrial();
    handler = (route) => (route === "/purchase-handoff" ? NO_HANDOFF : TRIAL_OK);
    const client = new CentralLicenseClient();

    setDesktopSession({ token: "t", username: "bilirkisi" });
    expect((await getDesktopAuthView(client)).signedIn).toBe(true);

    handler = (route) => (route === "/purchase-handoff" ? RATE_LIMITED : RATE_LIMITED);
    const navigate = async () => {
      // AppShell + LicenseGate aynı anda getLicenseStatus çağırır
      const [shell, gate] = await Promise.all([client.getStatus(), client.getStatus()]);
      expect(shell.state).toBe("active");
      expect(gate.state).toBe("active");
    };

    vi.setSystemTime(NOW + LICENSE_STATUS_CACHE_TTL_MS + 1);
    await navigate(); // /ihbar-tazminati
    vi.setSystemTime(NOW + LICENSE_STATUS_CACHE_TTL_MS + 2_000);
    await navigate(); // /lisans
    await client.getStatus(); // abonelik kataloğu
    vi.setSystemTime(NOW + LICENSE_STATUS_CACHE_TTL_MS + 4_000);
    await navigate(); // /ayarlar
    await client.getStatus(); // pencere odağı

    vi.setSystemTime(NOW + 2 * LICENSE_STATUS_CACHE_TTL_MS + 5_000);
    const view = await getDesktopAuthView(client); // 60 sn aralıklı oturum kontrolü
    expect(view.signedIn).toBe(true);
    expect(view.step).toBe("app");
    expect(getDesktopSession()).not.toBeNull();
    expect(lockedWrites()).toHaveLength(0);
    expect(store.record?.status).toBe("ACTIVE");
    expect(routeCalls("/trial/validate")).toBe(3);
  });

  it("gerçek iptal geldiğinde oturum yine kapanır", async () => {
    store.record = validatedTrial();
    handler = () => ({ status: 200, body: { success: false, valid: false, message: "Lisans iptal edilmiş." } });
    setDesktopSession({ token: "t", username: "bilirkisi" });
    const view = await getDesktopAuthView(new CentralLicenseClient());
    expect(view.signedIn).toBe(false);
    expect(view.step).toBe("blocked");
    expect(getDesktopSession()).toBeNull();
  });
});
