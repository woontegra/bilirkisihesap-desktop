import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, FilePlus2, Newspaper, Save, ShieldCheck, Ship, Sun, Clock } from "lucide-react";
import { emptyForm as emptyBasinForm } from "../../shared/kidem/basin/model";
import { createEmptyGemiForm } from "../../shared/kidem/gemi/model";
import { emptyForm as emptyKismiForm } from "../../shared/kidem/kismi/model";
import { KIDEM_KIND_META, type KidemKind } from "../../shared/kidem/kinds";
import { createEmptyMevsimlikForm } from "../../shared/kidem/mevsimlik/model";
import { formatMoney, sanitizeMoneyTyping } from "../../shared/kidem/money";
import { formatIsoDateTR } from "../utils/dateDisplay";
import { useDesktopRuntime } from "../desktop/useDesktopRuntime";
import { Button } from "../kidem-ui/ui/Button";
import { CalculationPreviewModal } from "../kidem-ui/preview/CalculationPreviewModal";
import type { PreviewSection } from "../kidem-ui/preview/types";
import gemiStyles from "../kidem-ui/gemi/GemiKidemPage.module.css";
import mevsimlikStyles from "../kidem-ui/mevsimlik/MevsimlikKidemPage.module.css";
import basinStyles from "../kidem-ui/basin/BasinKidemPage.module.css";
import kismiStyles from "../kidem-ui/kismi/KismiKidemPage.module.css";

