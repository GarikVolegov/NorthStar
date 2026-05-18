import { Target, CalendarDays, Briefcase, User } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { DashboardObjective, DashboardEvent } from "@/hooks/useDashboardData";

function formatEventDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function ProfileRing({ percent }: { percent: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
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
  objectives,
  objectivesProgress,
  upcomingEvents,
  confirmedSectorName,
  sessionId,
}: {
  profilePercent: number;
  objectives: DashboardObjective[];
  objectivesProgress: { done: number; total: number; percent: number };
  upcomingEvents: DashboardEvent[];
  confirmedSectorName?: string | null;
  sessionId?: number | null;
}) {
  const nextEvent = upcomingEvents[0] ?? null;

  const cards = [
    {
      id: "profile",
      icon: null,
      label: "Completamento profilo",
      value: `${profilePercent}%`,
      sub: profilePercent >= 100 ? "Profilo completo" : `${100 - profilePercent}% mancante`,
      href: "/profilo",
      highlight: profilePercent >= 100,
      ring: true,
    },
    {
      id: "objectives",
      icon: Target,
      label: "Obiettivi",
      value: objectivesProgress.total > 0 ? `${objectivesProgress.done}/${objectivesProgress.total}` : "0",
      sub: objectivesProgress.total > 0 ? "completati" : "nessun obiettivo",
      href: null,
      highlight: false,
      ring: false,
    },
    {
      id: "calendar",
      icon: CalendarDays,
      label: "Prossimo evento",
      value: nextEvent ? nextEvent.title : "Nessun evento",
      sub: nextEvent ? formatEventDate(nextEvent.startAt) : "Calendario vuoto",
      href: "/calendario",
      highlight: false,
      ring: false,
    },
    {
      id: "sector",
      icon: Briefcase,
      label: "Settore professionale",
      value: confirmedSectorName ?? "Da scegliere",
      sub: confirmedSectorName ? "Settore confermato" : "Completa il test",
      href: sessionId ? `/risultati/${sessionId}` : "/test",
      highlight: !!confirmedSectorName,
      ring: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                  <ProfileRing percent={profilePercent} />
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
          <Link key={card.id} href={card.href} className="block h-full">{inner}</Link>
        ) : (
          <div key={card.id}>{inner}</div>
        );
      })}
    </div>
  );
}
