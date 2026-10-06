import { useCallback, useState } from "react";
import type { UpdateStatusSnapshot } from "@shared/updateTypes";
import { useUpdateStatus } from "./UpdateStatusContext";
import styles from "./UpdatePrompt.module.css";

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`;
  }
  return `${(n / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "—";
  return `${formatBytes(bps)}/sn`;
}

function canDismissModal(state: UpdateStatusSnapshot["state"]): boolean {
  return state !== "downloading" && state !== "installing";
}

export function UpdatePromptHost() {
  const { status } = useUpdateStatus();
  const [busy, setBusy] = useState(false);

  const onDismiss = useCallback(async () => {
    await window.bilirkisiDesktop.updateDismiss();
  }, []);

  if (!status) return null;
  const snap = status;

  const showModal =
    snap.showPrompt &&
    (snap.state === "available" ||
      snap.state === "downloading" ||
      snap.state === "downloaded" ||
      snap.state === "installing" ||
      (snap.state === "error" && Boolean(snap.errorMessage)));

  const showInfo =
    !showModal && Boolean(snap.infoMessage) && snap.lastCheckSource === "manual";

  async function onDownload() {
    if (busy || snap.state === "downloading") return;
    setBusy(true);
    try {
      await window.bilirkisiDesktop.updateDownload();
    } finally {
      setBusy(false);
    }
  }

  async function onInstall() {
    if (busy || snap.state === "installing") return;
    setBusy(true);
    try {
      await window.bilirkisiDesktop.updateInstall();
    } finally {
      setBusy(false);
    }
  }

  async function onRetry() {
    if (busy) return;
    setBusy(true);
    try {
      if (snap.availableVersion && (snap.state === "error" || snap.state === "available")) {
        await window.bilirkisiDesktop.updateDownload();
      } else {
        await window.bilirkisiDesktop.updateCheck("manual");
      }
    } finally {
      setBusy(false);
    }
  }

  if (showInfo && snap.infoMessage) {
    return (
      <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="update-info-title">
        <div className={styles.modal}>
          <h2 id="update-info-title" className={styles.title}>
            Programınız güncel
          </h2>
          <p className={styles.text}>En güncel Bilirkişi Hesap sürümünü kullanıyorsunuz.</p>
          <p className={styles.version}>
            Mevcut sürüm: <strong>{status.currentVersion}</strong>
          </p>
          <div className={styles.footer}>
            <button type="button" className={styles.primary} onClick={() => void onDismiss()}>
              Tamam
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showModal) return null;

  const downloading = status.state === "downloading";
  const downloaded = status.state === "downloaded" || status.state === "installing";
  const isError = status.state === "error";
  const pct = status.progress ? Math.min(100, Math.max(0, Math.round(status.progress.percent))) : 0;
  const closeAllowed = canDismissModal(status.state);

  let title = "Yeni güncelleme hazır";
  if (downloading) title = "Güncelleme indiriliyor";
  else if (status.state === "installing") title = "Yedek alınıyor / güncelleme hazırlanıyor";
  else if (downloaded) title = "Güncelleme indirildi";
  else if (isError) title = "Güncelleme tamamlanamadı";

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="update-modal-title">
      <div className={styles.modal}>
        <h2 id="update-modal-title" className={styles.title}>
          {title}
        </h2>

        {downloading ? (
          <div className={styles.progress}>
            <div className={styles.progressHead}>
              <span>İndirme ilerlemesi</span>
              <strong>%{pct}</strong>
            </div>
            <div className={styles.progressBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.progressMeta}>
              <span>
                {formatBytes(status.progress?.transferred ?? NaN)} / {formatBytes(status.progress?.total ?? NaN)}
              </span>
              <span>{formatSpeed(status.progress?.bytesPerSecond ?? NaN)}</span>
            </div>
          </div>
        ) : isError ? (
          <p className={styles.error}>{status.errorMessage}</p>
        ) : (
          <>
            <p className={styles.version}>
              Mevcut: <strong>{status.currentVersion}</strong>
              {status.availableVersion ? (
                <>
                  {" "}
                  → Yeni: <strong className={styles.newVersion}>{status.availableVersion}</strong>
                </>
              ) : null}
            </p>
            {status.state === "installing" ? (
              <p className={styles.text}>Kurulum öncesi veri yedeği alınıyor…</p>
            ) : null}
            {status.releaseNotes?.trim() ? (
              <div className={styles.notes}>
                <h3>Bu sürümde neler değişti?</h3>
                <ul>
                  {status.releaseNotes
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => (
                      <li key={line}>{line.replace(/^[-*•]\s*/, "")}</li>
                    ))}
                </ul>
              </div>
            ) : null}
          </>
        )}

        <div className={styles.footer}>
          {downloaded ? (
            <>
              <button
                type="button"
                className={styles.ghost}
                disabled={busy || status.state === "installing" || !closeAllowed}
                onClick={() => void onDismiss()}
              >
                Daha sonra
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={busy || status.state === "installing"}
                onClick={() => void onInstall()}
              >
                {status.state === "installing" ? "Güncelleme hazırlanıyor…" : "Yeniden başlat ve güncelle"}
              </button>
            </>
          ) : isError ? (
            <>
              <button type="button" className={styles.ghost} onClick={() => void onDismiss()}>
                Kapat
              </button>
              <button type="button" className={styles.primary} disabled={busy} onClick={() => void onRetry()}>
                Tekrar dene
              </button>
            </>
          ) : downloading ? null : (
            <>
              <button type="button" className={styles.ghost} disabled={!closeAllowed} onClick={() => void onDismiss()}>
                Daha sonra
              </button>
              <button type="button" className={styles.primary} disabled={busy || downloading} onClick={() => void onDownload()}>
                İndir
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
