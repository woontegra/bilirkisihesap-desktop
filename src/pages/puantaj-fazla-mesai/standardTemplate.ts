/**
 * Standart Excel puantaj şablonu — üretme, okuma ve satır doğrulama.
 *
 * Hesap motoruna, dönüştürmeye ve kod sınıflandırmasına dokunmaz. Doğrulanmış
 * satırları genel yüklemenin ürettiği tablo biçiminde verir; sonraki adımlar
 * (Verileri Kontrol Et → Hesapla → Rapor) aynen çalışır.
 *
 * Biçimli dosya (renkli başlık, sabit ilk satır, filtre, açılır liste, başlık
 * notları) SheetJS topluluk sürümü bu özellikleri yazamadığı için OOXML olarak
 * doğrudan üretilir ve xlsx paketinin zip yazıcısıyla paketlenir.
 */

import * as XLSX from "xlsx";
import { toTableView } from "./detect";
import type { ColumnMapping, MappableFieldKey, ParsedDocument, TableView } from "./model";
import { excelSerialToISO, minutesToTime, normalizeText } from "./utils";

export const STANDARD_TEMPLATE_VERSION = 2;
export const STANDARD_TEMPLATE_FILE_NAME = `Bilirkisi-Hesap-Puantaj-Sablonu-v${STANDARD_TEMPLATE_VERSION}.xlsx`;
export const STANDARD_TEMPLATE_SHEET = "Puantaj";
export const STANDARD_TEMPLATE_GUIDE_SHEET = "Kullanım Kılavuzu";
const TEMPLATE_SUBJECT = `BH-PUANTAJ-SABLON-v${STANDARD_TEMPLATE_VERSION}`;
/** Açılır liste, giriş ipucu ve filtrenin kapsadığı veri satırı sayısı. */
const PREPARED_ROWS = 5000;

type ColumnKind = "text" | "date" | "time" | "status" | "dayType";

export type StandardTemplateColumn = {
  header: string;
  /** null: yalnızca bilgi amaçlı, hesaplamaya aktarılmaz. */
  field: MappableFieldKey | null;
  kind: ColumnKind;
  width: number;
  required: boolean;
  format: string;
  example: string;
  /** Başlık notu ve hücre seçildiğinde görünen ipucu. */
  note: string;
};

/** Durum sütununda kabul edilen değerler (boş = çalışılan gün). */
export const STANDARD_TEMPLATE_STATUS_VALUES = [
  "Çalıştı",
  "Hafta Tatili",
  "UBGT",
  "Yıllık İzin",
  "İzin",
  "Rapor",
  "OFF",
  "Çalışmadı",
] as const;

/** Gün Türü sütununda kabul edilen değerler; hesaplamayı etkilemez. */
export const STANDARD_TEMPLATE_DAY_TYPE_VALUES = [
  "Normal Gün",
  "Hafta Tatili",
  "UBGT",
  "Hafta Tatili + UBGT",
] as const;

export const STANDARD_TEMPLATE_COLUMNS: StandardTemplateColumn[] = [
  {
    header: "Personel Adı Soyadı",
    field: "personelAdSoyad",
    kind: "text",
    width: 26,
    required: true,
    format: "Metin",
    example: "Ayşe Yılmaz",
    note: "Zorunlu. Personelin adı ve soyadı. Aynı kişi her satırda aynı şekilde yazılmalıdır.",
  },
  {
    header: "Tarih",
    field: "tarih",
    kind: "date",
    width: 15,
    required: true,
    format: "GG.AA.YYYY",
    example: "12.10.2020",
    note: "Zorunlu. Gün.Ay.Yıl biçiminde, yıl 4 haneli yazın. Örnek: 12.10.2020. 12/10/2020 veya 12.10.20 kabul edilmez.",
  },
  {
    header: "Kart Giriş",
    field: "kartGiris",
    kind: "time",
    width: 14,
    required: false,
    format: "SS:DD",
    example: "08:30",
    note: "Kart / PDKS giriş saati. Saat:Dakika biçiminde yazın. Örnek: 08:30. Çalışılan günde Kart veya Vardiya saatleri zorunludur.",
  },
  {
    header: "Kart Çıkış",
    field: "kartCikis",
    kind: "time",
    width: 14,
    required: false,
    format: "SS:DD",
    example: "18:00",
    note: "Kart / PDKS çıkış saati. Örnek: 18:00. Çıkış girişten küçükse ertesi gün sayılır (gece vardiyası 20:00 – 08:00).",
  },
  {
    header: "Vardiya Giriş",
    field: "esasCalismaGiris",
    kind: "time",
    width: 17,
    required: false,
    format: "SS:DD",
    example: "08:00",
    note: "İsteğe bağlı. Planlanan vardiya başlangıcı. Örnek: 08:00. Kart saati yoksa hesapta bu saat kullanılır.",
  },
  {
    header: "Vardiya Çıkış",
    field: "esasCalismaCikis",
    kind: "time",
    width: 17,
    required: false,
    format: "SS:DD",
    example: "17:00",
    note: "İsteğe bağlı. Planlanan vardiya bitişi. Örnek: 17:00. Kart saati yoksa hesapta bu saat kullanılır.",
  },
  {
    header: "Durum",
    field: "izinTatilKodu",
    kind: "status",
    width: 17,
    required: false,
    format: "Listeden seçin",
    example: "Hafta Tatili",
    note: "Yalnızca çalışılmayan günlerde listeden seçin. Çalışılan günde boş bırakın veya Çalıştı seçin. Durumu dolu satıra saat yazılmaz.",
  },
  {
    header: "Gün Türü",
    field: null,
    kind: "dayType",
    width: 20,
    required: false,
    format: "Listeden seçin",
    example: "Hafta Tatili",
    note: "İsteğe bağlı, yalnızca bilgi içindir; hesaplamayı değiştirmez. Örneğin hafta tatilinde veya UBGT gününde çalışılan günü işaretlemek için kullanılır.",
  },
  {
    header: "Birim",
    field: "birim",
    kind: "text",
    width: 18,
    required: false,
    format: "Metin",
    example: "Acil Servis",
    note: "İsteğe bağlı bilgi. Hesaplamayı etkilemez.",
  },
  {
    header: "Pozisyon",
    field: "pozisyon",
    kind: "text",
    width: 18,
    required: false,
    format: "Metin",
    example: "Hemşire",
    note: "İsteğe bağlı bilgi. Hesaplamayı etkilemez.",
  },
  {
    header: "Açıklama",
    field: "aciklama",
    kind: "text",
    width: 34,
    required: false,
    format: "Metin",
    example: "Gece vardiyası",
    note: "İsteğe bağlı not. Hesaplamayı etkilemez.",
  },
];

