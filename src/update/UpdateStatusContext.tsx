import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { UpdateStatusSnapshot } from "@shared/updateTypes";

type UpdateStatusContextValue = {
  status: UpdateStatusSnapshot | null;
  refresh: () => Promise<void>;
};

const UpdateStatusContext = createContext<UpdateStatusContextValue | null>(null);

export function UpdateStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatusSnapshot | null>(null);

  const refresh = useCallback(async () => {
    try {
      const api = window.bilirkisiDesktop;
      if (!api?.updateGetStatus) return;
      const next = await api.updateGetStatus();
      setStatus(next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    void refresh();
    const api = window.bilirkisiDesktop;
    if (api?.onUpdateStatusChanged) {
      unsub = api.onUpdateStatusChanged((next) => setStatus(next));
    }
    return () => {
      unsub?.();
    };
  }, [refresh]);

  const value = useMemo(() => ({ status, refresh }), [status, refresh]);

  return <UpdateStatusContext.Provider value={value}>{children}</UpdateStatusContext.Provider>;
}

export function useUpdateStatus(): UpdateStatusContextValue {
  const ctx = useContext(UpdateStatusContext);
  if (!ctx) {
    throw new Error("useUpdateStatus yalnızca UpdateStatusProvider içinde kullanılabilir.");
  }
  return ctx;
}
