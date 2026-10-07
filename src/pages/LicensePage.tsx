import { useEffect, useState } from "react";
import {
  LICENSE_APP_CODE,
  LICENSE_PRODUCT_NAME,
  type DesktopLicenseStatus,
  type LicenseState,
} from "../../shared/desktop-contract";
import { emptySubscriptionCatalog, type DesktopSubscriptionCatalog } from "../../shared/subscriptionAccount";
import { useDesktopRuntime } from "../desktop/useDesktopRuntime";
import { SubscriptionAccountPanel } from "../license/SubscriptionAccountPanel";
import { presentTrialFailure, reducePaidActivation } from "../license/trialNotice";
import styles from "./pages.module.css";

const STATE_LABELS: Record<LicenseState, string> = {
  active: "Aktif",
  inactive: "Pasif",
  unknown: "Bilinmiyor",
  expired: "Süresi dolmuş",
  revoked: "İptal edilmiş",
  device_limit: "Cihaz limiti",
  invalid_product: "Ürün için geçersiz",
  unreachable: "Sunucuya ulaşılamıyor",
  offline_expired: "Çevrimdışı süre doldu",
  clock_anomaly: "Saat tutarsızlığı",
  pending: "Aktivasyon bekleniyor",
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return "—";
  }
  return new Date(parsed).toLocaleString("tr-TR");
}

function remainingLabel(expiresAt: string | null): string {
  if (!expiresAt) {
    return "—";
  }
  const diff = Date.parse(expiresAt) - Date.now();
  if (Number.isNaN(diff)) {
    return "—";
  }
  return `${Math.ceil(diff / (24 * 60 * 60 * 1000))} gün`;
}

