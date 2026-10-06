export function parseAmount(v: string): number {
  return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function formatDateTr(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export function calculatePressDailyInterest(amount: string, startDate: string, endDate: string) {
  const principal = parseAmount(amount);
  const days = daysBetween(startDate, endDate);
  if (!principal || days <= 0) return null;
  const dailyInterest = principal * 0.05;
  const totalInterest = dailyInterest * days;
  return { days, dailyInterest, totalInterest, total: principal + totalInterest };
}
