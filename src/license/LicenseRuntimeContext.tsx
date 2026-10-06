import { createContext, useContext } from "react";
import type { DesktopRuntime } from "../shell/AppShell";

export const LicenseRuntimeContext = createContext<DesktopRuntime | null>(null);

export function useLicenseRuntime(): DesktopRuntime | null {
  return useContext(LicenseRuntimeContext);
}
