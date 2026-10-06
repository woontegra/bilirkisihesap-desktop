const ERROR_CODE_ONLY = /^[A-Z0-9_]+$/;

export function presentTrialFailure(message: string | null | undefined): { title: string; message: string } {
  const text = (message ?? "").trim();
  const userText = !text || ERROR_CODE_ONLY.test(text) ? "Ücretsiz deneme başlatılamadı." : text;
  return { title: "Deneme başlatılamadı", message: userText };
}

export function reduceTrialAttempt(input: {
  stateLabel: string;
  statusMessage: string;
  paidFormMessage: string | null;
  result: { ok: boolean; message: string; state?: string };
}): {
  trialCardMessage: string | null;
  paidFormMessage: string | null;
  bannerTitle: string;
  bannerMessage: string;
  entersApp: boolean;
} {
  if (!input.result.ok) {
    const notice = presentTrialFailure(input.result.message);
    return {
      trialCardMessage: notice.message,
      paidFormMessage: input.paidFormMessage,
      bannerTitle: notice.title,
      bannerMessage: notice.message,
      entersApp: false,
    };
  }
  const active = input.result.state === "active";
  return {
    trialCardMessage: null,
    paidFormMessage: input.result.message,
    bannerTitle: active ? "Aktif" : input.stateLabel,
    bannerMessage: input.result.message || input.statusMessage,
    entersApp: active,
  };
}

export function reducePaidActivation(result: { ok: boolean; message: string }): { paidFormMessage: string } {
  return { paidFormMessage: result.message };
}
