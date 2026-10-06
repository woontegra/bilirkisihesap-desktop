import { Calendar, FileText, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import type { DashboardSummary } from "@shared/desktop-contract";
import { ApiError } from "@/api/client";
import { formatDate } from "@/utils/format";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { LicenseCard } from "./components/LicenseCard";
import { MonthlyChart } from "./components/MonthlyChart";
import { RecentRecords } from "./components/RecentRecords";
import { StatCards, type StatItem } from "./components/StatCards";
import { TypeDistributionChart } from "./components/TypeDistributionChart";
import styles from "./DashboardPage.module.css";

function unwrap<T>(result: { ok: true; data: T } | { ok: false; message: string }): T {
  if (!result.ok) throw new ApiError(result.message, 403);
  return result.data;
}

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.bilirkisiDesktop;
    if (!api) {
      setError("Masaüstü köprüsü yok.");
      setLoading(false);
      return;
    }
    void api
      .getDashboardSummary()
      .then((result) => setSummary(unwrap(result)))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Özet yüklenemedi.");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !summary) {
    return <p>{error ?? "Özet yüklenemedi."}</p>;
  }

  const monthHint = new Date().toLocaleDateString("tr-TR", { month: "long" });
  const stats: StatItem[] = [
    {
      id: "total",
      label: "Toplam Hesaplama",
      value: summary.totalCalculations,
      numeric: true,
      hint: "Kayıtlı hesaplamalar",
      icon: FileText,
      tone: "teal",
    },
    {
      id: "month",
      label: "Bu Ayki Hesaplama",
      value: summary.currentMonthCalculations,
      numeric: true,
      hint: monthHint,
      icon: Scale,
      tone: "blue",
    },
    {
      id: "login",
      label: "Son Kullanım",
      value: summary.lastUsedAt ? formatDate(summary.lastUsedAt, true) : "İlk kullanım",
      icon: Calendar,
      tone: "green",
    },
    {
      id: "last",
      label: "Son Kayıt",
      value: summary.latestRecord?.title ?? "Henüz kayıt yok",
      icon: Scale,
      tone: "amber",
    },
  ];

  return (
    <div className={`anim-fade-up ${styles.page}`}>
      <StatCards items={stats} />
      <LicenseCard license={summary.licenseSummary} />
      <div className={styles.chartGrid}>
        <TypeDistributionChart data={summary.typeDistribution} />
        <MonthlyChart createdAtDates={summary.createdAtDates} />
      </div>
      <RecentRecords records={summary.recentRecords} />
    </div>
  );
}
