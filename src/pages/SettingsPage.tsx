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
        <div className={styles.kicker}>Sürüm Bilgisi</div>
        <div className={styles.row}>
          <span>Sürüm</span>
          <strong>{PRODUCT_VERSION}</strong>
        </div>
        {PRODUCT_VERSION_NOTES.map((note) => (
          <div key={note} className={styles.row}>
            <span>Değişiklik</span>
            <strong>{note}</strong>
          </div>
        ))}
      </section>

      <SettingsUpdateSection />

      <section className={styles.panel}>
        <div className={styles.row}>
          <span>Uygulama sürümü</span>
          <strong>
            {runtime?.app.name} {runtime?.app.version}
          </strong>
        </div>
        <div className={styles.row}>
          <span>Veritabanı bağlantısı</span>
          <strong>{connected ? "Bağlı" : "Bağlı değil"}</strong>
        </div>
        <div className={styles.row}>
          <span>Şema / migration sürümü</span>
          <strong>{storage?.schemaVersion ?? "—"}</strong>
        </div>
        <div className={styles.row}>
          <span>Kayıt sayısı</span>
          <strong>{storage?.recordCount ?? "—"}</strong>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.kicker}>Sistem Bilgileri</div>
        <div className={styles.row}>
          <span>İşletim sistemi</span>
          <strong>
            {runtime
              ? `${runtime.app.platform === "win32" ? "Windows" : runtime.app.platform === "darwin" ? "macOS" : runtime.app.platform} · ${runtime.app.arch}`
              : "…"}
          </strong>
        </div>
        <div className={styles.row}>
          <span>Lisans kaynağı</span>
          <strong>{runtime?.license.isMock ? "Geliştirme" : runtime?.license.source ?? "—"}</strong>
        </div>
        <div className={styles.row}>
          <span>Kullanıcı verisi</span>
          <code className={styles.path}>{storage?.userDataPath ?? "…"}</code>
        </div>
        <div className={styles.row}>
          <span>Veritabanı dosyası</span>
          <code className={styles.path}>{storage?.databasePath ?? "…"}</code>
        </div>
        <div className={styles.row}>
          <span>Yedekleme dizini</span>
          <code className={styles.path}>{storage?.backupsPath ?? "…"}</code>
        </div>
      </section>
    </div>
  );
}