const COL = {
  personel: 0,
  tarih: 1,
  kartGiris: 2,
  kartCikis: 3,
  vardiyaGiris: 4,
  vardiyaCikis: 5,
  durum: 6,
  gunTuru: 7,
} as const;

const STATUS_BY_NORM = new Map<string, string>(
  STANDARD_TEMPLATE_STATUS_VALUES.map((v) => [normalizeText(v), v === "Çalıştı" ? "" : v]),
);
const DAY_TYPE_BY_NORM = new Map<string, string>(
  STANDARD_TEMPLATE_DAY_TYPE_VALUES.map((v) => [normalizeText(v), v]),
);

export type StandardTemplateIssue = {
  /** Excel'deki satır numarası (başlık satırı 1). */
  excelRow: number;
  column: string;
  message: string;
};

export type StandardTemplateReadResult =
  | { ok: false; error: string; issues: StandardTemplateIssue[] }
  | {
      ok: true;
      doc: ParsedDocument;
      table: TableView;
      mappings: ColumnMapping[];
      dataRowCount: number;
    };

/* ── OOXML yardımcıları ── */

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const S = {
  default: 0,
  headerRequired: 1,
  headerOptional: 2,
  dataText: 3,
  title: 4,
  section: 5,
  note: 6,
  example: 7,
  guideCell: 8,
  guideHeader: 9,
} as const;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colLetter(c: number): string {
  return XLSX.utils.encode_col(c);
}

