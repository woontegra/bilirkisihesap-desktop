import { useLocation } from "react-router-dom";
import { NAV_GROUPS } from "../shell/nav";
import styles from "./pages.module.css";

export function PlaceholderPage() {
  const location = useLocation();
  const item = NAV_GROUPS.flatMap((group) => group.items).find((entry) => entry.path === location.pathname);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.kicker}>Sonraki faz</div>
        <h2>{item?.label ?? "Modül"}</h2>
        <p>{item?.phaseNote ?? "Bu bölüm henüz taşınmadı."}</p>
      </section>
      <section className={styles.panel}>
        <span>Faz 1 kapsamı</span>
        <p className={styles.body}>
          Hesaplama motorları, kayıtlı dosyalar, yedekleme ve gerçek lisans aktivasyonu bu
          iskelete sonraki fazlarda eklenecektir. Menü yapısı frontendV3.5 ile uyum için
          şimdiden yerleştirildi.
        </p>
      </section>
    </div>
  );
}
