/** Platform-aware Bilirkişi Hesap update feed URLs. Product version is shared; feeds are not. */
export const WINDOWS_UPDATE_FEED_URL =
  "https://updates.woontegra.com/updates/bilirkisi-hesap-desktop/windows";

/** Reserved for future macOS updater — do not use from Windows code paths. */
export const MACOS_UPDATE_FEED_URL =
  "https://updates.woontegra.com/updates/bilirkisi-hesap/macos";

export function resolveUpdateFeedUrl(platform: NodeJS.Platform = process.platform): string | null {
  if (platform === "win32") return WINDOWS_UPDATE_FEED_URL;
  if (platform === "darwin") return MACOS_UPDATE_FEED_URL;
  return null;
}

export const SETUP_ARTIFACT_BASENAME = (version: string) => `Bilirkisi-Hesap-Setup-${version}.exe`;
