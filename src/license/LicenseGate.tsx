import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import type { DesktopRuntime } from "../shell/AppShell";
import { LicensePage } from "../pages/LicensePage";
import { canEnterLicensedApp } from "./licenseAccess";
import { LicenseRuntimeContext } from "./LicenseRuntimeContext";
import { setLicensedLocalWritesAllowed } from "./localWriteGuard";
import styles from "./LicenseGate.module.css";

export function LicenseGate() {
  const location = useLocation();
  const [runtime, setRuntime] = useState<DesktopRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const api = window.bilirkisiDesktop;
    if (!api) {
      setLicensedLocalWritesAllowed(false);
      setRuntime(null);
      setError("Masaüstü köprüsü yüklenemedi. Uygulamayı Electron üzerinden açın.");
      return;
    }
    const [app, license, storage] = await Promise.all([
      api.getAppInfo(),
      api.getLicenseStatus(),
      api.getStorageInfo(),
    ]);
    setLicensedLocalWritesAllowed(canEnterLicensedApp(license));
    setError(null);
    setRuntime({ app, license, storage, reload });
  }, []);

  useEffect(() => {
    void reload().catch(() => {
      setLicensedLocalWritesAllowed(false);
      setError("Lisans durumu okunamadı.");
    });
  }, [location.pathname, reload]);

  useEffect(() => {
    function onFocus(): void {
      void reload().catch(() => {
        setLicensedLocalWritesAllowed(false);
        setError("Lisans durumu okunamadı.");
      });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const accountScreen =
    location.pathname === "/ayarlar" || location.pathname === "/lisans";

  if (!runtime) {
    return (
      <div className={styles.status}>
        <p>{error ?? "Lisans durumu kontrol ediliyor…"}</p>
        {error ? (
          <button type="button" className={styles.retry} onClick={() => void reload()}>
            Yeniden dene
          </button>
        ) : null}
      </div>
    );
  }

  if (!canEnterLicensedApp(runtime.license) && !accountScreen) {
    return (
      <LicenseRuntimeContext.Provider value={runtime}>
        <p className={styles.lead}>
          Geçerli lisans veya deneme olmadan hesaplama ekranları, kayıtlı hesaplar ve diğer uygulama bölümleri açılmaz.
        </p>
        <LicensePage />
      </LicenseRuntimeContext.Provider>
    );
  }

  return (
    <LicenseRuntimeContext.Provider value={runtime}>
      <Outlet />
    </LicenseRuntimeContext.Provider>
  );
}
