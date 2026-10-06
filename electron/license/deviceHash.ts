import { createHash } from "node:crypto";
import os from "node:os";

const SALT = "woontegra-bilirkisi-hesap-desktop-v1";

export function computeDeviceHash(): string {
  const parts = [
    os.hostname(),
    os.platform(),
    os.arch(),
    process.env.COMPUTERNAME ?? "",
    process.env.PROCESSOR_IDENTIFIER ?? "",
    SALT,
  ];
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

export function getDeviceName(): string {
  return (os.hostname() || "Desktop").slice(0, 200);
}

export function getPlatformLabel(): string {
  return `${os.platform()}-${os.arch()}`;
}

export function entitlementPlatformFromOs(platform: string): "WINDOWS" | "MACOS" | null {
  const value = platform.trim().toLowerCase();
  if (value === "win32" || value.startsWith("win")) return "WINDOWS";
  if (value === "darwin" || value === "mac" || value.startsWith("macos")) return "MACOS";
  return null;
}

export function getEntitlementPlatform(): "WINDOWS" | "MACOS" | null {
  return entitlementPlatformFromOs(os.platform());
}
