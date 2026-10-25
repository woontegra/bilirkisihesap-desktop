/**
 * Fazla mesai katsayı alanı okuyucusu.
 */

/**
 * Noktayı ondalık sayar: "Kat Sayı Hesapla" penceresi ve V3 kayıtları katsayıyı "1.131" biçiminde yazar.
 * Virgül varsa TR biçimi kabul edilir ("1,131", "1.234,5"). Geçersiz/boş/≤0 → 1.
 */
export function parseDecimalKatsayi(value: unknown): number {
  const s = String(value ?? "").trim();
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
