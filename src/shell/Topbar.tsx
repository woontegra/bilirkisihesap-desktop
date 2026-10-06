import { Video } from "lucide-react";
import { useLocation } from "react-router-dom";
import { CalculationVideoButton } from "@/components/calculation-video";
import styles from "./Topbar.module.css";

type Props = {
  title: string;
  version: string;
  osLabel: string;
};

export function Topbar({ title, version, osLabel }: Props) {
  const location = useLocation();
  return (
    <header className={styles.topbar}>
      <div className={styles.videoActions}>
        <a
          href="https://www.youtube.com/@woontegra_teknoloji"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.trainingLink}
          title="Eğitim Videoları"
        >
          <Video size={15} aria-hidden />
          <span>Eğitim Videoları</span>
        </a>
        <CalculationVideoButton pathname={location.pathname} />
      </div>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.meta}>
        <span className={styles.chip}>Sürüm {version}</span>
        <span className={styles.chip}>{osLabel}</span>
      </div>
    </header>
  );
}
