import type { DashboardSession } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Briefcase,
  Building2,
  Compass,
  Crown,
  HelpCircle,
  MapPin,
  Rocket,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Link } from "wouter";

type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

interface JourneyMeta {
  icon: LucideIcon;
  headline: string;
  subline: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const JOURNEY_META: Record<JourneyId, JourneyMeta> = {
  indeciso:    { icon: Compass,     headline: "La tua bussola personale",  subline: "Esplora chi sei, scopri cosa esiste, e scegli con chiarezza",  color: "text-primary",  bgColor: "bg-primary/10",  borderColor: "border-primary/30" },
  dipendente:  { icon: TrendingUp,  headline: "Accelera la tua carriera",  subline: "Skill, colloqui e candidature mirate",   color: "text-growth",    bgColor: "bg-growth/10",    borderColor: "border-growth/30" },
  autonomo:    { icon: Rocket,      headline: "Scala la tua attività",     subline: "Idee, mercati e strategia",              color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30" },
  azienda:     { icon: Building2,   headline: "Trova i profili giusti",    subline: "Esplora, pubblica e assumi",             color: "text-growth",    bgColor: "bg-growth/10",    borderColor: "border-growth/30" },
  investitore: { icon: BarChart3,   headline: "Analizza le opportunità",  subline: "Aree, trend e dati di mercato",        color: "text-primary",      bgColor: "bg-primary/10",      borderColor: "border-primary/30" },
};

function ClarityScoreRing({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r={radius} fill="none" stroke="currentColor" strokeWidth="4" className="text-white/10" />
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-primary transition-all duration-700"
          />
        </svg>
        <span className="relative text-sm font-bold tabular-nums text-white">{clamped}%</span>
      </div>
      <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/50">
        <Compass className="h-2.5 w-2.5" /> Chiarezza
      </span>
    </div>
  );
}

export function DashboardHero({
  journeyType,
  session,
  isPremium,
  userName,
  profilePercent,
  confirmedSectorName,
  sessionId,
  clarityScore,
}: {
  journeyType: string | null | undefined;
  session: DashboardSession | null;
  isPremium: boolean;
  userName?: string | null;
  profilePercent?: number;
  confirmedSectorName?: string | null;
  sessionId?: number | null;
  clarityScore?: number;
}) {
  const meta = journeyType ? JOURNEY_META[journeyType as JourneyId] : null;
  const Icon = meta?.icon ?? HelpCircle;
  const isIndeciso = journeyType === "indeciso";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const firstName = userName?.split(" ")[0] ?? "";
  const profileComplete = (profilePercent ?? 0) >= 100;
  const sectorHref = sessionId ? `/risultati/${sessionId}` : "/test";

  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="hero-navy px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="text-xs font-medium text-white/50">
                {greeting}{firstName ? `, ${firstName}` : ""}
              </p>
              {meta ? (
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", meta.bgColor, meta.borderColor)}>
                    <Icon className={cn("h-5 w-5", meta.color)} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">{meta.headline}</h2>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/60">{meta.subline}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">Il tuo pannello di controllo</h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/60">
                    Organizza percorso, profilo e prossimi passi in un unico spazio.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {/* Clarity Score ring — only for indeciso */}
              {isIndeciso && clarityScore !== undefined && (
                <ClarityScoreRing score={clarityScore} />
              )}

              <div className="flex flex-wrap gap-2">
                {!journeyType ? (
                  <Link
                    href="/percorso"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Scegli il percorso
                  </Link>
                ) : (
                  <Link
                    href="/percorso"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:border-white/35 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="capitalize">{journeyType}</span>
                  </Link>
                )}
                {isIndeciso && session ? (
                  <Link
                    href="/settori"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/20 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    Scegli settore e ruolo →
                  </Link>
                ) : !session ? (
                  <Link
                    href="/test"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/20 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    {isIndeciso ? "Inizia il test →" : "Fai il test"}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {((profileComplete && confirmedSectorName) || isPremium) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              {confirmedSectorName && (
                <Link
                  href={sectorHref}
                  className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-white/50">Settore</span>
                  <span className="truncate">{confirmedSectorName}</span>
                </Link>
              )}
              {isPremium && (
                <Link
                  href="/abbonamento"
                  aria-label="Gestisci abbonamento Pro"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  <Crown className="h-3.5 w-3.5" /> Pro
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
