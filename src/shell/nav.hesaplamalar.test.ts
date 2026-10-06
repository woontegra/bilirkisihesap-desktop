import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "./nav";

const EXPECTED_CALCULATIONS = [
  "Kıdem Tazminatı",
  "İhbar Tazminatı",
  "Fazla Mesai Alacağı",
  "Yıllık Ücretli İzin Alacağı",
  "UBGT Alacağı",
  "Hafta Tatili Alacağı",
  "Ücret Alacağı",
  "İş Arama İzni Ücreti",
  "Bakiye Ücret Alacağı",
  "Prim Alacağı",
  "Kötü Niyet Tazminatı",
  "Boşta Geçen Süre Ücreti",
  "İşe Başlatmama Tazminatı",
  "Ayrımcılık Tazminatı",
  "Haksız Fesih Tazminatı",
  "İcra Takip Brütten Nete",
];

describe("HESAPLAMALAR sidebar", () => {
  const group = NAV_GROUPS.find((item) => item.id === "calculations");

  it("kaynak sırası ve başlıkları birebir içerir", () => {
    expect(group).toBeTruthy();
    expect(group!.items.map((item) => item.label)).toEqual(EXPECTED_CALCULATIONS);
  });

  it("Davacı Ücreti hesaplamalar altında değildir", () => {
    expect(group!.items.some((item) => item.id === "davaci")).toBe(false);
  });

  it("İcra satırında YENİ rozeti vardır", () => {
    const icra = group!.items.find((item) => item.id === "icra");
    expect(icra?.badge).toBe("YENİ");
  });
});

describe("ARAÇLAR sidebar", () => {
  const tools = NAV_GROUPS.find((item) => item.id === "tools");

  it("Davacı Ücreti araçların ilk sırasında ve doğru route ile yer alır", () => {
    expect(tools).toBeTruthy();
    expect(tools!.items[0]?.id).toBe("davaci");
    expect(tools!.items[0]?.label).toBe("Davacı Ücreti");
    expect(tools!.items[0]?.path).toBe("/davaci-ucreti");
  });

  it("Hesaplamalar grubundan sonra gelir", () => {
    const calcIdx = NAV_GROUPS.findIndex((g) => g.id === "calculations");
    const toolsIdx = NAV_GROUPS.findIndex((g) => g.id === "tools");
    expect(toolsIdx).toBeGreaterThan(calcIdx);
  });

  it("Manuel Brüt Ücret Davacı Ücretinden sonra yer alır", () => {
    expect(tools!.items[1]?.id).toBe("manuel-brut");
    expect(tools!.items[1]?.label).toBe("Manuel Brüt Ücret");
    expect(tools!.items[1]?.path).toBe("/araclar/manuel-brut-ucret");
  });

  it("Hesaplama Notu Manuel Brüt Ücretin altında bir sayfa açmadan add-note eylemidir", () => {
    const note = tools!.items[2];
    expect(note?.id).toBe("hesaplama-notu");
    expect(note?.label).toBe("Hesaplama Notu");
    expect(note?.action).toBe("add-note");
    expect(note?.path).toBeUndefined();
  });

  it("Kategori Etiketi Hesaplama Notunun altında bir sayfa açmadan add-tag eylemidir", () => {
    const tag = tools!.items[3];
    expect(tag?.id).toBe("kategori-etiketi");
    expect(tag?.label).toBe("Kategori Etiketi");
    expect(tag?.action).toBe("add-tag");
    expect(tag?.path).toBeUndefined();
  });

  it("Faiz Hesaplayıcı Kategori Etiketinin altında bir sayfa açmadan open-interest eylemidir", () => {
    const interest = tools!.items[4];
    expect(interest?.id).toBe("faiz-hesaplayici");
    expect(interest?.label).toBe("Faiz Hesaplayıcı");
    expect(interest?.action).toBe("open-interest");
    expect(interest?.path).toBeUndefined();
    expect(tools!.items[3]?.label).toBe("Kategori Etiketi");
  });
});

describe("Veri menüsü", () => {
  it("ayrı Yedekleme öğesi içermez", () => {
    const labels = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).not.toContain("Yedekleme");
    expect(labels).toContain("Kayıtlı Hesaplamalar");
    expect(labels).toContain("Yönetim Paneli");
    expect(labels).not.toContain("Ana Sayfa");
  });

  it("Davacı Ücreti yalnızca bir kez görünür", () => {
    const matches = NAV_GROUPS.flatMap((group) => group.items).filter((item) => item.id === "davaci");
    expect(matches).toHaveLength(1);
  });
});
