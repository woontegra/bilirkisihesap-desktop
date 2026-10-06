import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DraftDateInput, DraftTextInput } from "@/components/form";
import {
  calculatePressDailyInterest,
  daysBetween,
  formatDateTr,
  formatMoney,
} from "./pressDailyInterest";
import styles from "./calculationTools.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PressDailyInterestModal({ open, onClose }: Props) {
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [result, setResult] = useState<{
    days: number;
    dailyInterest: number;
    totalInterest: number;
    total: number;
  } | null>(null);

  const days = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);

  if (!open) return null;

  const handleCalculate = () => {
    const next = calculatePressDailyInterest(amount, startDate, endDate);
    if (!next) return;
    setResult(next);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.interestHeader}>
          <h2 className={styles.interestTitle}>Basın İş — Günlük %5 Faiz Hesaplama</h2>
        </div>
        <div className={styles.modalBody}>
          <div>
            <label className={styles.modalLabel} htmlFor="press-interest-amount">
              Alacak tutarı (TL)
            </label>
            <DraftTextInput
              id="press-interest-amount"
              className={styles.modalInput}
              inputMode="decimal"
              placeholder="ör: 20.000,00"
              value={amount}
              onCommit={setAmount}
            />
          </div>
          <div className={styles.interestGrid}>
            <div>
              <label className={styles.modalLabel} htmlFor="press-interest-start">
                Gecikme başlangıcı
              </label>
              <DraftDateInput
                id="press-interest-start"
                className={styles.modalInput}
                value={startDate}
                onCommit={setStartDate}
              />
            </div>
            <div>
              <label className={styles.modalLabel} htmlFor="press-interest-end">
                Gecikme sonu
              </label>
              <DraftDateInput
                id="press-interest-end"
                className={styles.modalInput}
                value={endDate}
                onCommit={setEndDate}
              />
            </div>
          </div>
          {days > 0 ? <p className={styles.daysHint}>Gecikme süresi: {days} gün</p> : null}
          <Button type="button" variant="primary" onClick={handleCalculate} disabled={!amount || days <= 0}>
            Hesapla
          </Button>
          {result ? (
            <div className={styles.resultBox}>
              <div className={styles.resultRow}>
                <span>Gecikme dönemi</span>
                <strong>
                  {formatDateTr(startDate)} – {formatDateTr(endDate)}
                </strong>
              </div>
              <div className={styles.resultRow}>
                <span>Günlük faiz (%5)</span>
                <strong>{formatMoney(result.dailyInterest)} ₺</strong>
              </div>
              <div className={styles.resultRow}>
                <span>Toplam faiz ({result.days} gün)</span>
                <strong>{formatMoney(result.totalInterest)} ₺</strong>
              </div>
              <div className={`${styles.resultRow} ${styles.resultTotal}`}>
                <span>Genel toplam</span>
                <strong>{formatMoney(result.total)} ₺</strong>
              </div>
            </div>
          ) : null}
        </div>
        <div className={styles.modalFooter}>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}
