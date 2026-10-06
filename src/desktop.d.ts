import type { DesktopApi } from "../shared/desktop-contract";

declare global {
  interface Window {
    bilirkisiDesktop: DesktopApi;
  }
}

export {};
