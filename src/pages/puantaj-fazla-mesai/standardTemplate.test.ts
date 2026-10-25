/**
 * Standart Excel puantaj şablonu — indir, doldur, yükle ve genel yükleme ile
 * aynı hesap sonucunu verme testleri.
 */
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { collectUnknownDescriptions } from "./codes";
import { autoDetectMappings, guessHeaderRowIndex, toTableView } from "./detect";
import { computePuantajFm, DEFAULT_CALC_SETTINGS, inferCalcDateRange } from "./engine";
import type { CalcSettings, ParsedSheet, PuantajFmResult, StandardRow } from "./model";
import { parseExcel } from "./parsing/excel";
import {
  buildStandardTemplateBytes,
  parseTemplateDateText,
  readStandardTemplate,
  STANDARD_TEMPLATE_COLUMNS,
  STANDARD_TEMPLATE_DAY_TYPE_VALUES,
  STANDARD_TEMPLATE_GUIDE_EXAMPLE,
  STANDARD_TEMPLATE_GUIDE_SHEET,
  STANDARD_TEMPLATE_SHEET,
  STANDARD_TEMPLATE_STATUS_VALUES,
  standardTemplateMappings,
} from "./standardTemplate";
import { buildStandardRows, groupByPersonel, isOffConflictRow, migrateStandardRow } from "./transform";

function check(label: string, actual: unknown, expected: unknown) {
  assert.deepEqual(actual, expected, label);
}

/** Metin, ya da biçimli sayı hücresi (Excel'in gerçek tarih/saat hücresi gibi). */
type Cell = string | { v: number; z: string } | null;

const HEADERS = STANDARD_TEMPLATE_COLUMNS.map((c) => c.header);
const GUN_TURU = HEADERS.indexOf("Gün Türü");

/** İndirilen şablonu açar, verilen satırları 2. Excel satırından itibaren yazar, yeniden kaydeder. */
function fillTemplate(rows: Cell[][], mutate?: (ws: XLSX.WorkSheet) => void): Uint8Array {
  const wb = XLSX.read(buildStandardTemplateBytes(), { type: "array", cellNF: true });
  const ws = wb.Sheets[STANDARD_TEMPLATE_SHEET];
  let lastRow = 0;
  rows.forEach((values, i) => {
    values.forEach((v, c) => {
      if (v == null || v === "") return;
      ws[XLSX.utils.encode_cell({ r: i + 1, c })] = typeof v === "string" ? { t: "s", v } : { t: "n", v: v.v, z: v.z };
      lastRow = i + 1;
    });
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(lastRow, 0), c: HEADERS.length - 1 } });
  mutate?.(ws);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

function settingsFor(rows: StandardRow[]): CalcSettings {
  const range = inferCalcDateRange(rows);
  return { ...DEFAULT_CALC_SETTINGS, calcDateStart: range?.start, calcDateEnd: range?.end };
}

function computeAll(rows: StandardRow[]): PuantajFmResult[] {
  const settings = settingsFor(rows);
  return groupByPersonel(rows).map((g) => computePuantajFm(g.rows, settings, 1));
}

function stripIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripIds);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "id" || k === "rowId" || k === "standardRowId") continue;
      out[k] = stripIds(v);
    }
    return out;
  }
  return value;
}

function templateRows(bytes: Uint8Array): StandardRow[] {
  const r = readStandardTemplate(bytes, "dolu.xlsx");
  if (!r.ok) throw new Error(`Şablon okunamadı: ${r.error} ${JSON.stringify(r.issues)}`);
  return buildStandardRows(r.table, {
    mappings: r.mappings,
    constants: {},
    codeMap: {},
    headers: r.table.headers,
  }).map(migrateStandardRow);
}