function useRecordLoader<T>(kind: KidemKind, fallback: T, map: (input: unknown) => T) {
  const [params, setParams] = useSearchParams();
  const recordId = params.get("kayit");
  const [title, setTitle] = useState("");
  const [form, setForm] = useState<T>(fallback);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const runtime = useDesktopRuntime();
  const canWrite = runtime?.license.canWriteRecords === true;

  useEffect(() => {
    if (!recordId || !window.bilirkisiDesktop) return;
    void window.bilirkisiDesktop.getCalculationRecord(recordId).then((response) => {
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setTitle(response.data.title);
      setForm(map(response.data.inputJson));
      setResult(response.data.resultJson);
    });
  }, [recordId, map]);

  useEffect(() => {
    if (!canWrite) return;
    const api = window.bilirkisiDesktop;
    if (!api) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.calculateKidem({ kind, form }).then((response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(response.message);
          return;
        }
        setResult((response.data as { result: unknown }).result);
        setError(null);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form, canWrite, kind]);

  return {
    recordId,
    setParams,
    title,
    setTitle,
    form,
    setForm,
    result,
    setResult,
    error,
    setError,
    busy,
    setBusy,
    canWrite,
    runtime,
    showPreview,
    setShowPreview,
    toast,
    setToast,
  };
}

async function saveCalc(
  type: string,
  title: string,
  form: unknown,
  result: unknown,
  notes: string | null,
  recordId: string | null,
  setParams: (next: Record<string, string>, opts: { replace: boolean }) => void,
  setToast: (value: string | null) => void,
  setError: (value: string | null) => void,
) {
  const api = window.bilirkisiDesktop;
  if (!api) throw new Error("Masaüstü köprüsü yok.");
  if (recordId) {
    const updated = await api.updateCalculationRecord(recordId, {
      title,
      notes,
      inputJson: form,
      resultJson: result,
    });
    if (!updated.ok) throw new Error(updated.message);
    setToast("Kayıt güncellendi.");
    return;
  }
  const created = await api.createCalculationRecord({
    calculationType: type as never,
    title,
    notes,
    inputJson: form,
    resultJson: result,
  });
  if (!created.ok) throw new Error(created.message);
  setParams({ kayit: created.data.id }, { replace: true });
  setToast("Hesaplama yerel olarak kaydedildi.");
  setError(null);
}

function StickyActions(props: {
  styles: Record<string, string>;
  canWrite: boolean;
  busy: boolean;
  hasResult: boolean;
  toast: string | null;
  onPreview: () => void;
  onNew: () => void;
  onSave: () => void;
}) {
  return (
    <div className={props.styles.stickyBar}>
      <div className={props.styles.stickyInner}>
        <span className={props.styles.stickyStatus}>{props.toast ?? (props.hasResult ? "Canlı hesaplama açık" : "Formu doldurun")}</span>
        <div className={props.styles.stickyActions}>
          <Button variant="soft" size="sm" disabled={!props.hasResult} onClick={props.onPreview}>
            <Eye size={14} />
            Önizleme
          </Button>
          <Button variant="soft" size="sm" onClick={props.onNew}>
            <FilePlus2 size={14} />
            Yeni Hesaplama
          </Button>
          <Button variant="primary" size="sm" disabled={!props.canWrite || props.busy || !props.hasResult} onClick={props.onSave}>
            <Save size={14} />
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}

export function KidemGemiPage() {
  const state = useRecordLoader("gemi", createEmptyGemiForm(), (input) => ({ ...createEmptyGemiForm(), ...(input as object) }));
  const styles = gemiStyles;
  const result = state.result as {
    brutKidem?: number;
    netKidem?: number;
    gelirVergisi?: number;
    damgaVergisi?: number;
    tavanUygulandi?: boolean;
    muafiyetTutari?: number;
  } | null;
  const preview: PreviewSection[] = useMemo(
    () => [
      {
        id: "girdi",
        title: "Girdiler",
        headers: ["Alan", "Değer"],
        rows: [
          ["İşe giriş", formatIsoDateTR(state.form.startDate)],
          ["İşten çıkış", formatIsoDateTR(state.form.endDate)],
          ["Çıplak brüt", state.form.ciplakBrut || "—"],
          ["Prim", state.form.prim || "0"],
          ["İkramiye", state.form.ikramiye || "0"],
          ["Yemek", state.form.yemek || "0"],
          ["Yol", state.form.yol || "0"],
        ],
      },
      {
        id: "sonuc",
        title: "Sonuç",
        headers: ["Kalem", "Tutar"],
        rows: [
          ["Brüt kıdem", `${formatMoney(result?.brutKidem ?? 0)} ₺`],
          ["Damga", `${formatMoney(result?.damgaVergisi ?? 0)} ₺`],
          ["Gelir vergisi", `${formatMoney(result?.gelirVergisi ?? 0)} ₺`],
          ["Net kıdem", `${formatMoney(result?.netKidem ?? 0)} ₺`],
        ],
        lastRowTone: "green",
      },
    ],
    [state.form, result],
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroIcon} aria-hidden>
            <Ship size={22} />
          </div>
          <div>
            <Link to="/kidem-tazminati" className={styles.privacyBadge}>
              Kıdem Tazminatına dön
            </Link>
            <h1 className={styles.title}>{KIDEM_KIND_META.gemi.title}</h1>
            <p className={styles.desc}>{KIDEM_KIND_META.gemi.description}</p>
            <div className={styles.privacyBadge}>
              <ShieldCheck size={14} />
              <span>Hesaplama ve kayıtlar yalnızca bu cihazda</span>
            </div>
          </div>
        </div>
      </header>
      {!state.canWrite ? (
        <div className={styles.storageBanner} role="alert">
          <p>{state.runtime?.license.message ?? "Geliştirme için npm run dev:mock kullanın."}</p>
        </div>
      ) : null}
      {state.error ? <p className={styles.errorText}>{state.error}</p> : null}
      <div className={styles.layout}>
        <div className={styles.formCol}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Tarih Bilgileri</h2>
            <div className={styles.basicGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>İşe Giriş</span>
                <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={state.form.startDate} onChange={(e) => state.setForm({ ...state.form, startDate: e.target.value })} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>İşten Çıkış</span>
                <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={state.form.endDate} onChange={(e) => state.setForm({ ...state.form, endDate: e.target.value })} />
              </label>
            </div>
          </section>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Çıplak Brüt (₺)</h2>
            <div className={styles.inputWrap}>
              <input className={styles.input} disabled={!state.canWrite} value={state.form.ciplakBrut} onChange={(e) => state.setForm({ ...state.form, ciplakBrut: sanitizeMoneyTyping(e.target.value) })} />
              <span className={styles.currency}>₺</span>
            </div>
          </section>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Ekstra Hesaplamalar</h2>
            <div className={styles.extraList}>
              {(
                [
                  ["prim", "Prim"],
                  ["ikramiye", "İkramiye"],
                  ["yemek", "Yemek"],
                  ["yol", "Yol"],
                  ["diger", "Diğer"],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className={styles.extraRow}>
                  <input className={`${styles.extraName} ${styles.extraNameReadonly}`} readOnly value={label} />
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.input}
                      disabled={!state.canWrite}
                      value={state.form[field]}
                      onChange={(e) => state.setForm({ ...state.form, [field]: sanitizeMoneyTyping(e.target.value) })}
                    />
                    <span className={styles.currency}>₺</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Not</h2>
            <textarea className={styles.notesArea} disabled={!state.canWrite} value={state.form.notes} onChange={(e) => state.setForm({ ...state.form, notes: e.target.value })} />
          </section>
        </div>
        <div className={styles.resultCol}>
          <section className={styles.totalCard}>
            <span className={styles.totalLabel}>Net kıdem</span>
            <strong className={styles.totalValue}>{formatMoney(result?.netKidem ?? 0)} ₺</strong>
            <em className={styles.totalMeta}>GVK 25/7 muafiyeti ve damga sonrası</em>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h3>Hesap dökümü</h3>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.line}>
                <span>Brüt</span>
                <span>{formatMoney(result?.brutKidem ?? 0)} ₺</span>
              </div>
              <div className={styles.line}>
                <span>Damga</span>
                <span>{formatMoney(result?.damgaVergisi ?? 0)} ₺</span>
              </div>
              <div className={styles.line}>
                <span>Gelir vergisi</span>
                <span>{formatMoney(result?.gelirVergisi ?? 0)} ₺</span>
              </div>
              {result?.tavanUygulandi ? <p>Tavan uygulandı.</p> : null}
            </div>
          </section>
        </div>
      </div>
      <StickyActions
        styles={styles}
        canWrite={state.canWrite}
        busy={state.busy}
        hasResult={Boolean(result)}
        toast={state.toast}
        onPreview={() => state.setShowPreview(true)}
        onNew={() => {
          state.setParams({}, { replace: true });
          state.setForm(createEmptyGemiForm());
          state.setResult(null);
          state.setTitle("");
        }}
        onSave={() => {
          state.setBusy(true);
          void saveCalc("kidem-gemi", state.title.trim() || "Gemi adamları kıdem", state.form, result, state.form.notes, state.recordId, state.setParams, state.setToast, state.setError).finally(() => state.setBusy(false));
        }}
      />
      <CalculationPreviewModal open={state.showPreview} title="Gemi Adamları Önizleme" sections={preview} contentId="gemi-preview" onClose={() => state.setShowPreview(false)} />
    </div>
  );
}

export function KidemMevsimlikPage() {
  const state = useRecordLoader("mevsimlik", createEmptyMevsimlikForm(), (input) => ({ ...createEmptyMevsimlikForm(), ...(input as object) }));
  const styles = mevsimlikStyles;
  const first = state.form.periods[0];
  const result = state.result as { brutKidem?: number; netKidem?: number; toplamGun?: number } | null;
  const preview: PreviewSection[] = [
    {
      id: "donem",
      title: "Dönem",
      headers: ["Başlangıç", "Bitiş", "Gün"],
      rows: [[formatIsoDateTR(first?.start), formatIsoDateTR(first?.end), String(result?.toplamGun ?? "—")]],
    },
    {
      id: "sonuc",
      title: "Sonuç",
      headers: ["Kalem", "Tutar"],
      rows: [
        ["Brüt", `${formatMoney(result?.brutKidem ?? 0)} ₺`],
        ["Net", `${formatMoney(result?.netKidem ?? 0)} ₺`],
      ],
      lastRowTone: "green",
    },
  ];
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroIcon} aria-hidden>
            <Sun size={22} />
          </div>
          <div>
            <Link to="/kidem-tazminati" className={styles.privacyBadge}>Kıdem Tazminatına dön</Link>
            <h1 className={styles.title}>{KIDEM_KIND_META.mevsimlik.title}</h1>
            <p className={styles.desc}>{KIDEM_KIND_META.mevsimlik.description}</p>
          </div>
        </div>
      </header>
      {!state.canWrite ? <div className={styles.storageBanner}><p>{state.runtime?.license.message}</p></div> : null}
      {state.error ? <p className={styles.errorText}>{state.error}</p> : null}
      <div className={styles.layout}>
        <div className={styles.formCol}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Çalışma dönemi</h2>
            <div className={styles.basicGrid}>
              <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={first?.start ?? ""} onChange={(e) => state.setForm({ ...state.form, periods: [{ ...first, start: e.target.value, end: first?.end ?? "", id: first?.id ?? "p1", days: first?.days ?? 0 }] })} />
              <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={first?.end ?? ""} onChange={(e) => state.setForm({ ...state.form, periods: [{ ...first, end: e.target.value, start: first?.start ?? "", id: first?.id ?? "p1", days: first?.days ?? 0 }] })} />
            </div>
            <div className={styles.inputWrap}>
              <input className={styles.input} disabled={!state.canWrite} placeholder="Çıplak brüt" value={state.form.ciplakBrut} onChange={(e) => state.setForm({ ...state.form, ciplakBrut: sanitizeMoneyTyping(e.target.value) })} />
              <span className={styles.currency}>₺</span>
            </div>
          </section>
        </div>
        <div className={styles.resultCol}>
          <section className={styles.totalCard}>
            <span className={styles.totalLabel}>Brüt kıdem</span>
            <strong className={styles.totalValue}>{formatMoney(result?.brutKidem ?? 0)} ₺</strong>
            <em className={styles.totalMeta}>{result?.toplamGun ?? 0} gün · 360 gün payı</em>
          </section>
        </div>
      </div>
      <StickyActions
        styles={styles}
        canWrite={state.canWrite}
        busy={state.busy}
        hasResult={Boolean(result)}
        toast={state.toast}
        onPreview={() => state.setShowPreview(true)}
        onNew={() => {
          state.setParams({}, { replace: true });
          state.setForm(createEmptyMevsimlikForm());
          state.setResult(null);
        }}
        onSave={() => {
          state.setBusy(true);
          void saveCalc("kidem-mevsimlik", state.title.trim() || "Mevsimlik kıdem", state.form, result, state.form.notes, state.recordId, state.setParams, state.setToast, state.setError).finally(() => state.setBusy(false));
        }}
      />
      <CalculationPreviewModal open={state.showPreview} title="Mevsimlik Önizleme" sections={preview} contentId="mevsimlik-preview" onClose={() => state.setShowPreview(false)} />
    </div>
  );
}

export function KidemBasinPage() {
  const state = useRecordLoader("basin", emptyBasinForm(), (input) => ({ ...emptyBasinForm(), ...(input as object) }));
  const styles = basinStyles;
  const result = state.result as { brutKidem?: number; net?: number; hakYok?: boolean } | null;
  const preview: PreviewSection[] = [
    {
      id: "sure",
      title: "Süreler",
      headers: ["Alan", "Değer"],
      rows: [
        ["Mesleğe başlangıç", formatIsoDateTR(state.form.meslegeBaslangic)],
        ["İşe giriş", formatIsoDateTR(state.form.iseGiris)],
        ["İşten çıkış", formatIsoDateTR(state.form.istenCikis)],
        ["Deneme süresi (gün)", state.form.denemeSuresiGun || "0"],
      ],
    },
    {
      id: "sonuc",
      title: "Sonuç",
      headers: ["Kalem", "Tutar"],
      rows: [
        ["Brüt", `${formatMoney(result?.brutKidem ?? 0)} ₺`],
        ["Net", `${formatMoney(result?.net ?? 0)} ₺`],
      ],
      lastRowTone: "green",
    },
  ];
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroIcon} aria-hidden>
            <Newspaper size={22} />
          </div>
          <div>
            <Link to="/kidem-tazminati" className={styles.privacyBadge}>Kıdem Tazminatına dön</Link>
            <h1 className={styles.title}>{KIDEM_KIND_META.basin.title}</h1>
            <p className={styles.desc}>{KIDEM_KIND_META.basin.description}</p>
          </div>
        </div>
      </header>
      {!state.canWrite ? <div className={styles.storageBanner}><p>{state.runtime?.license.message}</p></div> : null}
      {state.error ? <p className={styles.errorText}>{state.error}</p> : null}
      <div className={styles.layout}>
        <div className={styles.formCol}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Basın İş süreleri</h2>
            <div className={styles.basicGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Mesleğe başlangıç</span>
                <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={state.form.meslegeBaslangic} onChange={(e) => state.setForm({ ...state.form, meslegeBaslangic: e.target.value })} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>İşe giriş</span>
                <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={state.form.iseGiris} onChange={(e) => state.setForm({ ...state.form, iseGiris: e.target.value })} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>İşten çıkış</span>
                <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={state.form.istenCikis} onChange={(e) => state.setForm({ ...state.form, istenCikis: e.target.value })} />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Deneme süresi (gün)</span>
                <input className={styles.input} disabled={!state.canWrite} value={state.form.denemeSuresiGun} onChange={(e) => state.setForm({ ...state.form, denemeSuresiGun: e.target.value })} />
              </label>
            </div>
            <div className={styles.inputWrap}>
              <input className={styles.input} disabled={!state.canWrite} value={state.form.ciplakBrut} onChange={(e) => state.setForm({ ...state.form, ciplakBrut: sanitizeMoneyTyping(e.target.value) })} placeholder="Çıplak brüt" />
              <span className={styles.currency}>₺</span>
            </div>
          </section>
        </div>
        <div className={styles.resultCol}>
          <section className={styles.totalCard}>
            <span className={styles.totalLabel}>Brüt kıdem</span>
            <strong className={styles.totalValue}>{formatMoney(result?.brutKidem ?? 0)} ₺</strong>
            <em className={styles.totalMeta}>Tavan uygulanmaz</em>
          </section>
          {result?.hakYok ? <p className={styles.errorText}>5 yıl kuralı nedeniyle kıdem hakkı doğmaz.</p> : null}
          <div className={styles.line}>
            <span>Net</span>
            <span>{formatMoney(result?.net ?? 0)} ₺</span>
          </div>
        </div>
      </div>
      <StickyActions
        styles={styles}
        canWrite={state.canWrite}
        busy={state.busy}
        hasResult={Boolean(result)}
        toast={state.toast}
        onPreview={() => state.setShowPreview(true)}
        onNew={() => {
          state.setParams({}, { replace: true });
          state.setForm(emptyBasinForm());
          state.setResult(null);
        }}
        onSave={() => {
          state.setBusy(true);
          void saveCalc("kidem-basin", state.title.trim() || "Basın iş kıdem", state.form, result, state.form.notes, state.recordId, state.setParams, state.setToast, state.setError).finally(() => state.setBusy(false));
        }}
      />
      <CalculationPreviewModal open={state.showPreview} title="Basın İş Önizleme" sections={preview} contentId="basin-preview" onClose={() => state.setShowPreview(false)} />
    </div>
  );
}

