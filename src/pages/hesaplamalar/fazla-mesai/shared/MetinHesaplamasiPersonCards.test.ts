import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { stripLeadingPersonLabel } from "./MetinHesaplamasiPersonCards";

const root = path.dirname(fileURLToPath(import.meta.url));

const WITNESS_VIEWS = [
  "../tanikli-standart/MetinHesaplamasi.tsx",
  "../haftalik-karma/MetinHesaplamasi.tsx",
  "../donemsel/MetinHesaplamasi.tsx",
  "../donemsel-haftalik/MetinHesaplamasi.tsx",
  "../yeralti-isci/MetinHesaplamasi.tsx",
  "../gemi-adami-gunluk/MetinHesaplamasi.tsx",
];

describe("tanıklı metin kişi kartları", () => {
  it("başlık satırını ve ardından gelen boş satırı soyar, eşleşmeyen metne dokunmaz", () => {
    const longLine = "çok uzun satır ".repeat(20).trim();
    expect(stripLeadingPersonLabel(`DAVACI:\n\n09:00 - 18:00 = 9,00 saat çalışma\n${longLine}`, "Davacı")).toBe(
      `09:00 - 18:00 = 9,00 saat çalışma\n${longLine}`,
    );
    expect(stripLeadingPersonLabel("TANIK 1:\n\nmetin", "Tanık 1")).toBe("metin");
    const untouched = "09:00 - 18:00 = 9,00 saat çalışma";
    expect(stripLeadingPersonLabel(untouched, "DAVACI")).toBe(untouched);
  });

  it("altı tanıklı tür kişi kartını kullanır ve tek parça pre bırakmaz", () => {
    for (const relative of WITNESS_VIEWS) {
      const source = readFileSync(path.join(root, relative), "utf8");
      expect(source, relative).toContain("MetinHesaplamasiPersonCards");
      expect(source, relative).not.toContain("<pre");
    }
  });
});
