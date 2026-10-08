export type DesktopEntryStep = "app" | "choose" | "login" | "local-setup" | "blocked";

export type LoginSecondaryAction = "forgot-password" | "start-demo" | "activate-license" | "renew-license";

/** Müvekkil Kasa: açık lisans ve yerel hesap varken yalnız giriş. Demo ve etkinleştirme ilk kurulumda kalır. */
export function loginSecondaryActions(input: {
  step: DesktopEntryStep;
  storedKind: "paid" | "trial" | "none";
}): LoginSecondaryAction[] {
  if (input.step === "login") return ["forgot-password"];
  if (input.step === "choose") return ["start-demo", "activate-license"];
  if (input.step === "blocked" && input.storedKind === "paid") return ["renew-license", "activate-license"];
  if (input.step === "blocked") return ["activate-license"];
  return [];
}

export function desktopEntryStep(input: {
  signedIn: boolean;
  storedKind: "paid" | "trial" | "none";
  account: "ready" | "missing";
  licenseOpen: boolean;
}): DesktopEntryStep {
  if (input.storedKind !== "none" && !input.licenseOpen) return "blocked";
  if (input.signedIn && input.licenseOpen) return "app";
  if (input.storedKind === "none") return "choose";
  if (input.account === "missing") return "local-setup";
  return "login";
}

export function sessionAllowsProtectedCall(signedIn: boolean): boolean {
  return signedIn;
}

/** Yerel parola lisans sunucusundaki hesaba bağlı değildir. Kapalı lisans giriş açmaz. */
export function entryStepWithoutAuthServer(input: {
  licenseOpen: boolean;
  storedKind: "paid" | "trial" | "none";
  hasLocalAccount: boolean;
}): { step: DesktopEntryStep; needsInternetForFirstLogin: boolean } {
  return {
    step: desktopEntryStep({
      signedIn: false,
      storedKind: input.storedKind,
      account: input.hasLocalAccount ? "ready" : "missing",
      licenseOpen: input.licenseOpen,
    }),
    needsInternetForFirstLogin: false,
  };
}

/** Parola yerelde doğrulanır. Kapalı lisans doğru parolayla da açılmaz. */
export function offlineSessionAllowed(input: { licenseOpen: boolean; passwordMatches: boolean }): boolean {
  return input.licenseOpen && input.passwordMatches;
}
