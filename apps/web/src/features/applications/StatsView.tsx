import { cn } from "@/lib/utils";
import { ArrowRight, BarChart3, Calendar, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatMonth, groupByMonth } from "./applicationDates";
import { STATUS_META, type Application, type AppStatus } from "./applicationTypes";

export function StatsView({ applications }: { applications: Application[] }) {
  const { t } = useTranslation();
  const total = applications.length;

  const counts = {
    saved:     applications.filter((a) => a.status === "saved").length,
    applied:   applications.filter((a) => a.status === "applied").length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer:     applications.filter((a) => a.status === "offer").length,
    rejected:  applications.filter((a) => a.status === "rejected").length,
  };

  const active = counts.applied + counts.interview;
  const sentApplications = counts.applied + counts.interview + counts.offer + counts.rejected;
  const responseRate = sentApplications > 0
    ? Math.round(((counts.interview + counts.offer) / sentApplications) * 100) : 0;
  const offerRate = (counts.interview + counts.offer) > 0
    ? Math.round((counts.offer / (counts.interview + counts.offer)) * 100) : 0;

  const funnelStages: { status: AppStatus; count: number }[] = [
    { status: "saved", count: counts.saved },
    { status: "applied", count: counts.applied },
    { status: "interview", count: counts.interview },
    { status: "offer", count: counts.offer },
  ];
  const maxFunnelCount = Math.max(...funnelStages.map((s) => s.count), 1);

  const monthlyData = groupByMonth(applications);
  const maxMonthly = Math.max(...monthlyData.map((d) => d.count), 1);

  const totalNotes = applications.reduce((sum, a) => sum + (Array.isArray(a.notesLog) ? a.notesLog.length : 0), 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{t("candidature.addStatNote")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard emoji="📊" label={t("candidature.totalLabel")} value={total} sub={t("candidature.tracked")} valueColor="text-foreground" />
        <KpiCard emoji="💌" label={t("candidature.responseRate")} value={`${responseRate}%`} sub={t("candidature.responseRateDesc")} valueColor="text-blue-600" />
        <KpiCard emoji="⏳" label={t("candidature.inProgress")} value={active} sub={t("candidature.inProgressDesc")} valueColor="text-violet-600" />
        <KpiCard emoji="📝" label={t("candidature.totalNotes")} value={totalNotes} sub={`${(totalNotes / total).toFixed(1)} ${t("candidature.perApp")}`} valueColor="text-amber-600" />
      </div>

      {/* Funnel */}
      <div className="bg-background rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> {t("candidature.funnelTitle")}
          </h3>
          {offerRate > 0 && (
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", STATUS_META.offer.badge)}>
              🎉 {t("candidature.successRate", { rate: offerRate })}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {funnelStages.map((stage, i) => {
            const m = STATUS_META[stage.status] ?? STATUS_META.saved;
            const pct = maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0;
            const prevCount = i > 0 ? (funnelStages[i - 1]?.count ?? null) : null;
            const convPct = prevCount !== null && prevCount > 0
              ? Math.round((stage.count / prevCount) * 100) : null;
            return (
              <div key={stage.status}>
                {convPct !== null && (
                  <div className="flex items-center gap-2 py-1 pl-[108px]">
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    <span className="text-[11px] text-muted-foreground font-medium">{t("candidature.conversionPct", { pct: convPct })}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-right">
                    <span className={cn("text-xs font-semibold", m.color)}>{m.emoji} {t(`candidature.status.${stage.status}`)}</span>
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700 ease-out", m.bg)}
                      style={{ width: `${Math.max(pct, stage.count > 0 ? 6 : 0)}%` }} />
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <span className="text-base font-bold tabular-nums">{stage.count}</span>
                    <span className="text-[11px] text-muted-foreground ml-1">
                      ({total > 0 ? Math.round((stage.count / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {counts.rejected > 0 && (
          <div className="mt-5 pt-4 border-t flex items-center gap-3 text-sm">
            <span className="text-base">❌</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground font-semibold">{counts.rejected}</strong> {t(`candidature.status.rejected`).toLowerCase()}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", STATUS_META.rejected.badge)}>
              {Math.round((counts.rejected / total) * 100)}% {t("candidature.ofTotal")}
            </span>
          </div>
        )}
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 0 && (
        <div className="bg-background rounded-2xl border p-5">
          <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> {t("candidature.overTime")}
          </h3>
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {monthlyData.map(({ month, count }) => {
              const barH = Math.max(Math.round((count / maxMonthly) * 100), 4);
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                  <span className="text-xs font-bold text-foreground tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                  <div className="w-full relative" style={{ height: `${barH}%` }}>
                    <div className="w-full h-full bg-primary/20 hover:bg-primary/40 rounded-t-md transition-colors cursor-default" />
                    {monthlyData.length <= 6 && (
                      <span className="absolute -top-5 left-0 right-0 text-center text-xs font-semibold tabular-nums">{count}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center leading-tight">{formatMonth(month)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-right">
            {t("candidature.avgPerMonth", { avg: (total / Math.max(monthlyData.length, 1)).toFixed(1) })}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────────────── */
function KpiCard({ emoji, label, value, sub, valueColor }: {
  emoji: string; label: string; value: string | number; sub: string; valueColor: string;
}) {
  return (
    <div className="bg-background rounded-2xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg leading-none">{emoji}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums leading-none mb-1", valueColor)}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
    </div>
  );
}
