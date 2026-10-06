import { beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.fn();
const addPage = vi.fn();
const addImage = vi.fn();

vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    save,
    addPage,
    addImage,
  })),
}));

vi.mock("html2canvas", () => ({
  default: vi.fn(async (host: { innerHTML: string }) => {
    const rows = host.innerHTML.match(/<tr\b/g)?.length ?? 0;
    const height = rows >= 3 ? 2800 : rows > 0 ? 400 : 200;
    return {
      width: 1700,
      height,
      toDataURL: () => "data:image/png;base64,QQ==",
    };
  }),
}));

function installDom() {
  const host = {
    style: {} as { cssText?: string },
    innerHTML: "",
    scrollWidth: 850,
    scrollHeight: 400,
    setAttribute: vi.fn(),
    remove: vi.fn(),
  };
  vi.stubGlobal("document", {
    createElement: () => host,
    body: { appendChild: vi.fn() },
  });
  vi.stubGlobal("window", {
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
  });
}

describe("önizleme PDF indirme", () => {
  beforeEach(() => {
    save.mockClear();
    addPage.mockClear();
    addImage.mockClear();
    installDom();
  });

  it("Türkçe başlıkla .pdf kaydeder ve yazdırma penceresi açmaz", async () => {
    const { downloadPreviewPdf } = await import("./pdfExport");
    const { openPrintWindow } = await import("./reportLocal");
    const open = vi.fn();
    vi.stubGlobal("window", {
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
      open,
    });

    await downloadPreviewPdf("Kıdem Tazminatı", [
      {
        id: "ozet",
        title: "Özet",
        headers: ["Kalem", "Tutar"],
        rows: [["Net", "1.250,50 ₺"]],
      },
    ]);

    expect(save).toHaveBeenCalledTimes(1);
    const fileName = String(save.mock.calls[0]?.[0]);
    expect(fileName.startsWith("Kıdem_Tazminatı_")).toBe(true);
    expect(fileName.endsWith(".pdf")).toBe(true);
    expect(addImage).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(openPrintWindow).toBeTypeOf("function");
  });

  it("uzun tabloyu sayfalara böler ve devam başlığı üretir", async () => {
    const { downloadPreviewPdf } = await import("./pdfExport");
    await downloadPreviewPdf("UBGT", [
      {
        id: "cetvel",
        title: "Cetvel",
        headers: ["Dönem", "Tutar"],
        rows: Array.from({ length: 12 }, (_, i) => [`Satır ${i + 1}`, `${i},00 ₺`]),
        lastRowTone: "blue",
      },
    ]);

    expect(addPage).toHaveBeenCalled();
    expect(addImage.mock.calls.length).toBeGreaterThan(2);
    expect(save.mock.calls[0]?.[0]).toMatch(/^UBGT_\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
