import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readWebsiteDevOrigin, websiteViteConfigPath } from "../../scripts/websiteDevOrigin.mjs";

describe("website dev origin", () => {
  it("reads the FrontendV4 Vite dev port instead of inventing one", () => {
    const config = readFileSync(websiteViteConfigPath(), "utf8");
    const port = config.match(/server:\s*\{[^]*?port:\s*(\d+)/)?.[1];
    expect(port).toBeTruthy();
    expect(readWebsiteDevOrigin()).toBe(`http://localhost:${port}`);
    expect(readWebsiteDevOrigin()).not.toBe("http://localhost:5173");
  });
});
