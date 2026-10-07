import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import * as esbuild from "esbuild";
import type { Plugin, ViteDevServer } from "vite";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
// @ts-expect-error websiteDevOrigin.mjs has no declaration file
import { readWebsiteDevOrigin } from "./scripts/websiteDevOrigin.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const preloadOutFile = path.join(rootDir, "dist-electron/preload.cjs");

async function bundlePreload(): Promise<void> {
  mkdirSync(path.dirname(preloadOutFile), { recursive: true });
  await esbuild.build({
    absWorkingDir: rootDir,
    entryPoints: [path.join(rootDir, "electron/preload.ts")],
    outfile: preloadOutFile,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["electron"],
    sourcemap: true,
    logOverride: { "empty-import-meta": "silent" },
  });
}

function electronPreloadPlugin(): Plugin {
  return {
    name: "electron-preload-cjs",
    async buildStart() {
      await bundlePreload();
    },
    configureServer(server: ViteDevServer) {
      const restartPreload = async () => {
        await bundlePreload();
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.add(path.join(rootDir, "electron/preload.ts"));
      server.watcher.add(path.join(rootDir, "shared/desktop-contract.ts"));
      server.watcher.on("change", (file) => {
        if (file.endsWith("preload.ts") || file.endsWith("desktop-contract.ts")) {
          void restartPreload();
        }
      });
    },
  };
}

const skipElectron = process.env.ELECTRON_SKIP === "1";

export default defineConfig(({ command }) => {
  if (command === "serve") {
    const websiteDevOrigin = readWebsiteDevOrigin();
    if (websiteDevOrigin) process.env.SUBSCRIPTION_WEBSITE_DEV_BASE = websiteDevOrigin;
  }

  return {
  root: rootDir,
  base: "./",
  resolve: {
    alias: {
      "@": path.join(rootDir, "src"),
      "@shared": path.join(rootDir, "shared"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [
    react(),
    electronPreloadPlugin(),
    ...(skipElectron
      ? []
      : [
          electron([
            {
              entry: "electron/main.ts",
              onstart({ startup }) {
                const websiteDevOrigin = readWebsiteDevOrigin();
                const env = { ...process.env };
                if (websiteDevOrigin) env.SUBSCRIPTION_WEBSITE_DEV_BASE = websiteDevOrigin;
                void Promise.resolve(startup([".", "--no-sandbox"], { env })).catch(() => undefined);
              },
              vite: {
                define: {
                  "process.env.LICENSE_USE_MOCK": JSON.stringify(process.env.LICENSE_USE_MOCK ?? ""),
                  "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
                },
                build: {
                  outDir: "dist-electron",
                  sourcemap: true,
                  emptyOutDir: false,
                  rollupOptions: {
                    external: ["better-sqlite3", "electron-updater", "electron-log"],
                    output: {
                      entryFileNames: "main.js",
                      format: "es",
                    },
                  },
                },
                resolve: {
                  alias: {
                    "@shared": path.join(rootDir, "shared"),
                  },
                },
              },
            },
          ]),
        ]),
  ],
  };
});
