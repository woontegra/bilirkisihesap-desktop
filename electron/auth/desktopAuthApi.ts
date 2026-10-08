import type { LicenseClient } from "../license/LicenseClient";
import { readStoredLicense } from "../license/licenseStore";
import { getDatabase } from "../db/database";
import { AppError } from "../db/errors";
import { desktopEntryStep } from "../../shared/desktopAuthFlow";
import type { DesktopAuthView } from "../../shared/desktop-contract";
import { getDesktopSession, setDesktopSession } from "./desktopUserSession";
import {
  countLocalUsers,
  loginLocalUser,
  resetLocalPassword,
  setupLocalUser,
  localSecurityQuestion,
  type LocalSetupInput,
} from "./localDesktopUser";

export type { DesktopAuthView };

function storedKind(kind: "paid" | "trial" | undefined, licenseKey: string | undefined): "paid" | "trial" | "none" {
  if (kind === "trial") return "trial";
  if (licenseKey) return "paid";
  return "none";
}

export async function getDesktopAuthView(licenseClient: LicenseClient): Promise<DesktopAuthView> {
  const status = await licenseClient.getStatus();
  const stored = readStoredLicense();
  const kind = licenseClient.source === "mock" && !stored ? "paid" : storedKind(stored?.kind, stored?.licenseKey);
  const licenseOpen = status.state === "active";
  const account = countLocalUsers(getDatabase()) > 0 ? "ready" : "missing";
  const current = getDesktopSession();
  if (current && !licenseOpen) {
    setDesktopSession(null);
  }
  const signedIn = Boolean(getDesktopSession()) && licenseOpen;
  const step = desktopEntryStep({
    signedIn,
    storedKind: kind,
    account,
    licenseOpen,
  });
  return {
    mock: licenseClient.source === "mock",
    signedIn,
    step,
    licenseKind: kind,
    maskedEmail: null,
    message: step === "blocked" ? status.message : null,
    username: signedIn ? getDesktopSession()?.username ?? null : null,
  };
}

export async function createDesktopAccount(input: LocalSetupInput): Promise<void> {
  const result = setupLocalUser(getDatabase(), input);
  if (!result.ok) throw new AppError(result.error);
  setDesktopSession({ token: "local", username: result.username });
}

export async function loginDesktopAccount(_licenseClient: LicenseClient, username: string, password: string): Promise<void> {
  const result = loginLocalUser(getDatabase(), username, password);
  if (!result.ok) throw new AppError(result.error);
  setDesktopSession({ token: "local", username: result.username });
}

export async function logoutDesktopAccount(): Promise<void> {
  setDesktopSession(null);
}

export async function startDesktopPasswordReset(username: string): Promise<{ securityQuestion: string }> {
  const result = localSecurityQuestion(getDatabase(), username);
  if (!result.ok) throw new AppError(result.error);
  return { securityQuestion: result.question };
}

export async function completeDesktopPasswordReset(input: {
  username: string;
  securityAnswer: string;
  newPassword: string;
}): Promise<void> {
  const result = resetLocalPassword(getDatabase(), {
    identity: input.username,
    securityAnswer: input.securityAnswer,
    newPassword: input.newPassword,
  });
  if (!result.ok) throw new AppError(result.error);
}