/* ── 1. İndirilen şablon: sekmeler, başlıklar, biçim, açılır liste ── */
{
  const bytes = buildStandardTemplateBytes();
  const wb = XLSX.read(bytes, { type: "array" });
  check("sekmeler", wb.SheetNames, [STANDARD_TEMPLATE_SHEET, STANDARD_TEMPLATE_GUIDE_SHEET]);
  const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[STANDARD_TEMPLATE_SHEET], { header: 1, defval: "", blankrows: false });
  check("10 hesap sütunu + Gün Türü", grid[0], HEADERS);
  check("11 sütun", HEADERS.length, 11);
  check("Puantaj sekmesinde veri satırı yok", grid.length, 1);

  const zip = XLSX.CFB.read(bytes, { type: "array" });
  const part = (name: string) => {
    const entry = XLSX.CFB.find(zip, name) ?? XLSX.CFB.find(zip, `/${name}`);
    if (!entry?.content) throw new Error(`Eksik parça: ${name}`);
    return new TextDecoder().decode(entry.content as Uint8Array);
  };
  const sheet = part("xl/worksheets/sheet1.xml");
  check("ilk satır sabit", sheet.includes('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'), true);
  check("filtre", /<autoFilter ref="A1:K\d+"\/>/.test(sheet), true);
  check("Durum açılır listesi", sheet.includes(`&quot;${STANDARD_TEMPLATE_STATUS_VALUES.join(",")}&quot;`), true);
  check("Gün Türü açılır listesi", sheet.includes(`&quot;${STANDARD_TEMPLATE_DAY_TYPE_VALUES.join(",")}&quot;`), true);
  check("tarih ipucu", sheet.includes("Örnek: 12.10.2020"), true);
  check("saat ipucu", sheet.includes("Örnek: 08:30"), true);
  check("sütun genişlikleri", (sheet.match(/<col /g) ?? []).length, 11);
  check("başlık notları", (part("xl/comments1.xml").match(/<comment /g) ?? []).length, 11);
  check("başlık rengi", part("xl/styles.xml").includes('rgb="FF1F4E79"'), true);

  const guide = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[STANDARD_TEMPLATE_GUIDE_SHEET], { header: 1, defval: "" });
  const exampleHeader = guide.findIndex((row) => row.slice(0, 11).join("|") === HEADERS.join("|"));
  check("kılavuzda örnek tablo başlığı", exampleHeader > 0, true);
  check(
    "kılavuzda doldurulmuş örnek satırlar",
    guide.slice(exampleHeader + 1).map((r) => r.slice(0, 11)),
    STANDARD_TEMPLATE_GUIDE_EXAMPLE,
  );

  const empty = readStandardTemplate(bytes, "bos.xlsx");
  check("boş şablon yüklenemez", empty.ok, false);
  if (!empty.ok) check("boş şablon mesajı", empty.error, "Şablonun Puantaj sekmesinde veri satırı yok.");
}

/* ── 2. Kılavuzdaki örnek tablo, Puantaj sekmesine yazılırsa hatasız okunur ── */
{
  const rows = templateRows(fillTemplate(STANDARD_TEMPLATE_GUIDE_EXAMPLE));
  check("örnek tablo satırları", rows.length, STANDARD_TEMPLATE_GUIDE_EXAMPLE.length);
  check("örnek tabloda kontrolü kilitleyen satır yok", rows.filter((r) => r.kontrolDurumu === "red" || isOffConflictRow(r)).length, 0);
}

