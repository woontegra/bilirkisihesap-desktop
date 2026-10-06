import { formatCalculationType, normalizePieType } from "../../shared/calculationLabels";
import type { CalculationRecord } from "../../shared/desktop-contract";

export function pickNetTotal(resultJson: Record<string, unknown> | null): number | null {
  if (!resultJson) return null;
  const keys = ["net", "netKidem", "netTutar", "netToplam", "net_total"];
  for (const key of keys) {
    const value = resultJson[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function countCurrentMonth(dates: string[], now: Date): number {
  return dates.filter((source) => {
    const d = new Date(source);
    return (
      !Number.isNaN(d.getTime()) &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }).length;
}

export function buildTypeDistribution(types: string[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const type of types) {
    const key = normalizePieType(formatCalculationType(type));
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildMonthlyCounts(
  dates: string[],
  now: Date,
): { key: string; label: string; count: number }[] {
  const months: { key: string; month: number; year: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  const labels = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const counts: Record<string, number> = {};
  for (const item of months) counts[item.key] = 0;
  for (const source of dates) {
    const d = new Date(source);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in counts) counts[key] += 1;
  }
  return months.map((item) => ({
    key: item.key,
    label: labels[item.month],
    count: counts[item.key],
  }));
}

export function toRecentRecord(record: CalculationRecord): {
  id: string;
  title: string;
  calculationType: string;
  createdAt: string;
  netTotal: number | null;
} {
  return {
    id: record.id,
    title: record.title,
    calculationType: record.calculationType,
    createdAt: record.createdAt,
    netTotal: pickNetTotal(record.resultJson),
  };
}
