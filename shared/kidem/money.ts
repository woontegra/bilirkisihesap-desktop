/** frontendV3.5 src/utils/moneyInput.ts kopyası. */

export function parseMoneyInput(value: string): number {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function sanitizeMoneyTyping(raw: string): string {
  if (raw === "") return "";

  const cleaned = raw.replace(/[^\d,]/g, "");
  const commaIndex = cleaned.indexOf(",");
  const hasComma = commaIndex >= 0;
  const intDigits = (hasComma ? cleaned.slice(0, commaIndex) : cleaned).replace(/\D/g, "");
  const decDigits = hasComma ? cleaned.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2) : "";
  const trailingComma = hasComma && cleaned.endsWith(",");

  if (!intDigits && !decDigits && !trailingComma) return "";

  const normalizedInt = intDigits.replace(/^0+(?=\d)/, "");
  const intForFormat = normalizedInt || (decDigits || trailingComma ? "0" : "");
  if (!intForFormat && !decDigits && !trailingComma) return "";

  const formattedInt = intForFormat.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (trailingComma && !decDigits) return `${formattedInt},`;
  if (hasComma) return `${formattedInt},${decDigits}`;
  return formattedInt;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
