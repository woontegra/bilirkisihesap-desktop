import type { LicenseClient } from "../license/LicenseClient";
import { sessionAllowsProtectedCall } from "../../shared/desktopAuthFlow";
import { AppError } from "../db/errors";

type Session = { token: string; username: string };

let session: Session | null = null;

export function setDesktopSession(next: Session | null): void {
  session = next;
}

export function getDesktopSession(): Session | null {
  return session;
}

export function requireDesktopSession(_licenseClient: LicenseClient): void {
  if (!sessionAllowsProtectedCall(session !== null)) {
    throw new AppError("Oturum gerekli. Giriş yapmadan bu işlem kullanılamaz.");
  }
}