/* ── 3. Doldurulmuş şablon: gece vardiyası, 24 saat, OFF, UBGT, hafta tatili, izinler ── */
const A = "Ayşe Yılmaz";
const M = "Mehmet Öztürk";
// Personel, Tarih, Kart G, Kart Ç, Vardiya G, Vardiya Ç, Durum, Gün Türü, Birim, Pozisyon, Açıklama
const filled: string[][] = [
  [A, "01.01.2024", "", "", "", "", "UBGT", "UBGT", "Acil", "Hemşire", "Yılbaşı"],
  [A, "02.01.2024", "08:00", "19:00", "", "", "", "Normal Gün", "Acil", "Hemşire", ""],
  [A, "03.01.2024", "20:00", "08:00", "", "", "", "Normal Gün", "Acil", "Hemşire", "Gece vardiyası"],
  [A, "04.01.2024", "", "", "", "", "OFF", "", "Acil", "Hemşire", ""],
  [A, "05.01.2024", "", "", "08:00", "18:00", "", "", "Acil", "Hemşire", "Kart kaydı yok"],
  [A, "06.01.2024", "08:00", "08:00", "", "", "", "", "Acil", "Hemşire", "24 saat"],
  [A, "07.01.2024", "", "", "", "", "Hafta Tatili", "Hafta Tatili", "Acil", "Hemşire", ""],
  [A, "08.01.2024", "07:30", "19:30", "", "", "", "", "Acil", "Hemşire", ""],
  [A, "09.01.2024", "", "", "", "", "Yıllık İzin", "", "Acil", "Hemşire", ""],
  [A, "10.01.2024", "", "", "", "", "İzin", "", "Acil", "Hemşire", ""],
  [A, "11.01.2024", "", "", "", "", "Rapor", "", "Acil", "Hemşire", ""],
  [A, "12.01.2024", "", "", "", "", "Çalışmadı", "", "Acil", "Hemşire", ""],
  [A, "13.01.2024", "09:00", "18:00", "", "", "Çalıştı", "", "Acil", "Hemşire", ""],
  [A, "14.01.2024", "08:00", "20:00", "", "", "", "Hafta Tatili", "Acil", "Hemşire", "Hafta tatilinde çalıştı"],
  [M, "08.01.2024", "20:00", "08:00", "", "", "", "", "Güvenlik", "Görevli", ""],
  [M, "09.01.2024", "20:00", "08:00", "", "", "", "", "Güvenlik", "Görevli", ""],
  [M, "10.01.2024", "20:00", "08:00", "", "", "", "", "Güvenlik", "Görevli", ""],
  [M, "11.01.2024", "20:00", "08:00", "", "", "", "", "Güvenlik", "Görevli", ""],
  [M, "12.01.2024", "20:00", "08:00", "", "", "", "", "Güvenlik", "Görevli", ""],
  [M, "13.01.2024", "20:00", "08:00", "", "", "", "", "Güvenlik", "Görevli", ""],
  [M, "14.01.2024", "", "", "", "", "Hafta Tatili", "Hafta Tatili + UBGT", "Güvenlik", "Görevli", ""],
];
const filledBytes = fillTemplate(filled);
const tpl = readStandardTemplate(filledBytes, "dolu.xlsx");
if (!tpl.ok) throw new Error(`Doldurulmuş şablon okunamadı: ${tpl.error} ${JSON.stringify(tpl.issues)}`);
check("veri satırı sayısı", tpl.dataRowCount, filled.length);
check("eşleştirme sabit", tpl.mappings, standardTemplateMappings());
check("Gün Türü hesaplamaya aktarılmaz", tpl.mappings[GUN_TURU].mode, "exclude");

const tplRows = templateRows(filledBytes);
check("standart satır sayısı", tplRows.length, filled.length);
check("tanınmayan durum yok", collectUnknownDescriptions(tplRows.map((r) => r.izinTatilRaw), {}), []);
check("kontrol adımını kilitleyen satır yok", tplRows.filter((r) => r.kontrolDurumu === "red" || isOffConflictRow(r)).length, 0);
check("iki personel", groupByPersonel(tplRows).map((g) => g.label).sort(), [A, M].sort());

const tplResults = computeAll(tplRows);
const ayse = tplResults.find((r) => r.personelAdSoyad === A)!;
const mehmet = tplResults.find((r) => r.personelAdSoyad === M)!;
const day = (r: PuantajFmResult, iso: string) => r.dailyRows.find((d) => d.tarih === iso)!;

