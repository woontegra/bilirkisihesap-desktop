/** Platform-aware Bilirkişi Hesap update feed URLs. Product version is shared; feeds are not. */
export const WINDOWS_UPDATE_FEED_URL =
  "https://updates.woontegra.com/updates/bilirkisi-hesap-desktop/windows";

/** macOS generic feed. electron-updater loads latest-mac.yml and installs the ZIP, not the DMG. */
export const MACOS_UPDATE_FEED_URL =
  "https://updates.woontegra.com/updates/bilirkisi-hesap-desktop/macos";

export function resolveUpdateFeedUrl(platform: NodeJS.Platform = process.platform): string | null {
  if (platform === "win32") return WINDOWS_UPDATE_FEED_URL;
  if (platform === "darwin") return MACOS_UPDATE_FEED_URL;
  return null;
}

export const SETUP_ARTIFACT_BASENAME = (version: string) => `Bilirkisi-Hesap-Setup-${version}.exe`;
