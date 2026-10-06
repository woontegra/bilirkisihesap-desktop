/**
 * Hesaplama eğitim videosu (YouTube iframe) için paketlenmiş uygulama güvenlik ayarları.
 * Uygulama belgesine yazılan CSP yalnız iki YouTube çerçeve kaynağına izin verir.
 */

export const VIDEO_FRAME_SOURCES = ["https://www.youtube.com", "https://www.youtube-nocookie.com"] as const;

export const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "script-src 'self'",
  "connect-src 'self'",
  `frame-src ${VIDEO_FRAME_SOURCES.join(" ")}`,
].join("; ");

/** YouTube, file:// kaynaklı gömmeleri kimliksiz sayar (Error 153); gömme isteğine uygulama kimliği yazılır. */
export const VIDEO_EMBED_REFERER = "https://bilirkisihesap.com/";

export const VIDEO_EMBED_REQUEST_URLS = VIDEO_FRAME_SOURCES.map((origin) => `${origin}/embed/*`);

const VIDEO_PROVIDER_HOST_SUFFIXES = ["youtube.com", "youtube-nocookie.com", "ytimg.com", "googlevideo.com"];

function isVideoProviderHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return VIDEO_PROVIDER_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** Uygulama CSP'si YouTube oynatıcısının kendi belge ve betik yanıtlarına yazılmaz; aksi hâlde oynatıcı açılmaz. */
export function shouldApplyAppCsp(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:") return true;
    return !isVideoProviderHost(hostname);
  } catch {
    return true;
  }
}

export function withVideoEmbedReferer(headers: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== "referer") next[name] = value;
  }
  next.Referer = VIDEO_EMBED_REFERER;
  return next;
}
