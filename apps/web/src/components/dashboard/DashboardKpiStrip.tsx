import type { DashboardEvent, DashboardObjective } from "@/hooks/useDashboardData";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { Briefcase, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function ProfileRing({ percent }: { percent: number }) {
  const safePercent = clampPercent(percent);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (safePercent / 100) * circ;
  return (
    <svg width="40" height="40" className="-rotate-90">
      <circle cx="20" cy="20" r={r} fill="none" stroke="hsl(var(--primary)/0.12)" strokeWidth="3.5" />
      <circle
        cx="20" cy="20" r={r} fill="none"
        stroke="hsl(var(--primary))" strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

export function DashboardKpiStrip({
  profilePercent,
  objectives: _objectives,
  objectivesProgress: _objectivesProgress,
  confirmedSectorName,
  sessionId,
}: {
  profilePercent: number;
  objectives: DashboardObjective[];
  objectivesProgress: { done: number; total: number; percent: number };
  upcomingEvents?: DashboardEvent[];
  confirmedSectorName?: string | null;
  sessionId?: number | null;
}) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
  const safeProfilePercent = clampPercent(profilePercent);
  const profileMissingPercent = 100 - safeProfilePercent;
  const profileComplete = safeProfilePercent >= 100;
  const safeConfirmedSectorName = confirmedSectorName?.trim() || null;
  const profileLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Completamento profilo",
    key: "dashboard.kpi.profile.label",
    context: "Dashboard KPI card label",
  });
  const profileCompleteLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Profilo completo",
    key: "dashboard.kpi.profile.complete",
    context: "Dashboard KPI profile completion state",
  });
  const profileMissingLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "mancante",
    key: "dashboard.kpi.profile.missing",
    context: "Dashboard KPI profile missing label; the numeric percentage is rendered separately",
  });
  const sectorLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Settore professionale",
    key: "dashboard.kpi.sector.label",
    context: "Dashboard KPI card label",
  });
  const chooseSectorLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Da scegliere",
    key: "dashboard.kpi.sector.choose",
    context: "Dashboard KPI fallback when no professional sector is selected",
  });
  const sectorConfirmedLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Settore confermato",
    key: "dashboard.kpi.sector.confirmed",
    context: "Dashboard KPI selected professional sector status",
  });
  const completeTestLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Completa il test",
    key: "dashboard.kpi.sector.completeTest",
    context: "Dashboard KPI prompt to complete the test",
  });

  const cards = [
    {
      id: "profile",
      icon: null,
      label: profileLabel,
      value: `${safeProfilePercent}%`,
      sub: profileComplete ? profileCompleteLabel : `${profileMissingPercent}% ${profileMissingLabel}`,
      href: "/profilo",
      highlight: profileComplete,
      ring: true,
      hideWhenComplete: true,
    },
    {
      id: "sector",
      icon: Briefcase,
      label: sectorLabel,
      value: safeConfirmedSectorName ?? chooseSectorLabel,
      sub: safeConfirmedSectorName ? sectorConfirmedLabel : completeTestLabel,
      href: sessionId ? `/risultati/${sessionId}` : "/test",
      highlight: !!safeConfirmedSectorName,
      ring: false,
      hideWhenComplete: true,
    },
  ].filter((card) => !(profileComplete && card.hideWhenComplete));

  return (
    <div className={cn(
      "grid grid-cols-1 sm:grid-cols-2 gap-3",
      cards.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-2"
    )}>
      {cards.map((card) => {
        const inner = (
          <div
            className={cn(
              "relative rounded-2xl border bg-card p-4 flex flex-col gap-2 h-full transition-all duration-200",
              card.href ? "hover:border-primary/30 cursor-pointer" : "",
              card.highlight ? "border-primary/25 bg-primary/5" : "border-border"
            )}
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-muted-foreground leading-snug">{card.label}</p>
              {card.ring ? (
                <div className="relative shrink-0">
                  <ProfileRing percent={safeProfilePercent} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>
              ) : card.icon ? (
                <card.icon className={cn("w-4 h-4 shrink-0 mt-0.5", card.highlight ? "text-primary" : "text-muted-foreground/60")} />
              ) : null}
            </div>
            <p className={cn(
              "text-lg font-bold leading-tight truncate",
              card.highlight ? "text-primary" : "text-foreground"
            )}>
              {card.value}
            </p>
            <p className="text-xs text-muted-foreground truncate">{card.sub}</p>
          </div>
        );

        return card.href ? (
          <Link
            key={card.id}
            href={card.href}
            className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2"
          >
            {inner}
          </Link>
        ) : (
          <div key={card.id}>{inner}</div>
        );
      })}
    </div>
  );
}
