import { computeIsKanunuResult, parseKidemFormPayload, validateDateRange } from "./engine";
import { isKidemKind, type KidemKind } from "./kinds";
import { deriveDateError, deriveGemiResult } from "./gemi/engine";
import { createEmptyGemiForm } from "./gemi/model";
import { deriveMevsimlikResult, deriveWarnings as deriveMevsimlikWarnings, recalculatePeriodDays } from "./mevsimlik/engine";
import { createEmptyMevsimlikForm } from "./mevsimlik/model";
import {
  adjustedTenure,
  calculateTotalBrut as calculateBasinTotalBrut,
  computeBrutKidem,
  computeCalismaSuresi,
  computeKidemSuresi,
  deriveBrutNet as deriveBasinBrutNet,
  kidemHakkiYok,
  parseNum as basinParseNum,
  resolveExitYear,
} from "./basin/engine";
import { emptyForm as emptyBasinForm, type BasinFormSnapshot } from "./basin/model";
import {
  calculateKismiKidem,
  calculatePeriodDays,
  calculateTotalBrut as calculateKismiTotalBrut,
  convertDaysToYilAyGun,
  deriveBrutNet as deriveKismiBrutNet,
  latestPeriodEnd,
  parseNum as kismiParseNum,
  sumPeriodsDays,
} from "./kismi/engine";
import { emptyForm as emptyKismiForm, type KismiFormSnapshot } from "./kismi/model";

export type KidemDispatchResult = {
  kind: KidemKind;
  informational: boolean;
  form: unknown;
  result: unknown;
  calculatedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function unwrapKidemPayload(payload: unknown): { kind: KidemKind; form: unknown } {
  const record = asRecord(payload);
  if (isKidemKind(record.kind)) {
    return { kind: record.kind, form: record.form ?? payload };
  }
  return { kind: "is-kanunu", form: payload };
}

function merge<T extends object>(empty: T, value: unknown): T {
  return { ...empty, ...asRecord(value) } as T;
}

function computeKismi(form: KismiFormSnapshot) {
  const periods = form.periods.map((period) => ({
    ...period,
    days: calculatePeriodDays(period.start, period.end),
  }));
  const calculatedDays = sumPeriodsDays(periods);
  const manual = kismiParseNum(form.totalDaysManual);
  const effectiveDays =
    form.isManualOverride && form.totalDaysManual.trim() !== "" && manual >= 0 ? manual : calculatedDays;
  const { yil, ay, gun } = convertDaysToYilAyGun(effectiveDays);
  const exitDate = form.exitDateOverride || latestPeriodEnd(periods);
  const toplamBrut = calculateKismiTotalBrut(
    form.ciplakBrut,
    form.prim,
    form.ikramiye,
    form.yemek,
    form.yol,
    form.diger,
    form.extras,
  );
  const kidem = calculateKismiKidem(toplamBrut, yil, ay, gun, exitDate || undefined);
  return {
    ...kidem,
    ...deriveKismiBrutNet(kidem.toplamTutar),
    yil,
    ay,
    gun,
    effectiveDays,
    calculatedDays,
    periods,
  };
}

function computeBasin(form: BasinFormSnapshot) {
  const kidemSuresi = computeKidemSuresi(
    form.meslegeBaslangic,
    form.iseGiris,
    form.istenCikis,
    form.denemeSuresiGun,
  );
  const calismaSuresi = computeCalismaSuresi(form.iseGiris, form.istenCikis);
  const toplamBrut = calculateBasinTotalBrut(
    form.ciplakBrut,
    form.prim,
    form.ikramiye,
    form.yol,
    form.yemek,
    form.diger,
    form.extras,
  );
  const hakYok = kidemHakkiYok(form.meslegeBaslangic, kidemSuresi.yil);
  const hesaplanacak = adjustedTenure(kidemSuresi, hakYok);
  const brutKidem = hakYok ? 0 : computeBrutKidem(toplamBrut, hesaplanacak);
  return {
    kidemSuresi,
    calismaSuresi,
    toplamBrut,
    hakYok,
    hesaplanacak,
    brutKidem,
    ...deriveBasinBrutNet(brutKidem, basinParseNum(form.ciplakBrut), resolveExitYear(form.istenCikis)),
    mevzuat:
      "5953 sayılı Basın İş Kanunu; kıdem tavanı uygulanmaz. GVK 25/7 istisnası (24 × çıplak brüt) aşıldığında gelir vergisi hesaplanır.",
  };
}

export function dispatchKidemCalculation(payload: unknown): KidemDispatchResult {
  const { kind, form: rawForm } = unwrapKidemPayload(payload);
  const calculatedAt = new Date().toISOString();

  if (kind === "is-kanunu") {
    const form = parseKidemFormPayload(rawForm);
    const dateError = validateDateRange(form.iseGirisTarihi, form.istenCikisTarihi);
    if (dateError) {
      throw new Error(dateError);
    }
    return { kind, informational: false, form, result: computeIsKanunuResult(form), calculatedAt };
  }

  if (kind === "borclar" || kind === "belirli-sureli") {
    return {
      kind,
      informational: true,
      form: asRecord(rawForm),
      result: {
        informational: true,
        kind,
        note:
          kind === "borclar"
            ? "TBK kıdem tazminatı öngörmez; 434, 437 ve 438. maddeler haksız fesih tazminatını düzenler."
            : "Belirli süreli sözleşmede kıdem, 1475 sayılı Kanun m.14 şartları somut olayda oluşursa doğar; bu ekran hesaplama içermez.",
      },
      calculatedAt,
    };
  }

  if (kind === "gemi") {
    const form = merge(createEmptyGemiForm(), rawForm);
    const dateError = deriveDateError(form);
    if (dateError) throw new Error(dateError);
    return { kind, informational: false, form, result: deriveGemiResult(form), calculatedAt };
  }

  if (kind === "mevsimlik") {
    const form = merge(createEmptyMevsimlikForm(), rawForm);
    form.periods = recalculatePeriodDays(form.periods);
    return {
      kind,
      informational: false,
      form,
      result: { ...deriveMevsimlikResult(form), warnings: deriveMevsimlikWarnings(form) },
      calculatedAt,
    };
  }

  if (kind === "basin") {
    const form = merge(emptyBasinForm(), rawForm);
    return { kind, informational: false, form, result: computeBasin(form), calculatedAt };
  }

  const form = merge(emptyKismiForm(), rawForm);
  return { kind, informational: false, form, result: computeKismi(form), calculatedAt };
}
