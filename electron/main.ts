import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, shell } from "electron";
import { closeDatabase, getDatabase, openDatabase } from "./db/database";
import { runDatabaseSmokeTest } from "./db/smoke";
import { loadDesktopEnv } from "./env";
import { registerIpcHandlers } from "./ipc";
import { getDepositInterestRates } from "./icra/depositInterestService";
import { getDepositSeriesConfig } from "./icra/tcmbEvds";
import { createLicenseClient } from "./license/createLicenseClient";
import { getBackupsPath, getUserDataRoot } from "./paths";
import {
  APP_CONTENT_SECURITY_POLICY,
  shouldApplyAppCsp,
  VIDEO_EMBED_REQUEST_URLS,
  withVideoEmbedReferer,
} from "./security/videoEmbed";
import { initUpdateService, scheduleAutoUpdateCheck } from "./update/updateService";

loadDesktopEnv();

if (process.argv.some((arg) => arg.includes("evds-smoke"))) {
  writeFileSync(
    path.join(process.cwd(), ".evds-smoke-boot.txt"),
    JSON.stringify({
      argv: process.argv,
      cwd: process.cwd(),
      keyPresent: Boolean(String(process.env.TCMB_EVDS_API_KEY ?? "").trim()),
      keyLength: String(process.env.TCMB_EVDS_API_KEY ?? "").trim().length,
    }),
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_NAME = "Bilirkişi Hesap";
const APP_VERSION = readAppVersion();

function readAppVersion(): string {
  try {
    const packageJsonPath = path.join(app.getAppPath(), "package.json");
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    return parsed.version ?? "3.6.7";
  } catch {
    return "3.6.7";
  }
}

function resolvePreloadPath(): string {
  return path.join(__dirname, "preload.cjs");
}

function ensureLocalDirectories(): void {
  const directories = [
    getUserDataRoot(),
    path.join(getUserDataRoot(), "data"),
    getBackupsPath(),
  ];
  for (const directory of directories) {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
  }
}

function resolveWindowIcon(): string | undefined {
  const names = ["icon.png", "icon.ico"];
  const roots = [path.join(process.cwd(), "build"), path.join(__dirname, "..", "build"), process.resourcesPath];
  for (const root of roots) {
    for (const name of names) {
      const candidate = path.join(root, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

function createMainWindow(): BrowserWindow {
  const isDev = !app.isPackaged;
  const icon = resolveWindowIcon();
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    backgroundColor: "#eef1f6",
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const allowedDev = isDev && url.startsWith("http://localhost");
    const allowedFile = url.startsWith("file:");
    if (!allowedDev && !allowedFile) {
      event.preventDefault();
    }
  });

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error("Sayfa yüklenemedi:", code, description, url);
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    void window.loadURL("http://localhost:5173");
  } else {
    void window.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  window.once("ready-to-show", () => {
    window.show();
  });
  setTimeout(() => {
    if (!window.isDestroyed() && !window.isVisible()) {
      window.show();
    }
  }, 1200);

  return window;
}

app.setName(APP_NAME);
app.setAppUserModelId("com.woontegra.bilirkisihesap");

const isEvdsSmoke = process.argv.includes("--evds-smoke");
const gotLock = isEvdsSmoke ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const existing = BrowserWindow.getAllWindows()[0];
    if (existing) {
      if (existing.isMinimized()) {
        existing.restore();
      }
      existing.focus();
    }
  });

  void app.whenReady().then(async () => {
    if (isEvdsSmoke) {
      const resultPath = path.join(process.cwd(), ".evds-smoke-result.txt");
      writeFileSync(resultPath, JSON.stringify({ stage: "entered" }));
      try {
        ensureLocalDirectories();
        openDatabase();
        const cfg = getDepositSeriesConfig();
        const result = await getDepositInterestRates({
          startDate: "2019-05-11",
          endDate: "2025-08-12",
        });
        const sqliteCount = (
          getDatabase().prepare("SELECT COUNT(*) AS n FROM deposit_interest_rates").get() as { n: number }
        ).n;
        const payload = {
          ok: true,
          keyPresent: Boolean(cfg.apiKey),
          keyLength: cfg.apiKey.length,
          seriesCode: cfg.seriesCode,
          periodCount: result.periods.length,
          firstPeriod: result.periods[0] ?? null,
          lastPeriod: result.periods[result.periods.length - 1] ?? null,
          sqliteCount,
        };
        writeFileSync(resultPath, JSON.stringify(payload));
        process.stdout.write(`${JSON.stringify(payload)}\n`);
      } catch (error) {
        const cfg = getDepositSeriesConfig();
        const payload = {
          ok: false,
          keyPresent: Boolean(cfg.apiKey),
          keyLength: cfg.apiKey.length,
          message: error instanceof Error ? error.message : "evds-smoke-failed",
        };
        writeFileSync(resultPath, JSON.stringify(payload));
        process.stdout.write(`${JSON.stringify(payload)}\n`);
      }
      closeDatabase();
      app.exit(0);
      return;
    }

    if (app.isPackaged) {
      app.on("web-contents-created", (_event, contents) => {
        contents.session.webRequest.onHeadersReceived((details, callback) => {
          if (!shouldApplyAppCsp(details.url)) {
            callback({ responseHeaders: details.responseHeaders });
            return;
          }
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              "Content-Security-Policy": [APP_CONTENT_SECURITY_POLICY],
            },
          });
        });
        contents.session.webRequest.onBeforeSendHeaders(
          { urls: VIDEO_EMBED_REQUEST_URLS },
          (details, callback) => {
            callback({ requestHeaders: withVideoEmbedReferer(details.requestHeaders) });
          },
        );
      });
    }

    ensureLocalDirectories();
    openDatabase();

    const runSmoke = process.env.BILIRKISI_DB_SMOKE === "1" || process.argv.includes("--smoke");
    if (runSmoke) {
      const resultPath = path.join(__dirname, "..", ".smoke-result.txt");
      try {
        runDatabaseSmokeTest();
        writeFileSync(resultPath, "ok");
      } catch (error) {
        writeFileSync(resultPath, error instanceof Error ? error.message : "smoke-failed");
      }
      closeDatabase();
      app.quit();
      return;
    }

    const licenseClient = createLicenseClient();
    registerIpcHandlers(licenseClient, {
      name: APP_NAME,
      version: APP_VERSION,
      app,
    });
    initUpdateService();
    const mainWindow = createMainWindow();
    mainWindow.webContents.once("did-finish-load", () => {
      scheduleAutoUpdateCheck(5000);
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const win = createMainWindow();
        win.webContents.once("did-finish-load", () => {
          scheduleAutoUpdateCheck(5000);
        });
      }
    });
  });
}

app.on("before-quit", () => {
  closeDatabase();
});

app.on("window-all-closed", () => {
  if (isEvdsSmoke || process.argv.includes("--smoke")) {
    return;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