export function LicensePage() {
  const runtime = useDesktopRuntime();
  const [license, setLicense] = useState<DesktopLicenseStatus | null>(runtime?.license ?? null);
  const [licenseKey, setLicenseKey] = useState("");
  const [password, setPassword] = useState("");
  const [trialEmail, setTrialEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [trialFailure, setTrialFailure] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<DesktopSubscriptionCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogReload, setCatalogReload] = useState(0);
  const [acting, setActing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const current = license ?? runtime?.license ?? null;
  const needsActivation = Boolean(current && !current.isMock && current.state !== "active");
  const trialNotice = trialFailure ? presentTrialFailure(trialFailure) : null;

  useEffect(() => {
    const api = window.bilirkisiDesktop;
    if (!api) {
      setCatalogLoading(false);
      return;
    }
    let active = true;
    setCatalogLoading(true);
    void api.getSubscriptionCatalog().then((next) => {
      if (!active) return;
      setCatalog(next);
      setCatalogLoading(false);
    }).catch(() => {
      if (!active) return;
      setCatalog(emptySubscriptionCatalog({ loadError: "Lisans paket bilgisi yüklenemedi." }));
      setCatalogLoading(false);
    });
    return () => {
      active = false;
    };
  }, [catalogReload, current?.isMock, current?.state]);

  async function runCatalogAction(action: "purchase" | "renew"): Promise<void> {
    const api = window.bilirkisiDesktop;
    if (!api) return;
    setActing(true);
    setActionMessage(null);
    try {
      const result = action === "purchase" ? await api.openDesktopPurchase() : await api.openDesktopRenewal();
      setActionMessage(result.ok ? result.data.message : result.message);
    } finally {
      setActing(false);
    }
  }

  async function startTrial(): Promise<void> {
    const api = window.bilirkisiDesktop;
    if (!api) return;
    setBusy(true);
    setFormMessage(null);
    try {
      const result = await api.startTrial({ email: trialEmail });
      if (!result.ok) {
        setTrialFailure(presentTrialFailure(result.message).message);
        return;
      }
      setTrialFailure(null);
      setLicense(result.data);
      setFormMessage(result.data.message);
      await runtime?.reload();
    } finally {
      setBusy(false);
    }
  }

  async function activate(): Promise<void> {
    const api = window.bilirkisiDesktop;
    if (!api) {
      return;
    }
    setBusy(true);
    setFormMessage(null);
    try {
      const result = await api.activateLicense({
        licenseKey,
        activationPassword: password,
      });
      if (!result.ok) {
        setFormMessage(reducePaidActivation(result).paidFormMessage);
        return;
      }
      setLicense(result.data);
      setPassword("");
      setFormMessage(reducePaidActivation({ ok: true, message: result.data.message }).paidFormMessage);
      await runtime?.reload();
    } finally {
      setBusy(false);
    }
  }

  async function refresh(): Promise<void> {
    const api = window.bilirkisiDesktop;
    if (!api) {
      return;
    }
    setBusy(true);
    setFormMessage(null);
    try {
      const result = await api.refreshLicense();
      if (!result.ok) {
        setFormMessage(result.message);
        const latest = await api.getLicenseStatus();
        setLicense(latest);
        return;
      }
      setLicense(result.data);
      setFormMessage(result.data.message);
      await runtime?.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.kicker}>Lisans</div>
        <h2>Lisans Bilgileri</h2>
        <p>
          Lisans işlemleri Woontegra merkezi lisans servisi üzerinden yürütülür. Hesaplama
          kayıtları lisans sunucusuna gönderilmez.
        </p>
      </section>

      {current?.isMock ? (
        <aside className={styles.banner}>
          <strong>Mock lisans (geliştirme)</strong>
          <p>{current.message}</p>
        </aside>
      ) : null}
      {trialNotice ? (
        <aside className={styles.banner}>
          <strong>{trialNotice.title}</strong>
          <p>{trialNotice.message}</p>
        </aside>
      ) : null}

      <section className={`${styles.panel} ${styles.summary}`}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.kicker}>Lisans durumu</div>
            <h3 className={styles.cardTitle}>
              {catalog?.licenseKind === "trial"
                ? "7 günlük deneme"
                : catalog?.licenseKind === "paid"
                  ? "Yıllık Lisans"
                  : current
                    ? STATE_LABELS[current.state]
                    : "Durum yükleniyor"}
            </h3>
            <p className={styles.cardHint}>{current?.message || "Lisans durumu hazırlanıyor."}</p>
          </div>
          <span className={`${styles.pill} ${current?.state === "active" ? styles.pillOk : styles.pillWarn}`}>
            {current ? STATE_LABELS[current.state] : "…"}
          </span>
        </div>
        {!needsActivation ? (
          <div className={styles.toolbar}>
            <button type="button" className={styles.button} disabled={busy} onClick={() => void refresh()}>
              Yeniden doğrula
            </button>
          </div>
        ) : null}
        {!needsActivation && formMessage ? <p className={styles.note}>{formMessage}</p> : null}
      </section>

      <SubscriptionAccountPanel
        license={current}
        catalog={catalog}
        loading={catalogLoading}
        onRetry={() => setCatalogReload((value) => value + 1)}
        onPurchase={() => void runCatalogAction("purchase")}
        onRenew={() => void runCatalogAction("renew")}
        acting={acting}
        actionMessage={actionMessage}
      />

      {needsActivation && !current?.isMock ? (
        <>
        <section className={styles.panel}>
          <h3 className={styles.cardTitle}>7 günlük ücretsiz deneme</h3>
          <div className={styles.formGrid}>
            <label className={styles.row}>
              <span>E-posta</span>
              <input
                className={styles.input}
                type="email"
                value={trialEmail}
                onChange={(event) => setTrialEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
          </div>
          <div className={styles.toolbar}>
            <button type="button" className={styles.button} disabled={busy} onClick={() => void startTrial()}>
              Denemeyi bu cihazda başlat
            </button>
          </div>
          {trialNotice ? (
            <p className={styles.error} role="alert">
              {trialNotice.message}
            </p>
          ) : (
            <p className={styles.note}>
              Deneme lisansı anahtar istemez. Süre lisans sunucusundaki bitiş tarihine göredir ve çevrimdışı uzamaz.
            </p>
          )}
        </section>
        <section className={styles.panel}>
          <h3 className={styles.cardTitle}>Satın alınmış lisansı etkinleştir</h3>
          <div className={styles.formGrid}>
            <label className={styles.row}>
              <span>Lisans anahtarı</span>
              <input
                className={styles.input}
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className={styles.row}>
              <span>Aktivasyon şifresi</span>
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="off"
              />
            </label>
          </div>
          <div className={styles.toolbar}>
            <button type="button" className={styles.button} disabled={busy} onClick={() => void activate()}>
              Lisansı Etkinleştir
            </button>
            <button type="button" className={styles.button} disabled={busy} onClick={() => void refresh()}>
              Yeniden dene
            </button>
          </div>
          {formMessage ? <p className={styles.note}>{formMessage}</p> : null}
          <p className={styles.note}>
            Lisans satın alma ve destek için Woontegra ile iletişime geçin. Hesaplama kayıtları
            lisans sunucusuna gönderilmez.
          </p>
        </section>
        </>
      ) : null}

      <section className={styles.panel}>
        <h3 className={styles.cardTitle}>Lisans Detayları</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoCell}>
            <span>Ürün</span>
            <strong>{LICENSE_PRODUCT_NAME}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Ürün kodu</span>
            <strong>{current?.productCode ?? LICENSE_APP_CODE}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Durum</span>
            <strong>{current ? STATE_LABELS[current.state] : "…"}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Lisans anahtarı</span>
            <strong>{current?.maskedLicenseKey ?? "—"}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Bitiş tarihi</span>
            <strong>{formatDate(current?.expiresAt ?? null)}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Kalan gün</span>
            <strong>{remainingLabel(current?.expiresAt ?? null)}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Son doğrulama</span>
            <strong>{formatDate(current?.lastSuccessfulValidationAt ?? current?.lastCheckedAt ?? null)}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Cihaz limiti</span>
            <strong>{current?.maxDevices ?? "—"}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Çevrimdışı süre sonu</span>
            <strong>{formatDate(current?.offlineGraceUntil ?? null)}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Kayıt yazma</span>
            <strong>{current?.canWriteRecords ? "Açık" : "Salt okunur"}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