function strCell(ref: string, text: string, style: number): string {
  if (!text) return `<c r="${ref}" s="${style}"/>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

const LAST_COL = colLetter(STANDARD_TEMPLATE_COLUMNS.length - 1);
const DATA_RANGE_END = PREPARED_ROWS + 1;

function stylesXml(): string {
  const font = (opts: string, size: number, rgb: string) =>
    `<font>${opts}<sz val="${size}"/><color rgb="${rgb}"/><name val="Calibri"/><family val="2"/></font>`;
  const solid = (rgb: string) =>
    `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const thin = '<left style="thin"><color rgb="FFBFBFBF"/></left><right style="thin"><color rgb="FFBFBFBF"/></right><top style="thin"><color rgb="FFBFBFBF"/></top><bottom style="thin"><color rgb="FFBFBFBF"/></bottom><diagonal/>';
  const xf = (numFmt: number, fontId: number, fillId: number, borderId: number, align = "") =>
    `<xf numFmtId="${numFmt}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1">' + align + "</xf>" : "/>"}`;
  const headerAlign = '<alignment horizontal="center" vertical="center" wrapText="1"/>';
  return (
    XML_HEAD +
    `<styleSheet xmlns="${NS_MAIN}">` +
    '<fonts count="6">' +
    font("", 11, "FF000000") +
    font("<b/>", 11, "FFFFFFFF") +
    font("<b/>", 16, "FF1F4E79") +
    font("<b/>", 12, "FF1F4E79") +
    font("<i/>", 10, "FF595959") +
    font("<b/>", 11, "FF1F2937") +
    "</fonts>" +
    '<fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    solid("FF1F4E79") +
    solid("FF5B7FA6") +
    solid("FFFFF2CC") +
    solid("FFDDEBF7") +
    "</fills>" +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${thin}</border></borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="10">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    xf(49, 1, 2, 1, headerAlign) +
    xf(49, 1, 3, 1, headerAlign) +
    xf(49, 0, 0, 0) +
    xf(0, 2, 0, 0) +
    xf(0, 3, 0, 0) +
    xf(0, 4, 0, 0) +
    xf(49, 0, 4, 1, '<alignment vertical="center"/>') +
    xf(49, 0, 0, 1, '<alignment vertical="top" wrapText="1"/>') +
    xf(49, 5, 5, 1, '<alignment vertical="center" wrapText="1"/>') +
    "</cellXfs>" +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

function headerCells(row: number): string {
  return STANDARD_TEMPLATE_COLUMNS.map((col, c) =>
    strCell(`${colLetter(c)}${row}`, col.header, col.required ? S.headerRequired : S.headerOptional),
  ).join("");
}

function listFormula(values: readonly string[]): string {
  return `<formula1>${esc(`"${values.join(",")}"`)}</formula1>`;
}

function dataValidationsXml(): string {
  const items = STANDARD_TEMPLATE_COLUMNS.map((col, c) => {
    const sqref = `${colLetter(c)}2:${colLetter(c)}${DATA_RANGE_END}`;
    const prompt = `promptTitle="${esc(col.header.slice(0, 32))}" prompt="${esc(col.note.slice(0, 250))}"`;
    if (col.kind === "status" || col.kind === "dayType") {
      const values = col.kind === "status" ? STANDARD_TEMPLATE_STATUS_VALUES : STANDARD_TEMPLATE_DAY_TYPE_VALUES;
      const error = `Listeden bir değer seçin: ${values.join(", ")}.`;
      return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Geçersiz değer" error="${esc(error.slice(0, 220))}" ${prompt} sqref="${sqref}">${listFormula(values)}</dataValidation>`;
    }
    return `<dataValidation allowBlank="1" showInputMessage="1" ${prompt} sqref="${sqref}"/>`;
  });
  return `<dataValidations count="${items.length}">${items.join("")}</dataValidations>`;
}

function puantajSheetXml(): string {
  const cols = STANDARD_TEMPLATE_COLUMNS.map(
    (col, c) => `<col min="${c + 1}" max="${c + 1}" width="${col.width}" style="${S.dataText}" customWidth="1"/>`,
  ).join("");
  return (
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<sheetPr><tabColor rgb="FF1F4E79"/></sheetPr>' +
    `<dimension ref="A1:${LAST_COL}1"/>` +
    '<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1" ht="32" customHeight="1">${headerCells(1)}</row></sheetData>` +
    `<autoFilter ref="A1:${LAST_COL}${DATA_RANGE_END}"/>` +
    dataValidationsXml() +
    '<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape"/>' +
    '<legacyDrawing r:id="rId2"/>' +
    "</worksheet>"
  );
}

function commentsXml(): string {
  const rPr = (bold: boolean) => `<rPr>${bold ? "<b/>" : ""}<sz val="9"/><color rgb="FF000000"/><rFont val="Tahoma"/><family val="2"/></rPr>`;
  const list = STANDARD_TEMPLATE_COLUMNS.map(
    (col, c) =>
      `<comment ref="${colLetter(c)}1" authorId="0"><text>` +
      `<r>${rPr(true)}<t xml:space="preserve">${esc(`${col.header} (${col.required ? "zorunlu" : "isteğe bağlı"})`)}</t></r>` +
      `<r>${rPr(false)}<t xml:space="preserve">${esc(`\nBiçim: ${col.format}\nÖrnek: ${col.example}\n${col.note}`)}</t></r>` +
      "</text></comment>",
  ).join("");
  return XML_HEAD + `<comments xmlns="${NS_MAIN}"><authors><author>Bilirkişi Hesap</author></authors><commentList>${list}</commentList></comments>`;
}

function commentsVml(): string {
  const shapes = STANDARD_TEMPLATE_COLUMNS.map(
    (_, c) =>
      `<v:shape id="_x0000_s${1025 + c}" type="#_x0000_t202" style="position:absolute;margin-left:60pt;margin-top:2pt;width:230pt;height:96pt;z-index:${c + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">` +
      '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/>' +
      '<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>' +
      `<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${c + 1}, 15, 0, 4, ${c + 4}, 15, 6, 4</x:Anchor><x:AutoFill>False</x:AutoFill><x:Row>0</x:Row><x:Column>${c}</x:Column></x:ClientData>` +
      "</v:shape>",
  ).join("");
  return (
    '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">' +
    '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>' +
    '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>' +
    shapes +
    "</xml>"
  );
}

/* ── Kullanım Kılavuzu ── */

type GuideCell = { text: string; style: number };
type GuideRow = { cells: (GuideCell | null)[]; height?: number };

/** Kılavuzdaki doldurulmuş örnek tablo (yalnızca bu sekmede; Puantaj sekmesine yazılmaz). */
export const STANDARD_TEMPLATE_GUIDE_EXAMPLE: string[][] = [
  ["Ayşe Yılmaz", "12.10.2020", "08:00", "18:00", "", "", "", "Normal Gün", "Acil Servis", "Hemşire", "Normal gündüz mesaisi"],
  ["Ayşe Yılmaz", "13.10.2020", "20:00", "08:00", "", "", "", "Normal Gün", "Acil Servis", "Hemşire", "Gece vardiyası, çıkış ertesi gün"],
  ["Ayşe Yılmaz", "14.10.2020", "", "", "", "", "OFF", "", "Acil Servis", "Hemşire", "Fazla mesai karşılığı izin, saat yazılmaz"],
  ["Ayşe Yılmaz", "15.10.2020", "", "", "08:00", "17:00", "", "", "Acil Servis", "Hemşire", "Kart kaydı yok, vardiya saati kullanılır"],
  ["Ayşe Yılmaz", "16.10.2020", "08:00", "08:00", "", "", "", "", "Acil Servis", "Hemşire", "24 saat nöbet"],
  ["Ayşe Yılmaz", "17.10.2020", "", "", "", "", "Yıllık İzin", "", "Acil Servis", "Hemşire", ""],
  ["Ayşe Yılmaz", "18.10.2020", "", "", "", "", "Hafta Tatili", "Hafta Tatili", "Acil Servis", "Hemşire", "Çalışılmadı"],
  ["Ayşe Yılmaz", "25.10.2020", "09:00", "17:00", "", "", "", "Hafta Tatili", "Acil Servis", "Hemşire", "Hafta tatilinde çalıştı; Durum boş"],
  ["Ayşe Yılmaz", "29.10.2020", "", "", "", "", "UBGT", "UBGT", "Acil Servis", "Hemşire", "Resmî tatil, çalışılmadı"],
  ["Mehmet Öztürk", "29.10.2020", "08:00", "16:00", "", "", "", "UBGT", "Güvenlik", "Görevli", "UBGT gününde çalıştı; Durum boş"],
  ["Mehmet Öztürk", "30.10.2020", "", "", "", "", "Rapor", "", "Güvenlik", "Görevli", ""],
];

function guideRows(): { rows: GuideRow[]; merges: string[] } {
  const rows: GuideRow[] = [];
  const merges: string[] = [];
  const line = (text: string, style: number = S.default, height?: number) =>
    rows.push({ cells: [{ text, style }], height });
  const blank = () => rows.push({ cells: [] });
  /** 5 değer: A | B | C–D | E–G | H–K; 4 değer: A | B | C–F | G–K. */
  const table = (values: string[], style: number, height?: number) => {
    const r = rows.length + 1;
    const cells: (GuideCell | null)[] = Array.from({ length: STANDARD_TEMPLATE_COLUMNS.length }, () => ({ text: "", style }));
    const starts = values.length === 5 ? [0, 1, 2, 4, 7] : [0, 1, 2, 6];
    starts.forEach((c, i) => {
      cells[c] = { text: values[i], style };
    });
    rows.push({ cells, height });
    if (values.length === 5) merges.push(`C${r}:D${r}`, `E${r}:G${r}`, `H${r}:${LAST_COL}${r}`);
    else merges.push(`C${r}:F${r}`, `G${r}:${LAST_COL}${r}`);
  };

  line(`Bilirkişi Hesap — Standart Puantaj Şablonu (sürüm ${STANDARD_TEMPLATE_VERSION})`, S.title, 24);
  line("Bu sekme yalnızca bilgi içindir. Program yalnızca “Puantaj” sekmesindeki satırları okur; buradaki örnek tablo hesaplamaya alınmaz.", S.note);
  blank();
  line("Nasıl doldurulur?", S.section);
  line("1. Verileri yalnızca “Puantaj” sekmesine, 2. satırdan başlayarak yazın. Başlık satırını değiştirmeyin.");
  line("2. Her satır bir personelin bir gününü gösterir. Aynı personel ve aynı tarih yalnızca bir kez yazılır.");
  line("3. Birden fazla personel aynı dosyada olabilir; personeller ad soyada göre ayrılır.");
  line("4. Başlıklardaki kırmızı köşeli notlarda ve hücre seçildiğinde çıkan ipuçlarında her sütunun biçimi yazar.");
  line("5. Dosyayı kaydedip programda “Şablonu Yükle” ile yükleyin. Hatalı satırlar Excel satır numarasıyla listelenir; hata varsa hesaplama başlamaz.");
  blank();
  line("Sütunlar", S.section);
  table(["Sütun", "Zorunlu mu?", "Biçim", "Örnek", "Açıklama"], S.guideHeader, 20);
  for (const col of STANDARD_TEMPLATE_COLUMNS) {
    table(
      [col.header, col.required ? "Zorunlu" : "İsteğe bağlı", col.format, col.example, col.note],
      S.guideCell,
      32,
    );
  }
  blank();
  line("Tarih ve saat yazımı", S.section);
  line("• Kabul edilen tarihler: 12.10.2020 · 2.3.2021 · 2020-10-12 · 12 Ekim 2020 · 12 Ekim 2020 Pazartesi · 12.10.2020 Pazartesi · Excel tarih hücresi.");
  line("• Reddedilen tarihler: 12/10/2020 ve 10-12-2020 (gün/ay sırası belirsiz) · 12.10.20 (yıl 2 haneli) · 31.02.2021 (takvimde yok) · gün adı tarihle uyuşmayan metin.");
  line("• Kabul edilen saatler: 08:30 · 8:30 · 08.30 · 08:30:15 (saniye dikkate alınmaz) · Excel saat hücresi.");
  line("• Reddedilen saatler: 8 · 0830 · 24:00 · 8:5 · sayı olarak yazılmış saat (ör. 0,35).");
  line("• Belirsiz veya hatalı tarih/saat sessizce dönüştürülmez; satır numarasıyla hata olarak gösterilir.", S.note);
  blank();
  line("Durum sütunu (hesaplamayı etkiler)", S.section);
  table(["Değer", "Saat yazılır mı?", "Hesaba etkisi", "Ne zaman kullanılır?"], S.guideHeader, 20);
  const statusInfo: Record<string, [string, string, string]> = {
    "Çalıştı": ["Evet", "Saatler hesaba girer", "Çalışılan gün. Boş bırakmakla aynıdır."],
    "Hafta Tatili": ["Hayır", "Gün hesaba girmez", "Hafta tatili kullanıldı, çalışılmadı."],
    UBGT: ["Hayır", "Gün hesaba girmez", "Ulusal bayram / genel tatil, çalışılmadı."],
    "Yıllık İzin": ["Hayır", "Gün hesaba girmez", "Yıllık ücretli izin."],
    "İzin": ["Hayır", "Gün hesaba girmez", "Diğer izinler (mazeret, ücretsiz vb.)."],
    Rapor: ["Hayır", "Gün hesaba girmez", "İstirahat raporu."],
    OFF: ["Hayır", "Her OFF günü 7,5 saat mahsup edilir", "Fazla mesai karşılığı verilen izin günü."],
    "Çalışmadı": ["Hayır", "Gün hesaba girmez", "Başka bir nedenle çalışılmayan gün."],
  };
  for (const v of STANDARD_TEMPLATE_STATUS_VALUES) {
    const [hours, effect, when] = statusInfo[v];
    table([v, hours, effect, when], S.guideCell, 20);
  }
  line("• Hafta tatili veya UBGT günü çalışıldıysa Durum boş bırakılır ve saatler yazılır; saatler haftalık toplama girer. Durum doluysa o günün saatleri hesaba katılmaz.");
  blank();
  line("Gün Türü sütunu (yalnızca bilgi içindir)", S.section);
  line("• Normal Gün, Hafta Tatili, UBGT veya Hafta Tatili + UBGT seçilebilir. Hesaplamayı değiştirmez; hafta tatilinde veya bayramda çalışılan günleri işaretlemek içindir.");
  line("• Durum “Hafta Tatili” veya “UBGT” ise Gün Türü boş bırakılabilir; doldurulursa aynı günü göstermelidir, çelişki varsa satır hata olarak gösterilir.");
  blank();
  line("Özel durumlar", S.section);
  line("• Gece vardiyası: Çıkış saati girişten küçükse çıkış ertesi gün sayılır (örn. 20:00 – 08:00).");
  line("• 24 saat vardiya: Giriş ve çıkış aynı saat yazılır (örn. 08:00 – 08:00). 24 saati aşan vardiya her takvim günü için ayrı satıra bölünür.");
  line("• OFF satırına saat yazılmaz; her OFF günü hesapta 7,5 saat mahsup edilir.");
  line("• Ara dinlenme, haftalık çalışma sınırı, katsayı, hakkaniyet indirimi ve mahsup programdaki “Hesapla” adımında seçilir.");
  blank();
  line("Doldurulmuş örnek tablo", S.section);
  line("Aşağıdaki satırlar yalnızca örnektir ve hesaplamaya alınmaz. Gerçek verileri “Puantaj” sekmesine yazın.", S.note);
  rows.push({
    cells: STANDARD_TEMPLATE_COLUMNS.map((col) => ({
      text: col.header,
      style: col.required ? S.headerRequired : S.headerOptional,
    })),
    height: 32,
  });
  for (const ex of STANDARD_TEMPLATE_GUIDE_EXAMPLE) {
    rows.push({ cells: ex.map((text) => ({ text, style: S.example })) });
  }
  return { rows, merges };
}

function guideSheetXml(): string {
  const { rows, merges } = guideRows();
  const cols = STANDARD_TEMPLATE_COLUMNS.map(
    (col, c) => `<col min="${c + 1}" max="${c + 1}" width="${Math.max(col.width, c === 0 ? 24 : 12)}" customWidth="1"/>`,
  ).join("");
  const body = rows
    .map((row, i) => {
      const r = i + 1;
      const cells = row.cells
        .map((cell, c) => (cell ? strCell(`${colLetter(c)}${r}`, cell.text, cell.style) : ""))
        .join("");
      const ht = row.height ? ` ht="${row.height}" customHeight="1"` : "";
      return `<row r="${r}"${ht}>${cells}</row>`;
    })
    .join("");
  return (
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<sheetPr><tabColor rgb="FF5B7FA6"/></sheetPr>' +
    `<dimension ref="A1:${LAST_COL}${rows.length}"/>` +
    '<sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${body}</sheetData>` +
    `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` +
    '<pageMargins left="0.4" right="0.4" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape"/>' +
    "</worksheet>"
  );
}

function packageFiles(): [string, string][] {
  const sheetMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
  return [
    [
      "[Content_Types].xml",
      XML_HEAD +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${sheetMime}"/>` +
        `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="${sheetMime}"/>` +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        "</Types>",
    ],
    [
      "_rels/.rels",
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        "</Relationships>",
    ],
    [
      "docProps/core.xml",
      XML_HEAD +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        `<dc:title>Bilirkişi Hesap Puantaj Şablonu</dc:title><dc:subject>${TEMPLATE_SUBJECT}</dc:subject><dc:creator>Bilirkişi Hesap</dc:creator>` +
        "</cp:coreProperties>",
    ],
    [
      "xl/workbook.xml",
      XML_HEAD +
        `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        '<workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="12300" activeTab="0"/></bookViews>' +
        `<sheets><sheet name="${esc(STANDARD_TEMPLATE_SHEET)}" sheetId="1" r:id="rId1"/><sheet name="${esc(STANDARD_TEMPLATE_GUIDE_SHEET)}" sheetId="2" r:id="rId2"/></sheets>` +
        `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${STANDARD_TEMPLATE_SHEET}!$A$1:$${LAST_COL}$${DATA_RANGE_END}</definedName></definedNames>` +
        "</workbook>",
    ],
    [
      "xl/_rels/workbook.xml.rels",
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    ],
    ["xl/styles.xml", stylesXml()],
    ["xl/worksheets/sheet1.xml", puantajSheetXml()],
    [
      "xl/worksheets/_rels/sheet1.xml.rels",
      XML_HEAD +
        `<Relationships xmlns="${NS_PKG_REL}">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/>' +
        "</Relationships>",
    ],
    ["xl/comments1.xml", commentsXml()],
    ["xl/drawings/vmlDrawing1.vml", commentsVml()],
    ["xl/worksheets/sheet2.xml", guideSheetXml()],
  ];
}

export function buildStandardTemplateBytes(): Uint8Array {
  const zip = XLSX.CFB.utils.cfb_new();
  const encoder = new TextEncoder();
  for (const [path, xml] of packageFiles()) {
    XLSX.CFB.utils.cfb_add(zip, path, encoder.encode(xml));
  }
  const out = XLSX.CFB.write(zip, { fileType: "zip", type: "array", compression: true }) as ArrayBuffer | number[] | Uint8Array;
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}

export function downloadStandardTemplate(): void {
  const bytes = buildStandardTemplateBytes();
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = STANDARD_TEMPLATE_FILE_NAME;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ── Tarih ve saat okuma (belirsiz değerler hata verir, sessizce dönüştürülmez) ── */

const TR_MONTHS = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"];
/** getUTCDay sırası: 0 = Pazar. */
const TR_WEEKDAYS = ["pazar", "pazartesi", "sali", "carsamba", "persembe", "cuma", "cumartesi"];
const TR_WEEKDAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

type CellRead = { value: string; error?: string };

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null) return "";
  if (cell.t === "n" || cell.t === "d") return String(cell.w ?? cell.v).trim();
  return String(cell.v).trim();
}

function isBlankCell(cell: XLSX.CellObject | undefined): boolean {
  return !cell || cell.v == null || String(cell.v).trim() === "";
}

function isDateFormatted(cell: XLSX.CellObject): boolean {
  return typeof cell.z === "string" && XLSX.SSF.is_date(cell.z);
}

function buildRealISO(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Şablon tarih metnini katı kurallarla okur. */
export function parseTemplateDateText(raw: string): CellRead {
  const text = raw.trim().replace(/\s+/g, " ");
  const bad = (why: string): CellRead => ({ value: "", error: `“${text}” ${why} GG.AA.YYYY biçiminde yazın (örn. 12.10.2020).` });

  const tokens = text.split(" ");
  let weekday: string | null = null;
  if (tokens.length > 1) {
    const first = normalizeText(tokens[0]);
    const last = normalizeText(tokens[tokens.length - 1]);
    if (TR_WEEKDAYS.includes(first)) {
      weekday = first;
      tokens.shift();
    } else if (TR_WEEKDAYS.includes(last)) {
      weekday = last;
      tokens.pop();
    }
  }
  const body = tokens.join(" ").replace(/,$/, "").trim();
  const withWeekday = (iso: string | null): CellRead => {
    if (!iso) return bad("takvimde olmayan bir tarih.");
    if (weekday && TR_WEEKDAYS[weekdayIndex(iso)] !== weekday) {
      return bad(`gün adı tarihle uyuşmuyor (bu tarih ${TR_WEEKDAY_LABELS[weekdayIndex(iso)]}).`);
    }
    return { value: iso };
  };

  let m = body.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return withWeekday(buildRealISO(Number(m[3]), Number(m[2]), Number(m[1])));
  m = body.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return withWeekday(buildRealISO(Number(m[1]), Number(m[2]), Number(m[3])));
  if (/^\d{1,2}\.\d{1,2}\.\d{2}$/.test(body)) return bad("yılı 2 haneli; hangi yüzyıl olduğu belirsiz.");
  if (/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(body)) return bad("gün/ay sırası belirsiz.");

  const words = normalizeText(body).split(" ");
  if (words.length === 3 && /^\d{1,2}$/.test(words[0]) && /^\d{4}$/.test(words[2])) {
    const month = TR_MONTHS.indexOf(words[1]) + 1;
    if (month === 0) return bad("ay adı tanınmadı.");
    return withWeekday(buildRealISO(Number(words[2]), month, Number(words[0])));
  }
  return bad("geçerli bir tarih değil.");
}

function readDate(cell: XLSX.CellObject | undefined, date1904: boolean): CellRead {
  if (isBlankCell(cell)) return { value: "" };
  if (cell!.t === "n" && typeof cell!.v === "number") {
    if (!isDateFormatted(cell!)) {
      return {
        value: "",
        error: `“${cellText(cell)}” sayı olarak girilmiş; tarih mi olduğu belirsiz. GG.AA.YYYY biçiminde yazın (örn. 12.10.2020).`,
      };
    }
    const serial = Math.floor(cell!.v) + (date1904 ? 1462 : 0);
    const iso = serial >= 61 ? excelSerialToISO(serial) : null;
    return iso ? { value: iso } : { value: "", error: "Excel tarih hücresi okunamadı." };
  }
  return parseTemplateDateText(String(cell!.v));
}

function readTime(cell: XLSX.CellObject | undefined): CellRead {
  if (isBlankCell(cell)) return { value: "" };
  if (cell!.t === "n" && typeof cell!.v === "number") {
    const v = cell!.v;
    if (!isDateFormatted(cell!) || v < 0) {
      return { value: "", error: `“${cellText(cell)}” sayı olarak girilmiş; SS:DD biçiminde yazın (örn. 08:30).` };
    }
    if (v >= 1) {
      return { value: "", error: `“${cellText(cell)}” hücresinde tarih de var; yalnızca saati SS:DD biçiminde yazın (örn. 08:30).` };
    }
    const minutes = Math.round(v * 1440);
    if (minutes >= 1440) return { value: "", error: `“${cellText(cell)}” geçerli bir saat değil (SS:DD).` };
    return { value: minutesToTime(minutes) };
  }
  const raw = String(cell!.v).trim();
  const m = raw.match(/^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || (m[3] && Number(m[3]) > 59)) {
    return { value: "", error: `“${raw}” geçerli bir saat değil; SS:DD biçiminde yazın (örn. 08:30).` };
  }
  return { value: minutesToTime(Number(m[1]) * 60 + Number(m[2])) };
}

/* ── Şablonu oku ── */

function locateColumns(ws: XLSX.WorkSheet, range: XLSX.Range): { index: number[]; error?: string } {
  const byHeader = new Map<string, number[]>();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const key = normalizeText(cellText(ws[XLSX.utils.encode_cell({ r: 0, c })]));
    if (!key) continue;
    byHeader.set(key, [...(byHeader.get(key) ?? []), c]);
  }
  const index: number[] = [];
  const missing: string[] = [];
  const repeated: string[] = [];
  STANDARD_TEMPLATE_COLUMNS.forEach((col) => {
    const hits = byHeader.get(normalizeText(col.header)) ?? [];
    if (hits.length > 1) repeated.push(col.header);
    if (hits.length === 0 && col.field !== null) missing.push(col.header);
    index.push(hits[0] ?? -1);
  });
  if (missing.length > 0) {
    return {
      index,
      error: `Bu dosya Bilirkişi Hesap standart puantaj şablonu değil veya başlıkları değiştirilmiş. Beklenen sütunlar bulunamadı: ${missing.join(", ")}. Farklı formattaki dosyalar için genel yüklemeyi kullanabilirsiniz.`,
    };
  }
  if (repeated.length > 0) {
    return { index, error: `Şablonda aynı başlık birden fazla kez var: ${repeated.join(", ")}. Fazla sütunu silip yeniden yükleyin.` };
  }
  return { index };
}

export function standardTemplateMappings(): ColumnMapping[] {
  return STANDARD_TEMPLATE_COLUMNS.map((col, i) => ({
    columnIndex: i,
    logicalIndex: i,
    physicalIndices: [i],
    header: col.header,
    ...(col.field ? { mode: "field" as const, field: col.field } : { mode: "exclude" as const }),
    autoGuessed: true,
    confidence: 1,
  }));
}

/** Şablon dosyasını okur; tek bir hata varsa satırları vermez. */
export function readStandardTemplate(data: ArrayBuffer | Uint8Array, fileName: string): StandardTemplateReadResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(data, { type: "array", cellDates: false, cellNF: true });
  } catch {
    return { ok: false, error: "Excel dosyası okunamadı. Dosyanın bozuk olmadığından emin olun.", issues: [] };
  }
  const sheetName =
    wb.SheetNames.find((n) => normalizeText(n) === normalizeText(STANDARD_TEMPLATE_SHEET)) ?? null;
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws || !ws["!ref"]) {
    return {
      ok: false,
      error: "Dosyada “Puantaj” sekmesi bulunamadı. Lütfen “Şablonu İndir” ile alınan dosyayı kullanın.",
      issues: [],
    };
  }
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const located = locateColumns(ws, range);
  if (located.error) return { ok: false, error: located.error, issues: [] };
  const date1904 = Boolean(wb.Workbook?.WBProps?.date1904);

  const issues: StandardTemplateIssue[] = [];
  const grid: string[][] = [STANDARD_TEMPLATE_COLUMNS.map((c) => c.header)];
  const seen = new Map<string, number>();

  for (let r = 1; r <= range.e.r; r++) {
    const cells = located.index.map((c) =>
      c < 0 ? undefined : (ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined),
    );
    if (cells.every((cell) => cellText(cell) === "")) continue;
    const excelRow = r + 1;
    const add = (column: string, message: string) => issues.push({ excelRow, column, message });

    const personel = cellText(cells[COL.personel]);
    if (!personel) add("Personel Adı Soyadı", "Personel adı soyadı boş.");

    const tarih = readDate(cells[COL.tarih], date1904);
    if (tarih.error) add("Tarih", tarih.error);
    else if (!tarih.value) add("Tarih", "Tarih boş.");

    let timeIssue = false;
    const times = [COL.kartGiris, COL.kartCikis, COL.vardiyaGiris, COL.vardiyaCikis].map((c) => {
      const t = readTime(cells[c]);
      if (t.error) {
        timeIssue = true;
        add(STANDARD_TEMPLATE_COLUMNS[c].header, t.error);
      }
      return t.value;
    });
    const [kg, kc, vg, vc] = times;
    if (!timeIssue && !!kg !== !!kc) {
      timeIssue = true;
      add(kg ? "Kart Çıkış" : "Kart Giriş", "Kart giriş ve çıkış saati birlikte yazılmalı.");
    }
    if (!timeIssue && !!vg !== !!vc && !(kg && kc)) {
      timeIssue = true;
      add(vg ? "Vardiya Çıkış" : "Vardiya Giriş", "Vardiya giriş ve çıkış saati birlikte yazılmalı.");
    }

    const durumRaw = cellText(cells[COL.durum]);
    const durum = durumRaw ? STATUS_BY_NORM.get(normalizeText(durumRaw)) : "";
    if (durum === undefined) {
      add("Durum", `“${durumRaw}” tanınmıyor. Kabul edilen değerler: ${STANDARD_TEMPLATE_STATUS_VALUES.join(", ")}.`);
    }

    const anyHour = times.some(Boolean);
    if (durum) {
      if (anyHour) {
        add(
          "Durum",
          `“${durum}” yazılan satıra saat girilmez. O gün çalışıldıysa Durum hücresini boş bırakın.`,
        );
      }
    } else if (durum === "" && !timeIssue && !(kg && kc) && !(vg && vc)) {
      add("Kart Giriş", "Çalışılan gün için kart veya vardiya giriş-çıkış saati gerekli.");
    }

    const gunTuruRaw = cellText(cells[COL.gunTuru]);
    const gunTuru = gunTuruRaw ? DAY_TYPE_BY_NORM.get(normalizeText(gunTuruRaw)) : "";
    if (gunTuru === undefined) {
      add("Gün Türü", `“${gunTuruRaw}” tanınmıyor. Kabul edilen değerler: ${STANDARD_TEMPLATE_DAY_TYPE_VALUES.join(", ")}.`);
    } else if (gunTuru && (durum === "Hafta Tatili" || durum === "UBGT") && !gunTuru.includes(durum)) {
      add("Gün Türü", `Durum “${durum}” iken Gün Türü “${gunTuru}” olamaz. Gün Türünü düzeltin veya boş bırakın.`);
    }

    if (personel && tarih.value) {
      const key = `${personel.toLocaleLowerCase("tr-TR").trim()}|${tarih.value}`;
      const first = seen.get(key);
      if (first) add("Tarih", `Mükerrer kayıt: aynı personel ve tarih ${first}. satırda da var.`);
      else seen.set(key, excelRow);
    }

    const row = STANDARD_TEMPLATE_COLUMNS.map((_, c) => {
      if (c === COL.tarih) return tarih.value;
      if (c === COL.kartGiris) return kg;
      if (c === COL.kartCikis) return kc;
      if (c === COL.vardiyaGiris) return vg;
      if (c === COL.vardiyaCikis) return vc;
      if (c === COL.durum) return durum ?? durumRaw;
      if (c === COL.gunTuru) return gunTuru ?? gunTuruRaw;
      return cellText(cells[c]);
    });
    grid.push(row);
  }

  if (issues.length > 0) {
    return {
      ok: false,
      error: `Şablonda ${issues.length} hata bulundu. Excel dosyasını düzeltip yeniden yükleyin; hatalı verilerle hesaplama başlatılmaz.`,
      issues,
    };
  }
  if (grid.length === 1) {
    return { ok: false, error: "Şablonun Puantaj sekmesinde veri satırı yok.", issues: [] };
  }

  const doc: ParsedDocument = {
    fileName,
    kind: "excel",
    sheets: [{ name: STANDARD_TEMPLATE_SHEET, grid }],
    warnings: [],
  };
  return {
    ok: true,
    doc,
    table: toTableView(doc.sheets[0], 0, 1),
    mappings: standardTemplateMappings(),
    dataRowCount: grid.length - 1,
  };
}
