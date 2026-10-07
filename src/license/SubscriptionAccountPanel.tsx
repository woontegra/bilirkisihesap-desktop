import { ExternalLink, RefreshCw } from "lucide-react";
import type { DesktopLicenseStatus } from "@shared/desktop-contract";
import {
  buildSubscriptionProgress,
  calculateRemainingDays,
  formatSubscriptionDate,
  formatSubscriptionMoney,
  PAID_RENEWAL_NOTICE,
  RENEW_LABEL,
  platformLabel,
  subscriptionPrimaryAction,
  TRIAL_PURCHASE_HINT,
  TRIAL_PURCHASE_LABEL,
  type DesktopSubscriptionCatalog,
} from "@shared/subscriptionAccount";
import { Button } from "@/components/ui/Button";
import styles from "@/pages/pages.module.css";
import profile from "@/pages/profile/tabs/profileTabShared.module.css";

type Props = {
  license: DesktopLicenseStatus | null;
  catalog: DesktopSubscriptionCatalog | null;
  loading: boolean;
  onRetry: () => void;
  onPurchase: () => void;
  onRenew: () => void;
  acting: boolean;
  actionMessage: string | null;
};

function ProgressBar({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  const progress = buildSubscriptionProgress(startsAt, endsAt);
  if (!progress) return null;
  const isExpired = progress.daysRemaining <= 0;
  const isExpiringSoon = progress.daysRemaining <= 30;
  const remaining = progress.remainingPct;
  const elapsed = 100 - remaining;
  return (
    <div className={profile.progressSection}>
      <div className={profile.progressHeader}>
        <p className={profile.progressLabel}>
          {isExpired ? "Lisans süresi doldu" : `Kalan süre: ${progress.daysRemaining} gün`}
        </p>
        <span className={`${profile.progressPct} ${isExpired || isExpiringSoon ? profile.progressPctDanger : profile.progressPctOk}`}>
          {remaining.toFixed(1)}% kaldı
        </span>
      </div>
      <div className={profile.progressTrack}>
        {elapsed > 0 ? <div className={profile.progressElapsed} style={{ width: `${Math.min(100, elapsed)}%` }} /> : null}
        {remaining > 0 ? (
          <div
            className={`${profile.progressRemaining} ${isExpired || isExpiringSoon ? profile.progressRemainingWarn : profile.progressRemainingOk}`}
            style={{ width: `${Math.min(100, remaining)}%` }}
          />
        ) : null}
      </div>
      {progress.daysRemaining > 0 ? (
        <p className={profile.progressMeta}>
          {progress.daysUsed} gün geçti, {progress.daysRemaining} gün kaldı
        </p>
      ) : null}
    </div>
  );
}

function licenseTypeLabel(catalog: DesktopSubscriptionCatalog | null, license: DesktopLicenseStatus | null): string {
  if (catalog?.licenseKind === "trial") return "7 günlük deneme";
  if (catalog?.licenseKind === "paid") return "Yıllık Lisans";
  return license?.planLabel || "Paket bilgisi yok";
}

export function SubscriptionAccountPanel({
  license,
  catalog,
  loading,
  onRetry,
  onPurchase,
  onRenew,
  acting,
  actionMessage,
}: Props) {
  const action = subscriptionPrimaryAction(catalog?.licenseKind ?? "other");
  const offer = catalog?.options[0] ?? null;
  const endsAt = license?.expiresAt ?? null;
  const startsAt = catalog?.startsAt ?? null;
  const remainingDays = calculateRemainingDays(endsAt);
  const deviceText = [
    license?.maskedLicenseKey ? `Lisans ${license.maskedLicenseKey}` : null,
    license?.maxDevices != null ? `En fazla ${license.maxDevices} cihaz` : offer?.maxDevices != null ? `En fazla ${offer.maxDevices} cihaz` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const showPackage = catalog?.licenseKind === "trial" || catalog?.licenseKind === "paid";

  return (
    <>
      {loading ? (
        <section className={styles.panel} aria-busy="true">
          <h3 className={styles.cardTitle}>Lisans bilgileri</h3>
          <div className={styles.infoGrid}>
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className={styles.infoCell} />
            ))}
          </div>
        </section>
      ) : catalog?.loadError ? (
        <section className={styles.panel}>
          <h3 className={styles.cardTitle}>Lisans bilgileri</h3>
          <p className={styles.error}>{catalog.loadError}</p>
          <div className={styles.toolbar}>
            <Button variant="soft" size="sm" onClick={onRetry}>
              <RefreshCw size={14} aria-hidden /> Tekrar Dene
            </Button>
          </div>
        </section>
      ) : (
        <section className={styles.panel}>
          <h3 className={styles.cardTitle}>Lisans bilgileri</h3>
          <div className={styles.infoGrid}>
            <div className={styles.infoCell}>
              <span>Lisans türü</span>
              <strong>{licenseTypeLabel(catalog, license)}</strong>
            </div>
            <div className={styles.infoCell}>
              <span>Platform</span>
              <strong>{platformLabel(catalog?.platform ?? null)}</strong>
            </div>
            <div className={styles.infoCell}>
              <span>Başlangıç Tarihi</span>
              <strong>{formatSubscriptionDate(startsAt)}</strong>
            </div>
            <div className={styles.infoCell}>
              <span>Bitiş Tarihi</span>
              <strong>{formatSubscriptionDate(endsAt)}</strong>
            </div>
            <div className={styles.infoCell}>
              <span>Kalan Süre</span>
              <strong>{remainingDays === null ? "—" : `${remainingDays} gün`}</strong>
            </div>
            <div className={styles.infoCell}>
              <span>Cihaz</span>
              <strong>{deviceText || "—"}</strong>
            </div>
          </div>
          {endsAt ? <ProgressBar startsAt={startsAt} endsAt={endsAt} /> : null}
        </section>
      )}

      {showPackage ? (
        <section className={styles.panel}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>Yıllık Profesyonel Paket</h3>
              <p className={styles.cardHint}>Yıllık Profesyonel Lisans</p>
            </div>
          </div>
          {catalog?.licenseKind === "paid" ? <p className={styles.note}>{PAID_RENEWAL_NOTICE}</p> : null}
          {offer ? (
            <div className={styles.infoGrid}>
              <div className={styles.infoCell}>
                <span>Fiyat</span>
                <strong>{formatSubscriptionMoney(offer.normalPrice, offer.currency)} / Yıl</strong>
              </div>
              <div className={styles.infoCell}>
                <span>Süre</span>
                <strong>{offer.licenseDays ?? 365} gün</strong>
              </div>
              <div className={styles.infoCell}>
                <span>Cihaz</span>
                <strong>{offer.maxDevices ?? 1} cihaz</strong>
              </div>
            </div>
          ) : catalog?.licenseKind === "trial" ? (
            <p className={styles.note}>Yıllık lisans bilgisi şu anda görüntülenemiyor. Fiyat, satın alma sayfasında gösterilir.</p>
          ) : null}
          {action === "purchase" ? (
            <div className={styles.toolbar}>
              <Button variant="primary" disabled={acting} onClick={onPurchase}>
                <ExternalLink size={14} aria-hidden /> {acting ? "Hazırlanıyor..." : TRIAL_PURCHASE_LABEL}
              </Button>
            </div>
          ) : null}
          {action === "purchase" ? <p className={styles.note}>{TRIAL_PURCHASE_HINT}</p> : null}
          {action === "renew" ? (
            <div className={styles.toolbar}>
              <Button variant="primary" disabled={acting} onClick={onRenew}>
                <ExternalLink size={14} aria-hidden /> {acting ? "Hazırlanıyor..." : RENEW_LABEL}
              </Button>
            </div>
          ) : null}
          {actionMessage ? <p className={styles.note}>{actionMessage}</p> : null}
        </section>
      ) : null}
    </>
  );
}
