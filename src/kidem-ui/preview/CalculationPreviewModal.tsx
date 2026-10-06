import { Copy, FileDown, Printer, X } from "lucide-react";
import type { PreviewSection } from "./types";
import styles from "./CalculationPreviewModal.module.css";

type Props = {
  open: boolean;
  title: string;
  sections: PreviewSection[];
  contentId: string;
  onClose: () => void;
};

function buildPrintHtml(title: string, sections: PreviewSection[]): string {
  const body = sections
    .map((section) => {
      const head = section.headers.map((h) => `<th>${h}</th>`).join("");
      const rows = section.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
        .join("");
      return `<h2>${section.title}</h2><table border="1" cellpadding="4" cellspacing="0"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`;
}

export function CalculationPreviewModal({ open, title, sections, contentId, onClose }: Props) {
  if (!open) return null;

  function handlePrint(): void {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!popup) return;
    popup.document.write(buildPrintHtml(title, sections));
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function handleCopy(): Promise<void> {
    const text = sections
      .map((section) => [section.title, section.headers.join("\t"), ...section.rows.map((row) => row.join("\t"))].join("\n"))
      .join("\n\n");
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <div className={styles.toolbar}>
            <button type="button" className={styles.btnWord} onClick={() => void handleCopy()}>
              <Copy size={13} />
              Word'e Kopyala
            </button>
            <button type="button" className={styles.btnPrint} onClick={handlePrint}>
              <Printer size={13} />
              Yazdır
            </button>
            <button type="button" className={styles.btnPdf} onClick={handlePrint}>
              <FileDown size={13} />
              PDF İndir
            </button>
            <button type="button" className={styles.btnClose} onClick={onClose}>
              <X size={13} />
              Kapat
            </button>
          </div>
        </div>
        <div className={styles.scroll}>
          <div id={contentId} className={styles.body}>
            {sections.map((section) => (
              <div key={section.id} className={styles.section} data-section={section.id}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>{section.title}</span>
                </div>
                <div className="section-content">
                  <table className={styles.table}>
                    {section.headers.length > 0 ? (
                      <thead>
                        <tr>
                          {section.headers.map((header) => (
                            <th key={header}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                    ) : null}
                    <tbody>
                      {section.rows.map((row, index) => {
                        const last = index === section.rows.length - 1;
                        const tone =
                          last && section.lastRowTone
                            ? section.lastRowTone === "blue"
                              ? styles.rowBlue
                              : styles.rowGreen
                            : undefined;
                        return (
                          <tr key={`${section.id}-${index}`} className={tone}>
                            {row.map((cell) => (
                              <td key={`${section.id}-${index}-${cell}`}>{cell}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
