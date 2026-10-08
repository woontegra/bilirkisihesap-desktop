import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DesktopAuthView } from "../../shared/desktop-contract";

type DesktopAuthContextValue = {
  loading: boolean;
  signedIn: boolean;
  mock: boolean;
  view: DesktopAuthView | null;
  refresh: () => Promise<DesktopAuthView | null>;
  logout: () => Promise<void>;
};

const DesktopAuthContext = createContext<DesktopAuthContextValue | null>(null);

const EMPTY_VIEW: DesktopAuthView = {
  mock: false,
  signedIn: false,
  step: "blocked",
  licenseKind: "none",
  maskedEmail: null,
  message: "Masaüstü köprüsü yok.",
  username: null,
};

export function DesktopAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<DesktopAuthView | null>(null);

  const refresh = useCallback(async () => {
    const api = window.bilirkisiDesktop;
    if (!api?.getDesktopAuthView) {
      setView(EMPTY_VIEW);
      setLoading(false);
      return EMPTY_VIEW;
    }
    try {
      const next = await api.getDesktopAuthView();
      setView(next);
      setLoading(false);
      return next;
    } catch (error) {
      const failed: DesktopAuthView = {
        ...EMPTY_VIEW,
        message: error instanceof Error ? error.message : "Giriş durumu okunamadı",
      };
      setView(failed);
      setLoading(false);
      return failed;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onOnline = () => {
      void refresh();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  useEffect(() => {
    if (!view?.signedIn || view.mock) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh, view?.mock, view?.signedIn]);

  const logout = useCallback(async () => {
    await window.bilirkisiDesktop?.logoutDesktopAuth();
    await refresh();
  }, [refresh]);

  const value = useMemo<DesktopAuthContextValue>(
    () => ({
      loading,
      signedIn: Boolean(view?.signedIn),
      mock: Boolean(view?.mock),
      view,
      refresh,
      logout,
    }),
    [loading, logout, refresh, view],
  );

  return <DesktopAuthContext.Provider value={value}>{children}</DesktopAuthContext.Provider>;
}

export function useDesktopAuth(): DesktopAuthContextValue {
  const value = useContext(DesktopAuthContext);
  if (!value) throw new Error("DesktopAuthProvider yok");
  return value;
}
