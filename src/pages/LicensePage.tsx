import { useState } from "react";
import {
  LICENSE_APP_CODE,
  LICENSE_PRODUCT_NAME,
  type DesktopLicenseStatus,
  type LicenseState,
} from "../../shared/desktop-contract";
import { useDesktopRuntime } from "../desktop/useDesktopRuntime";
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

  const current = license ?? runtime?.license ?? null;
  const needsActivation = Boolean(current && !current.isMock && current.state !== "active");

  async function startTrial(): Promise<void> {
    const api = window.bilirkisiDesktop;
    if (!api) return;
    setBusy(true);
    setFormMessage(null);
    try {
      const result = await api.startTrial({ email: trialEmail });
      if (!result.ok) {
        setFormMessage(result.message);
        return;
      }
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
        setFormMessage(result.message);
        return;
      }
      setLicense(result.data);
      setPassword("");
      setFormMessage(result.data.message);
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
        <h2>{LICENSE_PRODUCT_NAME}</h2>
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
      ) : (
        <aside className={styles.banner}>
          <strong>{current ? STATE_LABELS[current.state] : "Durum yükleniyor"}</strong>
          <p>{current?.message}</p>
        </aside>
      )}

      {needsActivation && !current?.isMock ? (
        <>
        <section className={styles.panel}>
          <span>7 günlük ücretsiz deneme</span>
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
          <div className={styles.toolbar}>
            <button type="button" className={styles.button} disabled={busy} onClick={() => void startTrial()}>
              Denemeyi bu cihazda başlat
            </button>
          </div>
          <p className={styles.note}>
            Deneme lisansı anahtar istemez. Süre lisans sunucusundaki bitiş tarihine göredir ve çevrimdışı uzamaz.
          </p>
        </section>
        <section className={styles.panel}>
          <span>Satın alınmış lisansı etkinleştir</span>
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
      ) : (
        <div className={styles.toolbar}>
          <button type="button" className={styles.button} disabled={busy} onClick={() => void refresh()}>
            Yeniden doğrula
          </button>
        </div>
      )}

      <section className={styles.panel}>
        <div className={styles.row}>
          <span>Ürün</span>
          <strong>{LICENSE_PRODUCT_NAME}</strong>
        </div>
        <div className={styles.row}>
          <span>Ürün kodu</span>
          <strong>{current?.productCode ?? LICENSE_APP_CODE}</strong>
        </div>
        <div className={styles.row}>
          <span>Durum</span>
          <strong>{current ? STATE_LABELS[current.state] : "…"}</strong>
        </div>
        <div className={styles.row}>
          <span>Lisans anahtarı</span>
          <strong>{current?.maskedLicenseKey ?? "—"}</strong>
        </div>
        <div className={styles.row}>
          <span>Bitiş tarihi</span>
          <strong>{formatDate(current?.expiresAt ?? null)}</strong>
        </div>
        <div className={styles.row}>
          <span>Kalan gün</span>
          <strong>{remainingLabel(current?.expiresAt ?? null)}</strong>
        </div>
        <div className={styles.row}>
          <span>Son doğrulama</span>
          <strong>{formatDate(current?.lastSuccessfulValidationAt ?? current?.lastCheckedAt ?? null)}</strong>
        </div>
        <div className={styles.row}>
          <span>Cihaz limiti</span>
          <strong>{current?.maxDevices ?? "—"}</strong>
        </div>
        <div className={styles.row}>
          <span>Çevrimdışı süre sonu</span>
          <strong>{formatDate(current?.offlineGraceUntil ?? null)}</strong>
        </div>
        <div className={styles.row}>
          <span>Kayıt yazma</span>
          <strong>{current?.canWriteRecords ? "Açık" : "Salt okunur"}</strong>
        </div>
      </section>
    </div>
  );
}