check("gece vardiyası ertesi gün", day(ayse, "2024-01-03").ertesiGunCikis, true);
check("gece vardiyası brüt 12", day(ayse, "2024-01-03").brutSaat, 12);
check("gece vardiyası net 10,5", day(ayse, "2024-01-03").netSaat, 10.5);
check("24 saat brüt", day(ayse, "2024-01-06").brutSaat, 24);
check("24 saat mola 3", day(ayse, "2024-01-06").molaSaat, 3);
check("vardiyadan tamamlanan", day(ayse, "2024-01-05").girisKaynagi, "esas");
check("vardiyadan net 9", day(ayse, "2024-01-05").netSaat, 9);
check("UBGT hesaba girmez", day(ayse, "2024-01-01").dahil, false);
check("UBGT kodu", day(ayse, "2024-01-01").durumKodlari.includes("UBGT"), true);
check("hafta tatili hesaba girmez", day(ayse, "2024-01-07").dahil, false);
check("hafta tatili kodu", day(ayse, "2024-01-07").durumKodlari.includes("HAFTA_TATILI"), true);
check("OFF hesaba girmez", day(ayse, "2024-01-04").dahil, false);
for (const iso of ["2024-01-09", "2024-01-10", "2024-01-11", "2024-01-12"]) {
  check(`izin/rapor/çalışmadı hesaba girmez ${iso}`, day(ayse, iso).dahil, false);
}
check("“Çalıştı” günü hesaba girer", day(ayse, "2024-01-13").netSaat, 8);
check("hafta tatilinde çalışılan pazar (Gün Türü dolu, Durum boş) hesaba girer", day(ayse, "2024-01-14").netSaat, 10.5);
check("hafta tatilinde çalışılan günün kodu yok", day(ayse, "2024-01-14").durumKodlari, []);
check("Ayşe 1. hafta net 50", ayse.weeklyRows[0].netHaftalikSaat, 50);
check("Ayşe 1. hafta FM 5", ayse.weeklyRows[0].haftalikFmSaat, 5);
check("Ayşe OFF gün", ayse.offGunSayisi, 1);
check("Ayşe OFF mahsup 7,5", ayse.offMahsupSaati, 7.5);
check("Ayşe hesaplanan FM 5", ayse.hesaplananToplamFmSaat, 5);
check("Ayşe toplam FM 0", ayse.toplamFmSaat, 0);
check("Mehmet haftalık net 63", mehmet.weeklyRows[0].netHaftalikSaat, 63);
check("Mehmet FM 18", mehmet.toplamFmSaat, 18);
check("Mehmet tutar pozitif", mehmet.sonTutar > 0, true);

