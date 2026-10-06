import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { DashboardLicenseSummary } from "@shared/desktop-contract";
import { formatDate } from "@/utils/format";
import styles from "./SubscriptionCard.module.css";

type Props = {
  license: DashboardLicenseSummary;
};

export function LicenseCard({ license }: Props) {
  const active = license.state === "active";
  const statusText =
    active && license.remainingDays != null
      ? `${license.remainingDays} gün kaldı`
      : license.stateLabel;

  return (
    <section className={`anim-fade-up ${styles.card}`}>
      <div className={styles.glow} aria-hidden />

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Lisans</p>
          <h2 className={styles.title}>Abonelik Bilgileri</h2>
        </div>
        <div className={styles.badges}>
          {license.isMock ? <span className={styles.plan}>Geliştirme lisansı</span> : null}
          <span className={styles.plan}>{license.planLabel}</span>
          <span className={active ? styles.statusOk : styles.statusBad}>
            {active ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            {statusText}
          </span>
        </div>
      </header>

      <div className={styles.dates}>
        <div>
          <p className={styles.metaLabel}>Lisans Durumu</p>
          <p className={styles.metaValue}>{license.stateLabel}</p>
        </div>
        <div className={styles.dateDivider} aria-hidden />
        <div>
          <p className={styles.metaLabel}>Bitiş</p>
          <p className={styles.metaValue}>{formatDate(license.expiresAt)}</p>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.metaLabel}>Kalan</p>
          <p className={`${styles.statValue} ${active ? styles.remainOk : styles.remainBad}`}>
            {license.remainingDays ?? "—"}
          </p>
          <p className={styles.metaLabel}>gün</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.metaLabel}>Son Doğrulama</p>
          <p className={styles.metaValue}>{formatDate(license.lastSuccessfulValidationAt, true)}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.metaLabel}>Çevrimdışı Kullanım Hakkı</p>
          <p className={styles.metaValue}>
            {license.isOfflineGrace
              ? formatDate(license.offlineGraceUntil, true)
              : license.offlineGraceUntil
                ? formatDate(license.offlineGraceUntil)
                : "—"}
          </p>
        </div>
        {license.maxDevices != null ? (
          <div className={styles.stat}>
            <p className={styles.metaLabel}>Cihaz Limiti</p>
            <p className={styles.statValue}>{license.maxDevices}</p>
            <p className={styles.metaLabel}>cihaz</p>
          </div>
        ) : (
          <div className={styles.stat}>
            <p className={styles.metaLabel}>Ürün</p>
            <p className={styles.metaValue}>{license.productCode ?? license.productName ?? "—"}</p>
          </div>
        )}
      </div>
    </section>
  );
}
