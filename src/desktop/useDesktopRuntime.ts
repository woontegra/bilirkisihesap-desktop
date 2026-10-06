import { useOutletContext } from "react-router-dom";
import { useLicenseRuntime } from "../license/LicenseRuntimeContext";
import type { DesktopRuntime } from "../shell/AppShell";

export function useDesktopRuntime(): DesktopRuntime | null {
  const fromOutlet = useOutletContext<DesktopRuntime | null>();
  const fromGate = useLicenseRuntime();
  return fromOutlet ?? fromGate;
}
