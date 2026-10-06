import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("dev:license startup", () => {
  it("starts the same vite dev pipeline with only the mock disabled", () => {
    const script = readFileSync(path.join(root, "scripts/dev-license.mjs"), "utf8");
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.dev).toBe("vite");
    expect(pkg.scripts["dev:license"]).toBe("node scripts/dev-license.mjs");
    expect(script).toContain('spawn("npm", ["run", "dev"]');
    expect(script).toContain('LICENSE_USE_MOCK: "0"');
    expect(script).not.toContain("run-dev.mjs");
    expect(script).not.toContain("ELECTRON_SKIP");
    expect(script).not.toContain("esbuild");
  });

  it("keeps electron-log outside the vite electron main bundle", () => {
    const viteConfig = readFileSync(path.join(root, "vite.config.ts"), "utf8");
    expect(viteConfig).toMatch(/external:\s*\[[^\]]*["']electron-log["']/s);
  });
});
