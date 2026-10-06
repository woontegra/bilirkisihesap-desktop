import { describe, expect, it } from "vitest";
import { canEnterLicensedApp } from "./licenseAccess";
import { presentTrialFailure, reducePaidActivation, reduceTrialAttempt } from "./trialNotice";

const pending = {
  stateLabel: "Aktivasyon bekleniyor",
  statusMessage: "Lisans aktivasyonu bekleniyor.",
  paidFormMessage: null,
};

describe("trial failure notice", () => {
  it("shows the backend Turkish message in the trial card and replaces the pending banner", () => {
    const next = reduceTrialAttempt({
      ...pending,
      result: {
        ok: false,
        message: "Bu ürün için otomatik deneme lisansı verilmez",
      },
    });
    expect(next.trialCardMessage).toBe("Bu ürün için otomatik deneme lisansı verilmez");
    expect(next.bannerTitle).toBe("Deneme başlatılamadı");
    expect(next.bannerMessage).toBe(next.trialCardMessage);
    expect(next.bannerTitle).not.toBe("Aktivasyon bekleniyor");
    expect(next.paidFormMessage).toBeNull();
    expect(next.entersApp).toBe(false);
    expect(canEnterLicensedApp({ state: "pending" })).toBe(false);
  });

  it("does not show a bare error code to the user", () => {
    expect(presentTrialFailure("TRIAL_NOT_AVAILABLE_FOR_PRODUCT").message).toBe(
      "Ücretsiz deneme başlatılamadı.",
    );
  });

  it("clears the trial error after success and lets an active license into the app", () => {
    const failed = reduceTrialAttempt({
      ...pending,
      result: { ok: false, message: "Bu ürün için otomatik deneme lisansı verilmez" },
    });
    const next = reduceTrialAttempt({
      stateLabel: pending.stateLabel,
      statusMessage: pending.statusMessage,
      paidFormMessage: failed.paidFormMessage,
      result: { ok: true, state: "active", message: "7 günlük deneme başlatıldı" },
    });
    expect(failed.trialCardMessage).toBeTruthy();
    expect(next.trialCardMessage).toBeNull();
    expect(next.bannerTitle).toBe("Aktif");
    expect(next.entersApp).toBe(true);
    expect(canEnterLicensedApp({ state: "active" })).toBe(true);
  });
});

describe("paid activation notice", () => {
  it("keeps the activation message on the paid form", () => {
    const paid = reducePaidActivation({ ok: false, message: "Lisans anahtarı ve aktivasyon şifresi zorunludur." });
    const trial = reduceTrialAttempt({
      ...pending,
      paidFormMessage: paid.paidFormMessage,
      result: { ok: false, message: "Ücretsiz deneme başlatılamadı." },
    });
    expect(paid.paidFormMessage).toBe("Lisans anahtarı ve aktivasyon şifresi zorunludur.");
    expect(trial.paidFormMessage).toBe(paid.paidFormMessage);
    expect(trial.trialCardMessage).not.toBe(paid.paidFormMessage);
  });
});