/* ── 4. Gün Türü yalnızca bilgi: boş bırakılınca veya sütun silinince sonuç aynı ── */
{
  const withoutDayType = filled.map((r) => r.map((v, c) => (c === GUN_TURU ? "" : v)));
  check("Gün Türü boş = dolu (hesap sonucu)", stripIds(computeAll(templateRows(fillTemplate(withoutDayType)))), stripIds(tplResults));

  const v1Grid = [HEADERS.filter((_, c) => c !== GUN_TURU), ...filled.map((r) => r.filter((_, c) => c !== GUN_TURU))];
  const v1 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(v1, XLSX.utils.aoa_to_sheet(v1Grid), STANDARD_TEMPLATE_SHEET);
  const v1Bytes = new Uint8Array(XLSX.write(v1, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  check("Gün Türü sütunu olmayan (10 sütunlu) şablon aynı sonucu verir", stripIds(computeAll(templateRows(v1Bytes))), stripIds(tplResults));
}

/* ── 5. Aynı dosya genel yükleme yoluyla aynı sonucu verir ── */
async function viaGeneralUpload(bytes: Uint8Array): Promise<PuantajFmResult[]> {
  const doc = await parseExcel(new File([bytes], "dolu.xlsx"));
  const sheet = doc.sheets[0];
  check("genel yükleme ilk sekme Puantaj", sheet.name, STANDARD_TEMPLATE_SHEET);
  const headerRow = guessHeaderRowIndex(sheet.grid);
  check("genel yükleme başlık satırı", headerRow, 0);
  const table = toTableView(sheet, headerRow, 1);
  const mappings = autoDetectMappings(table.headers);
  const gunTuru = mappings.find((m) => m.header === "Gün Türü");
  check("genel yüklemede Gün Türü bir hesap alanına eşlenmez", gunTuru?.mode === "field" ? gunTuru.field : null, null);
  const rows = buildStandardRows(table, { mappings, constants: {}, codeMap: {}, headers: table.headers }).map(migrateStandardRow);
  return computeAll(rows);
}

/* ── 6. Aynı veriler eski tip PDKS dosyasıyla aynı sonucu verir ── */
function viaLegacyGrid(): PuantajFmResult[] {
  const header = ["Adı Soyadı", "Bölüm", "Pozisyon", "Mesai Tarihi", "Giriş", "Çıkış", "Mesai Açıklama", "İzin Açıklama"];
  const grid: string[][] = [header];
  for (const r of filled) {
    const [ad, tarih, kg, kc, vg, vc, durum, , birim, pozisyon] = r;
    grid.push([ad, birim, pozisyon, tarih, kg, kc, vg && vc ? `${vg}-${vc}` : "", durum === "Çalıştı" ? "" : durum]);
  }
  const sheet: ParsedSheet = { name: "PDKS", grid };
  const table = toTableView(sheet, 0, 1);
  const mappings = autoDetectMappings(table.headers);
  const rows = buildStandardRows(table, { mappings, constants: {}, codeMap: {}, headers: table.headers }).map(migrateStandardRow);
  return computeAll(rows);
}

/* ── 7. Satır hataları Excel satır numarasıyla ── */
function issuesOf(bytes: Uint8Array) {
  const r = readStandardTemplate(bytes, "hatali.xlsx");
  if (r.ok) throw new Error("Hatalı şablon kabul edildi");
  return r;
}

{
  const bad = issuesOf(
    fillTemplate([
      ["Ali Kaya", "32.01.2024", "08:00", "17:00"], // 2: tarih
      ["", "02.01.2024", "08:00", "17:00"], // 3: personel
      ["Ali Kaya", "03.01.2024", "25:00", "17:00"], // 4: saat
      ["Ali Kaya", "04.01.2024", "", "", "", "", "Tatil"], // 5: durum
      ["Ali Kaya", "05.01.2024", "08:00", "17:00"], // 6
      ["ali kaya", "05.01.2024", "09:00", "18:00"], // 7: mükerrer
      ["Ali Kaya", "06.01.2024", "08:00", "17:00", "", "", "OFF"], // 8: OFF + saat
      ["Ali Kaya", "08.01.2024", "08:00"], // 9: yarım çift
      ["Ali Kaya", "09.01.2024"], // 10: saat yok
      [], // 11: boş satır atlanır
      ["Ali Kaya", "10.01.2024", "8.5", "17:00"], // 12: saat biçimi
      ["Ali Kaya", "", "08:00", "17:00"], // 13: tarih boş
      ["Ali Kaya", "11.01.2024", "", "", "", "", "UBGT", "Normal Gün"], // 14: Durum/Gün Türü çelişkisi
      ["Ali Kaya", "12.01.2024", "08:00", "17:00", "", "", "", "Bayram"], // 15: tanınmayan Gün Türü
    ]),
  );
  const at = (row: number) => bad.issues.filter((i) => i.excelRow === row).map((i) => i.column);
  check("satır 2 tarih", at(2), ["Tarih"]);
  check("satır 3 personel", at(3), ["Personel Adı Soyadı"]);
  check("satır 4 saat", at(4), ["Kart Giriş"]);
  check("satır 5 durum", at(5), ["Durum"]);
  check("satır 6 temiz", at(6), []);
  check("satır 7 mükerrer", at(7), ["Tarih"]);
  check("mükerrer mesajı ilk satırı gösterir", bad.issues.find((i) => i.excelRow === 7)!.message.includes("6. satırda"), true);
  check("satır 8 OFF + saat", at(8), ["Durum"]);
  check("satır 9 yarım çift", at(9), ["Kart Çıkış"]);
  check("satır 10 saat yok", at(10), ["Kart Giriş"]);
  check("satır 11 boş satır hata vermez", at(11), []);
  check("satır 12 saat biçimi", at(12), ["Kart Giriş"]);
  check("satır 13 tarih boş", at(13), ["Tarih"]);
  check("satır 14 Durum/Gün Türü çelişkisi", at(14), ["Gün Türü"]);
  check("satır 15 tanınmayan Gün Türü", at(15), ["Gün Türü"]);
  check("hata sayısı başlıkta", bad.error.startsWith(`Şablonda ${bad.issues.length} hata bulundu.`), true);
  check("hesaplama başlatılmaz uyarısı", bad.error.includes("hesaplama başlatılmaz"), true);
  check("durum mesajı kabul listesini verir", bad.issues.find((i) => i.excelRow === 5)!.message.includes("Hafta Tatili"), true);
}

/* ── 8. Tarih metinleri: kabul edilenler ve sessizce dönüştürülmeyenler ── */
{
  const ok = (raw: string, iso: string) => check(`tarih kabul: ${raw}`, parseTemplateDateText(raw), { value: iso });
  const no = (raw: string, part: string) => {
    const r = parseTemplateDateText(raw);
    check(`tarih red: ${raw}`, r.value, "");
    check(`tarih red mesajı: ${raw}`, r.error?.includes(part), true);
  };
  ok("12.10.2020", "2020-10-12");
  ok("2.3.2021", "2021-03-02");
  ok("2020-10-12", "2020-10-12");
  ok("12 Ekim 2020", "2020-10-12");
  ok("12 Ekim 2020 Pazartesi", "2020-10-12");
  ok("12 EKİM 2020 PAZARTESİ", "2020-10-12");
  ok("Pazartesi, 12 Ekim 2020", "2020-10-12");
  ok("29 Şubat 2024 Perşembe", "2024-02-29");
  no("12 Ekim 2020 Salı", "gün adı tarihle uyuşmuyor (bu tarih Pazartesi)");
  no("12/10/2020", "gün/ay sırası belirsiz");
  no("10-12-2020", "gün/ay sırası belirsiz");
  no("12.10.20", "yılı 2 haneli");
  no("31.02.2021", "takvimde olmayan");
  no("29 Şubat 2023", "takvimde olmayan");
  no("12 Ekm 2020", "ay adı tanınmadı");
  ok("12.10.2020 Pazartesi", "2020-10-12");
  no("12.10.2020 Cuma", "gün adı tarihle uyuşmuyor");
  no("12/10/2020 Pazartesi", "gün/ay sırası belirsiz");
  no("Ekim 2020", "geçerli bir tarih değil");
  no("Pazartesi", "geçerli bir tarih değil");
}

/* ── 9. Excel'in gerçek tarih ve saat hücreleri ── */
{
  // 12.10.2020 = seri 44116; 08:30 = 0,354166…
  const r = readStandardTemplate(
    fillTemplate([
      ["Ali Kaya", { v: 44116, z: "dd.mm.yyyy" }, { v: 8.5 / 24, z: "hh:mm" }, { v: 18 / 24, z: "h:mm" }],
      ["Ali Kaya", { v: 44117, z: "m/d/yy" }, "08:00", "17:00"],
      ["Ali Kaya", { v: 44118 + 0.5, z: "dd.mm.yyyy hh:mm" }, "08:30:15", "17:00"],
      ["Ali Kaya", "15 Ekim 2020 Perşembe", "08:00", "17:00"],
    ]),
    "gercek-hucre.xlsx",
  );
  if (!r.ok) throw new Error(`Gerçek tarih/saat hücreleri okunamadı: ${JSON.stringify(r.issues)}`);
  check("gerçek tarih hücresi (dd.mm.yyyy)", r.table.rows[0][1], "2020-10-12");
  check("gerçek saat hücresi giriş", r.table.rows[0][2], "08:30");
  check("gerçek saat hücresi çıkış", r.table.rows[0][3], "18:00");
  check("gerçek tarih hücresi (Excel kısa tarih biçimi) gün/ay karışmaz", r.table.rows[1][1], "2020-10-13");
  check("tarih+saat hücresinin tarih kısmı", r.table.rows[2][1], "2020-10-14");
  check("saniyeli saat metni", r.table.rows[2][2], "08:30");
  check("Türkçe uzun tarih metni", r.table.rows[3][1], "2020-10-15");

  const bad = issuesOf(
    fillTemplate([
      ["Ali Kaya", { v: 44116, z: "General" }, "08:00", "17:00"], // 2: biçimsiz sayı
      ["Ali Kaya", "13.10.2020", { v: 8, z: "General" }, "17:00"], // 3: sayı saat
      ["Ali Kaya", "14.10.2020", "8", "17:00"], // 4: yalnız saat
      ["Ali Kaya", "15.10.2020", "0830", "17:00"], // 5: ayırıcısız
      ["Ali Kaya", "16.10.2020", "08:00", "24:00"], // 6: 24:00
      ["Ali Kaya", "17.10.2020", { v: 44121.5, z: "dd.mm.yyyy hh:mm" }, "17:00"], // 7: saat hücresinde tarih
      ["Ali Kaya", "12/10/2020", "08:00", "17:00"], // 8: belirsiz tarih
    ]),
  );
  const at = (row: number) => bad.issues.filter((i) => i.excelRow === row).map((i) => i.column);
  check("biçimsiz sayı tarih sayılmaz", at(2), ["Tarih"]);
  check("sayı olarak yazılmış saat", at(3), ["Kart Giriş"]);
  check("yalnız saat (8)", at(4), ["Kart Giriş"]);
  check("ayırıcısız saat (0830)", at(5), ["Kart Giriş"]);
  check("24:00", at(6), ["Kart Çıkış"]);
  check("saat hücresinde tarih", at(7), ["Kart Giriş"]);
  check("12/10/2020 belirsiz", at(8), ["Tarih"]);
}

/* ── 10. Başlığı değiştirilmiş veya farklı dosya ── */
{
  const changed = readStandardTemplate(
    fillTemplate([["Ali Kaya", "02.01.2024", "08:00", "17:00"]], (ws) => {
      ws["C1"] = { t: "s", v: "Giriş" };
    }),
    "degisik.xlsx",
  );
  check("başlık değişince reddedilir", changed.ok, false);
  if (!changed.ok) check("eksik sütun adı mesajda", changed.error.includes("Kart Giriş"), true);

  const other = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(other, XLSX.utils.aoa_to_sheet([["Ad", "Tarih"]]), "Sayfa1");
  const foreign = readStandardTemplate(new Uint8Array(XLSX.write(other, { type: "array", bookType: "xlsx" }) as ArrayBuffer), "baska.xlsx");
  check("Puantaj sekmesi olmayan dosya reddedilir", foreign.ok, false);
}

const general = await viaGeneralUpload(filledBytes);
check("şablon = genel yükleme (aynı dosya)", stripIds(general), stripIds(tplResults));
const legacy = viaLegacyGrid();
check("şablon = eski tip PDKS dosyası (aynı veriler)", stripIds(legacy), stripIds(tplResults));

console.log(
  `standardTemplate.test: geçti ✔ (Ayşe FM ${ayse.hesaplananToplamFmSaat} − OFF ${ayse.offMahsupSaati} = ${ayse.toplamFmSaat} sa; Mehmet FM ${mehmet.toplamFmSaat} sa, son tutar ${mehmet.sonTutar})`,
);
