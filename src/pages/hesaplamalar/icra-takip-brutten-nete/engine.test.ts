/**
 * İcra Takip Brütten Nete — motor self-tests.
 */
import { calculateInterest, DEPOSIT_INTEREST_BLOKE_MESSAGE } from "./lib/interestCalculator";
import type { CalculateInterestResult, InterestPeriodResult } from "./lib/interestCalculator";
import { legalInterestRates } from "./lib/legalInterestRates";
import { computeDamgaOnly, computeNetFromGrossSingle, computeStandartBrutNetFromGross, round2 } from "./lib/brutNet";

type Failure = { label: string; actual: unknown; expected: unknown };

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.01;
  return false;
}

function periodsOf(result: CalculateInterestResult): InterestPeriodResult[] {
  return result.ok ? result.periods : [];
}

function runEngineSelfTests(): { passed: number; failures: Failure[] } {
  const failures: Failure[] = [];
  let passed = 0;
  const check = (label: string, actual: unknown, expected: unknown) => {
    if (isEqual(actual, expected)) passed += 1;
    else failures.push({ label, actual, expected });
  };

  const damga = computeDamgaOnly(10000);
  check("damga-only binde 7,59", damga.damgaVergisi, round2(10000 * 0.00759));
  check("damga-only net", damga.net, round2(10000 - damga.damgaVergisi));

  const istisnali = computeNetFromGrossSingle(26005.5, 2025);
  check("istisnali net > 0", istisnali.net > 0, true);
  check("istisnali sgk", istisnali.sgk, round2(26005.5 * 0.14));

  const istisnasiz = computeStandartBrutNetFromGross(10000, 2024);
  check("istisnasiz istisna 0", istisnasiz.gelirVergisiIstisna, 0);

  const legal = calculateInterest({
    principal: 1000,
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    interestType: "LEGAL_INTEREST",
  });
  check("yasal faiz ok", legal.ok, true);
  const june2024 = periodsOf(legal).filter((period) => period.rate === 24);
  check("tamamen %24 dönemi tek dilim", june2024.length, 1);
  check("tamamen %24 döneminde %31 yok", periodsOf(legal).some((period) => period.rate === 31), false);

  const tableRate = (date: string) =>
    legalInterestRates.find(
      (period) => period.startDate <= date && (period.endDate == null || date <= period.endDate),
    )?.rate;
  check("30.07.2026 tablo oranı %24", tableRate("2026-07-30"), 24);
  check("31.07.2026 tablo oranı %31", tableRate("2026-07-31"), 31);
  check("%24 dönemi 30.07.2026 kapanır", legalInterestRates.find((period) => period.rate === 24)?.endDate, "2026-07-30");
  check("%31 dönemi 31.07.2026 açılır", legalInterestRates.find((period) => period.rate === 31)?.startDate, "2026-07-31");
  check("%31 dönemi açık uçlu", legalInterestRates.find((period) => period.rate === 31)?.endDate, null);

  const historicRates: Array<[string, number, string | null]> = [
    ["2006-01-01", 9, "2024-05-31"],
    ["2005-05-01", 12, "2005-12-31"],
    ["2004-07-01", 38, "2005-04-30"],
    ["2004-01-01", 43, "2004-06-30"],
    ["2003-07-01", 50, "2003-12-31"],
    ["2002-07-01", 55, "2003-06-30"],
    ["2000-01-01", 60, "2002-06-30"],
    ["1998-01-01", 50, "1999-12-31"],
    ["1984-12-19", 30, "1997-12-31"],
  ];
  for (const [startDate, rate, endDate] of historicRates) {
    const row = legalInterestRates.find((period) => period.startDate === startDate);
    check(`eski dönem ${startDate} oran`, row?.rate, rate);
    check(`eski dönem ${startDate} bitiş`, row?.endDate, endDate);
  }

  const year2006 = calculateInterest({
    principal: 1000,
    startDate: "2006-01-01",
    endDate: "2006-01-31",
    interestType: "LEGAL_INTEREST",
  });
  check("2006 hesabı yalnızca %9", periodsOf(year2006).every((period) => period.rate === 9), true);
  check("2006 hesabı dilim sayısı", periodsOf(year2006).length, 1);

  const boundary = calculateInterest({
    principal: 10000,
    startDate: "2026-07-30",
    endDate: "2026-07-31",
    interestType: "LEGAL_INTEREST",
  });
  const boundary24 = periodsOf(boundary).find((period) => period.startDate === "2026-07-30");
  const boundary31 = periodsOf(boundary).find((period) => period.startDate === "2026-07-31");
  check("sınır iki dilim", periodsOf(boundary).length, 2);
  check("30.07.2026 dilimi %24", boundary24?.rate, 24);
  check("30.07.2026 dilimi bir gün", boundary24?.days, 1);
  check("31.07.2026 dilimi %31", boundary31?.rate, 31);
  check("31.07.2026 dilimi bir gün", boundary31?.days, 1);

  const august = calculateInterest({
    principal: 10000,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    interestType: "LEGAL_INTEREST",
  });
  const august31 = periodsOf(august).find((period) => period.rate === 31 && period.startDate === "2026-08-01");
  check("ağustos 2026 tamamen %31", periodsOf(august).length === 1 && august31 != null, true);
  check("ağustos 2026 gün", august.ok ? august.totalDays : null, 31);
  check("ağustos 2026 faiz", august.ok ? august.totalInterest : null, 263.29);

  const sameDay24 = calculateInterest({
    principal: 10000,
    startDate: "2026-07-30",
    endDate: "2026-07-30",
    interestType: "LEGAL_INTEREST",
  });
  const sameDay31 = calculateInterest({
    principal: 10000,
    startDate: "2026-07-31",
    endDate: "2026-07-31",
    interestType: "LEGAL_INTEREST",
  });
  check("aynı gün %24 diliminde gün 0", sameDay24.ok ? sameDay24.totalDays : null, 0);
  check("aynı gün %24 diliminde faiz 0", sameDay24.ok ? sameDay24.totalInterest : null, 0);
  check("aynı gün %24 diliminde dönem yok", sameDay24.ok ? sameDay24.periods.length : null, 0);
  check("aynı gün %31 diliminde gün 0", sameDay31.ok ? sameDay31.totalDays : null, 0);
  check("aynı gün %31 diliminde faiz 0", sameDay31.ok ? sameDay31.totalInterest : null, 0);

  const deposit = calculateInterest({
    principal: 1000,
    startDate: "2024-06-01",
    endDate: "2024-06-30",
    interestType: "HIGHEST_DEPOSIT_INTEREST",
  });
  check("mevduat BLOKE", deposit.ok, false);
  if (deposit.ok === false) {
    check("mevduat mesaj", deposit.message, DEPOSIT_INTEREST_BLOKE_MESSAGE);
  }

  if (failures.length > 0) console.error(`icra engine.test: ${failures.length} failure(s)`, failures);
  else console.log(`icra engine.test: ${passed} test geçti ✔`);
  return { passed, failures };
}

const result = runEngineSelfTests();
if (result.failures.length > 0) throw new Error(`icra engine.test: ${result.failures.length} failure(s)`);
