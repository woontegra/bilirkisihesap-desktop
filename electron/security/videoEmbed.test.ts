import { describe, expect, it } from "vitest";
import {
  APP_CONTENT_SECURITY_POLICY,
  shouldApplyAppCsp,
  VIDEO_EMBED_REFERER,
  VIDEO_EMBED_REQUEST_URLS,
  withVideoEmbedReferer,
} from "./videoEmbed";

function directives(): Map<string, string> {
  return new Map(
    APP_CONTENT_SECURITY_POLICY.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")] as [string, string];
    }),
  );
}

describe("paketlenmiş uygulama CSP", () => {
  it("mevcut kısıtları korur ve frame-src yalnız iki YouTube kaynağına izin verir", () => {
    const csp = directives();
    expect(csp.get("default-src")).toBe("'self'");
    expect(csp.get("script-src")).toBe("'self'");
    expect(csp.get("connect-src")).toBe("'self'");
    expect(csp.get("style-src")).toBe("'self' 'unsafe-inline'");
    expect(csp.get("img-src")).toBe("'self' data:");
    expect(csp.get("frame-src")).toBe("https://www.youtube.com https://www.youtube-nocookie.com");
    expect(APP_CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(APP_CONTENT_SECURITY_POLICY).not.toMatch(/(^|\s)\*(\s|;|$)/);
  });

  it("uygulama belgelerine yazılır, YouTube oynatıcı yanıtlarına yazılmaz", () => {
    expect(shouldApplyAppCsp("file:///C:/app/dist/index.html")).toBe(true);
    expect(shouldApplyAppCsp("https://evds3.tcmb.gov.tr/x")).toBe(true);
    expect(shouldApplyAppCsp("https://www.youtube-nocookie.com/embed/abcdefghijk")).toBe(false);
    expect(shouldApplyAppCsp("https://www.youtube.com/s/player/base.js")).toBe(false);
    expect(shouldApplyAppCsp("https://i.ytimg.com/vi/x/hqdefault.jpg")).toBe(false);
    expect(shouldApplyAppCsp("https://youtube.com.evil.example/embed/x")).toBe(true);
    expect(shouldApplyAppCsp("https://notyoutube.com/embed/x")).toBe(true);
  });
});

describe("YouTube gömme kimliği", () => {
  it("yalnız iki kaynağın /embed/ isteklerini hedefler", () => {
    expect(VIDEO_EMBED_REQUEST_URLS).toEqual([
      "https://www.youtube.com/embed/*",
      "https://www.youtube-nocookie.com/embed/*",
    ]);
  });

  it("Referer başlığını tek kopya olarak uygulama kimliğiyle yazar", () => {
    const next = withVideoEmbedReferer({ referer: "file:///", Accept: "text/html" });
    expect(next).toEqual({ Accept: "text/html", Referer: VIDEO_EMBED_REFERER });
    expect(VIDEO_EMBED_REFERER.startsWith("https://")).toBe(true);
  });
});
