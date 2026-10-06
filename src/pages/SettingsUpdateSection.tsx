import { useEffect, useRef, useState } from "react";
import type { UpdateStatusSnapshot } from "@shared/updateTypes";
import { useUpdateStatus } from "../update/UpdateStatusContext";
import styles from "./pages.module.css";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`;
  }
  return `${(n / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

function stateLabel(state: UpdateStatusSnapshot["state"]): string {
  switch (state) {
    case "checking":
      return "Kontrol ediliyor…";
    case "available":
      return "Yeni sürüm mevcut";
    case "not-available":
      return "Güncel";
    case "downloading":
      return "İndiriliyor…";
    case "downloaded":
      return "Kuruluma hazır";
    case "installing":
      return "Yedek alınıyor / kuruluyor…";
    case "error":
      return "Hata";
    default:
      return "Hazır";
  }
}

export function SettingsUpdateSection() {
  const { status, refresh } = useUpdateStatus();
  const [checkBusy, setCheckBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const checkBusyRef = useRef(false);
  const actionBusyRef = useRef(false);
  const prevStateRef = useRef<UpdateStatusSnapshot["state"] | null>(status?.state ?? null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!status) return;
    const prev = prevStateRef.current;
    prevStateRef.current = status.state;
    if (status.lastCheckSource !== "manual") return;
    if (status.state === "not-available" && prev === "checking") {
      setLocalMessage("Programın en güncel sürümünü kullanıyorsunuz.");
    } else if (status.state === "available" && prev !== "available") {
      setLocalMessage("Yeni sürüm bulundu.");
    } else if (status.state === "downloaded" && prev !== "downloaded") {
      setLocalMessage("Güncelleme indirildi ve kuruluma hazır.");
    } else if (status.state === "error" && status.errorMessage && prev !== "error") {
      setLocalMessage(status.errorMessage);
    }
  }, [status]);

  async function kontrolEt() {
    if (checkBusyRef.current) return;
    checkBusyRef.current = true;
    setCheckBusy(true);
    setLocalMessage("Güncellemeler kontrol ediliyor…");
    try {
      const r = await window.bilirkisiDesktop.updateCheck("manual");
      if (!r.ok) setLocalMessage(r.error);
    } catch {
      setLocalMessage("Güncelleme kontrolü başarısız.");
    } finally {
      setCheckBusy(false);
      checkBusyRef.current = false;
    }
  }

  async function indir() {
    if (actionBusyRef.current || status?.state === "downloading") return;
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      const r = await window.bilirkisiDesktop.updateDownload();
      if (!r.ok) setLocalMessage(r.error);
    } catch {
      setLocalMessage("Güncelleme indirilemedi.");
    } finally {
      setActionBusy(false);
      actionBusyRef.current = false;
    }
  }

  async function kur() {
    if (actionBusyRef.current || status?.state === "installing") return;
    actionBusyRef.current = true;
    setActionBusy(true);
    try {
      const r = await window.bilirkisiDesktop.updateInstall();
      if (!r.ok) setLocalMessage(r.error);
    } catch {
      setLocalMessage("Güncelleme kurulamadı.");
    } finally {
      setActionBusy(false);
      actionBusyRef.current = false;
    }
  }

  const pct =
    status?.progress != null ? Math.min(100, Math.max(0, Math.round(status.progress.percent))) : 0;

  return (
    <section className={styles.panel}>
      <div className={styles.kicker}>Uygulama ve Güncelleme</div>
      <div className={styles.row}>
        <span>Mevcut sürüm</span>
        <strong>{status?.currentVersion ?? "—"}</strong>
      </div>
      <div className={styles.row}>
        <span>Durum</span>
        <strong>{stateLabel(status?.state ?? "idle")}</strong>
      </div>
      {status?.availableVersion ? (
        <div className={styles.row}>
          <span>Yeni sürüm</span>
          <strong>{status.availableVersion}</strong>
        </div>
      ) : null}
      {status && !status.packaged ? (
        <p className={styles.note}>Geliştirme modunda gerçek üretim feed kontrolü yapılmaz.</p>
      ) : (
        <p className={styles.note}>Otomatik güncelleme kontrolü: Etkin (Windows paketli sürüm).</p>
      )}

      {status?.state === "downloading" ? (
        <div className={styles.row}>
          <span>İndirme ilerlemesi</span>
          <strong>%{pct}</strong>
          <span>
            {formatBytes(status.progress?.transferred ?? NaN)} / {formatBytes(status.progress?.total ?? NaN)}
          </span>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.button}
          disabled={checkBusy || actionBusy}
          onClick={() => void kontrolEt()}
        >
          {checkBusy ? "Kontrol ediliyor…" : "Güncellemeleri Kontrol Et"}
        </button>
        {status?.state === "available" ? (
          <button type="button" className={styles.button} disabled={actionBusy} onClick={() => void indir()}>
            Güncellemeyi İndir
          </button>
        ) : null}
        {status?.state === "downloaded" || status?.state === "installing" ? (
          <button type="button" className={styles.button} disabled={actionBusy} onClick={() => void kur()}>
            {status.state === "installing" ? "Kuruluyor…" : "Yeniden Başlat ve Güncelle"}
          </button>
        ) : null}
      </div>

      {localMessage ? <p className={styles.note}>{localMessage}</p> : null}
      {status?.errorMessage ? (
        <p className={styles.error} role="alert">
          {status.errorMessage}
        </p>
      ) : null}
    </section>
  );
}
