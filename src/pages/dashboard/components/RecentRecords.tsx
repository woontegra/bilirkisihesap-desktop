import { Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { DashboardRecentRecord } from "@shared/desktop-contract";
import { Button } from "@/components/ui/Button";
import { StatePanel } from "@/components/ui/StatePanel";
import { getCaseRouteInfo } from "@/pages/profile/caseRoutes";
import { formatCalculationType } from "@/utils/calculationLabels";
import { formatCurrency, formatShortDate } from "@/utils/format";
import styles from "./RecentRecords.module.css";

type Props = {
  records: DashboardRecentRecord[];
};

export function RecentRecords({ records }: Props) {
  const navigate = useNavigate();

  return (
    <section className={`anim-fade-up ${styles.card}`}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Son Kayıtlar</h2>
          <p className={styles.desc}>En son yapılan hesaplamaların listesi</p>
        </div>
      </header>

      {records.length === 0 ? (
        <StatePanel
          icon={Inbox}
          title="Kayıt bulunamadı"
          description="Henüz kayıtlı hesaplama bulunmuyor."
        />
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Kayıt Adı</th>
                  <th>Tür</th>
                  <th>Tarih</th>
                  <th>Net Toplam</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((row) => {
                  const info = getCaseRouteInfo(row.calculationType);
                  return (
                    <tr key={row.id}>
                      <td>{row.title || "—"}</td>
                      <td>
                        <span className={styles.typeChip}>{info.label || formatCalculationType(row.calculationType)}</span>
                      </td>
                      <td>{formatShortDate(row.createdAt)}</td>
                      <td>{row.netTotal != null ? formatCurrency(row.netTotal) : "—"}</td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`${info.path}?kayit=${encodeURIComponent(row.id)}`)}
                        >
                          Aç
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={styles.cards}>
            {records.map((row) => {
              const info = getCaseRouteInfo(row.calculationType);
              return (
                <article key={row.id} className={styles.mobileCard}>
                  <div className={styles.mobileTop}>
                    <span className={styles.typeChip}>{info.label || formatCalculationType(row.calculationType)}</span>
                    <span className={styles.mobileDate}>{formatShortDate(row.createdAt)}</span>
                  </div>
                  <p className={styles.mobileName}>{row.title || "Adsız kayıt"}</p>
                  <div className={styles.mobileAmounts}>
                    <div>
                      <p className={styles.metaLabel}>Net Toplam</p>
                      <p className={styles.metaValue}>
                        {row.netTotal != null ? formatCurrency(row.netTotal) : "—"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="soft"
                    className={styles.mobileButton}
                    onClick={() => navigate(`${info.path}?kayit=${encodeURIComponent(row.id)}`)}
                  >
                    Aç
                  </Button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
