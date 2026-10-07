import { PRODUCT_VERSION, PRODUCT_VERSION_NOTES } from "../appVersion";
import { useDesktopRuntime } from "../desktop/useDesktopRuntime";
import { SettingsUpdateSection } from "./SettingsUpdateSection";
import styles from "./pages.module.css";

export function SettingsPage() {
  const runtime = useDesktopRuntime();
  const storage = runtime?.storage;
  const connected = storage?.connected ?? false;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.kicker}>Sistem</div>
        <h2>Ayarlar</h2>
        <p>Dosya ve hesaplama bilgileriniz bu bilgisayarda saklanır.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}>Sürüm Bilgisi</h3>
            <p className={styles.cardHint}>Yüklü sürüm ve bu sürümdeki değişiklikler</p>
          </div>
          <strong className={styles.versionValue}>{PRODUCT_VERSION}</strong>
        </div>
        <ul className={styles.noteList}>
          {PRODUCT_VERSION_NOTES.map((note) => (
            <li key={note} className={styles.noteItem}>{note}</li>
          ))}
        </ul>
      </section>

      <SettingsUpdateSection />

      <section className={styles.panel}>
        <h3 className={styles.cardTitle}>Uygulama ve Veritabanı</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoCell}>
            <span>Uygulama sürümü</span>
            <strong>
              {runtime?.app.name} {runtime?.app.version}
            </strong>
          </div>
          <div className={styles.infoCell}>
            <span>Veritabanı bağlantısı</span>
            <strong>{connected ? "Bağlı" : "Bağlı değil"}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Şema / migration sürümü</span>
            <strong>{storage?.schemaVersion ?? "—"}</strong>
          </div>
          <div className={styles.infoCell}>
            <span>Kayıt sayısı</span>
            <strong>{storage?.recordCount ?? "—"}</strong>
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <h3 className={styles.cardTitle}>Sistem Bilgileri</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoCell}>
            <span>İşletim sistemi</span>
            <strong>
              {runtime
                ? `${runtime.app.platform === "win32" ? "Windows" : runtime.app.platform === "darwin" ? "macOS" : runtime.app.platform} · ${runtime.app.arch}`
                : "…"}
            </strong>
          </div>
          <div className={styles.infoCell}>
            <span>Lisans kaynağı</span>
            <strong>{runtime?.license.isMock ? "Geliştirme" : runtime?.license.source ?? "—"}</strong>
          </div>
        </div>
        <div className={styles.pathBlock}>
          <span>Kullanıcı verisi</span>
          <code className={styles.path}>{storage?.userDataPath ?? "…"}</code>
        </div>
        <div className={styles.pathBlock}>
          <span>Veritabanı dosyası</span>
          <code className={styles.path}>{storage?.databasePath ?? "…"}</code>
        </div>
        <div className={styles.pathBlock}>
          <span>Yedekleme dizini</span>
          <code className={styles.path}>{storage?.backupsPath ?? "…"}</code>
        </div>
      </section>
    </div>
  );
}
