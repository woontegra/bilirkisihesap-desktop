import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const pages = [
  "src/pages/hesaplamalar/prim-alacagi/PrimAlacagiPage.tsx",
  "src/pages/hesaplamalar/haksiz-fesih-tazminati/HaksizFesihTazminatiPage.tsx",
  "src/pages/hesaplamalar/ayrimcilik-tazminati/AyrimcilikTazminatiPage.tsx",
  "src/pages/hesaplamalar/kotu-niyet-tazminati/KotuNiyetTazminatiPage.tsx",
  "src/pages/hesaplamalar/is-arama-izni-ucreti/IsAramaIzniUcretiPage.tsx",
  "src/pages/hesaplamalar/ise-almama-tazminati/IseAlmamaTazminatiPage.tsx",
  "src/pages/hesaplamalar/ihbar-tazminati/lib/IhbarPageView.tsx",
];

describe("hukuki not yerleşimi", () => {
  it.each(pages)("%s notu sonuç panelinin altında ve bir kez gösterir", (rel) => {
    const text = readFileSync(path.join(root, rel), "utf8");
    const aside = text.indexOf('<aside className={styles.aside}');
    const note = text.indexOf("Hukuki notlar");
    const asideEnd = text.indexOf("</aside>", aside);
    expect(text.split("Hukuki notlar").length - 1).toBe(1);
    expect(aside).toBeGreaterThan(-1);
    expect(note).toBeGreaterThan(aside);
    expect(asideEnd).toBeGreaterThan(note);
  });

  it("ihbar gizlilik metnini korur", () => {
    const text = readFileSync(
      path.join(root, "src/pages/hesaplamalar/ihbar-tazminati/lib/IhbarPageView.tsx"),
      "utf8",
    );
    expect(text).toContain("Hesaplama ve kayıtlar yalnızca bu cihazda");
  });
});