export function KidemKismiPage() {
  const state = useRecordLoader("kismi", emptyKismiForm(), (input) => ({ ...emptyKismiForm(), ...(input as object) }));
  const styles = kismiStyles;
  const first = state.form.periods[0];
  const result = state.result as { net?: number; toplamTutar?: number; yil?: number; ay?: number; gun?: number } | null;
  const preview: PreviewSection[] = [
    {
      id: "donem",
      title: "SSK 360",
      headers: ["Başlangıç", "Bitiş"],
      rows: [[formatIsoDateTR(first?.start), formatIsoDateTR(first?.end)]],
    },
    {
      id: "sonuc",
      title: "Sonuç",
      headers: ["Kalem", "Tutar"],
      rows: [
        ["Brüt", `${formatMoney(result?.toplamTutar ?? 0)} ₺`],
        ["Net", `${formatMoney(result?.net ?? 0)} ₺`],
      ],
      lastRowTone: "green",
    },
  ];
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroIcon} aria-hidden>
            <Clock size={22} />
          </div>
          <div>
            <Link to="/kidem-tazminati" className={styles.privacyBadge}>Kıdem Tazminatına dön</Link>
            <h1 className={styles.title}>{KIDEM_KIND_META.kismi.title}</h1>
            <p className={styles.desc}>{KIDEM_KIND_META.kismi.description}</p>
          </div>
        </div>
      </header>
      {!state.canWrite ? <div className={styles.storageBanner}><p>{state.runtime?.license.message}</p></div> : null}
      {state.error ? <p className={styles.errorText}>{state.error}</p> : null}
      <div className={styles.layout}>
        <div className={styles.formCol}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>SSK 360 gün dönem</h2>
            <div className={styles.basicGrid}>
              <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={first?.start ?? ""} onChange={(e) => state.setForm({ ...state.form, periods: [{ ...first, start: e.target.value, end: first?.end ?? "", id: first?.id ?? "p1", days: first?.days ?? 0 }] })} />
              <input className={styles.dateInput} type="date" disabled={!state.canWrite} value={first?.end ?? ""} onChange={(e) => state.setForm({ ...state.form, periods: [{ ...first, end: e.target.value, start: first?.start ?? "", id: first?.id ?? "p1", days: first?.days ?? 0 }] })} />
            </div>
            <div className={styles.inputWrap}>
              <input className={styles.input} disabled={!state.canWrite} value={state.form.ciplakBrut} onChange={(e) => state.setForm({ ...state.form, ciplakBrut: sanitizeMoneyTyping(e.target.value) })} placeholder="Çıplak brüt" />
              <span className={styles.currency}>₺</span>
            </div>
          </section>
        </div>
        <div className={styles.resultCol}>
          <section className={styles.totalCard}>
            <span className={styles.totalLabel}>Brüt kıdem</span>
            <strong className={styles.totalValue}>{formatMoney(result?.toplamTutar ?? 0)} ₺</strong>
            <em className={styles.totalMeta}>
              {result?.yil ?? 0} yıl {result?.ay ?? 0} ay {result?.gun ?? 0} gün (360)
            </em>
          </section>
        </div>
      </div>
      <StickyActions
        styles={styles}
        canWrite={state.canWrite}
        busy={state.busy}
        hasResult={Boolean(result)}
        toast={state.toast}
        onPreview={() => state.setShowPreview(true)}
        onNew={() => {
          state.setParams({}, { replace: true });
          state.setForm(emptyKismiForm());
          state.setResult(null);
        }}
        onSave={() => {
          state.setBusy(true);
          void saveCalc("kidem-kismi", state.title.trim() || "Kısmi süreli kıdem", state.form, result, state.form.notes, state.recordId, state.setParams, state.setToast, state.setError).finally(() => state.setBusy(false));
        }}
      />
      <CalculationPreviewModal open={state.showPreview} title="Kısmi Süreli Önizleme" sections={preview} contentId="kismi-preview" onClose={() => state.setShowPreview(false)} />
    </div>
  );
}
