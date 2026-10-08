import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import { ensureNumericIdForUuid } from "../api/savedCases";
import type {
  DesktopAppInfo,
  DesktopLicenseStatus,
  DesktopStorageInfo,
} from "@shared/desktop-contract";
import { PAGE_TITLES } from "./nav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { UpdatePromptHost } from "../update/UpdatePromptHost";
import { WageInputGuard } from "../hooks/useDeferredFormMemo";
import styles from "./AppShell.module.css";

export type DesktopRuntime = {
  app: DesktopAppInfo;
  license: DesktopLicenseStatus;
  storage: DesktopStorageInfo;
  reload: () => Promise<void>;
};

function osLabel(platform: DesktopAppInfo["platform"], arch: string): string {
  const name = platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : platform;
  return `${name} · ${arch}`;
}

export function AppShell() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runtime, setRuntime] = useState<DesktopRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const api = window.bilirkisiDesktop;
    if (!api) {
      setError("Masaüstü köprüsü yüklenemedi. Uygulamayı Electron üzerinden açın.");
      return;
    }
    const [app, license, storage] = await Promise.all([
      api.getAppInfo(),
      api.getLicenseStatus(),
      api.getStorageInfo(),
    ]);
    setRuntime({ app, license, storage, reload });
  }, []);

  useEffect(() => {
    void reload().catch(() => {
      setError("Masaüstü bilgileri okunamadı.");
    });
  }, [location.pathname, reload]);

  useEffect(() => {
    const kayit = searchParams.get("kayit");
    const caseId = searchParams.get("caseId");
    if (!kayit || caseId) return;
    void ensureNumericIdForUuid(kayit)
      .then((numericId) => {
        const next = new URLSearchParams(searchParams);
        next.set("caseId", String(numericId));
        next.delete("kayit");
        setSearchParams(next, { replace: true });
      })
      .catch(() => undefined);
  }, [searchParams, setSearchParams]);

  const title =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith("/kidem-tazminati")
      ? "Kıdem Tazminatı"
      : location.pathname.startsWith("/fazla-mesai")
        ? "Fazla Mesai Alacağı"
        : location.pathname.startsWith("/ihbar-tazminati")
          ? "İhbar Tazminatı"
          : location.pathname.startsWith("/yillik-izin")
            ? "Yıllık Ücretli İzin Alacağı"
            : location.pathname.startsWith("/ubgt")
              ? "UBGT Alacağı"
              : location.pathname.startsWith("/hafta-tatili")
                ? "Hafta Tatili Alacağı"
                : location.pathname.startsWith("/icra-takip-brutten-nete")
                  ? "İcra Takip Brütten Nete"
                  : "Bilirkişi Hesap");

  const topMeta = useMemo(() => {
    if (!runtime) {
      return { version: "…", os: "…" };
    }
    return {
      version: runtime.app.version,
      os: osLabel(runtime.app.platform, runtime.app.arch),
    };
  }, [runtime]);

  return (
    <div className={styles.shell}>
      {runtime?.license.isOfflineGrace ? (
        <div className={styles.offlineBanner} role="status">
          {runtime.license.message}
        </div>
      ) : null}
      <Sidebar mockLicense={runtime?.license.isMock ?? false} />
      <div className={styles.main}>
        <Topbar title={title} version={topMeta.version} osLabel={topMeta.os} />
        <main className={styles.content}>
          <div className={styles.inner}>
            {error ? (
              <p>{error}</p>
            ) : (
              <WageInputGuard resetKey={location.pathname}>
                <Outlet context={runtime} />
              </WageInputGuard>
            )}
          </div>
        </main>
      </div>
      <UpdatePromptHost />
    </div>
  );
}
