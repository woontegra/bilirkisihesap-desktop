import { useOutletContext } from "react-router-dom";
import type { DesktopRuntime } from "../shell/AppShell";

export function useDesktopRuntime(): DesktopRuntime | null {
  return useOutletContext<DesktopRuntime | null>();
}
