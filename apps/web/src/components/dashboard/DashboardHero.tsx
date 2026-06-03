import type { DashboardSession } from "@/hooks/useDashboardData";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
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
import { useTranslation } from "react-i18next";
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

const JOURNEY_LABEL_SOURCE: Record<JourneyId, string> = {
  indeciso: "Percorso esplorazione",
  dipendente: "Percorso carriera",
  autonomo: "Percorso autonomo",
  azienda: "Percorso azienda",
  investitore: "Percorso investitore",
};

function isJourneyId(value: string | null | undefined): value is JourneyId {
  return value === "indeciso"
    || value === "dipendente"
    || value === "autonomo"
    || value === "azienda"
    || value === "investitore";
}

function clampPercent(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
}

function useJourneyLabels(locale: string): Record<JourneyId, string> {
  return {
    indeciso: useDynamicTranslation({
      locale,
      key: "dashboard.hero.journey.indeciso",
      source: JOURNEY_LABEL_SOURCE.indeciso,
      context: "Dashboard hero selected journey pill label",
    }),
    dipendente: useDynamicTranslation({
      locale,
      key: "dashboard.hero.journey.dipendente",
      source: JOURNEY_LABEL_SOURCE.dipendente,
      context: "Dashboard hero selected journey pill label",
    }),
    autonomo: useDynamicTranslation({
      locale,
      key: "dashboard.hero.journey.autonomo",
      source: JOURNEY_LABEL_SOURCE.autonomo,
      context: "Dashboard hero selected journey pill label",
    }),
    azienda: useDynamicTranslation({
      locale,
      key: "dashboard.hero.journey.azienda",
      source: JOURNEY_LABEL_SOURCE.azienda,
      context: "Dashboard hero selected journey pill label",
    }),
    investitore: useDynamicTranslation({
      locale,
      key: "dashboard.hero.journey.investitore",
      source: JOURNEY_LABEL_SOURCE.investitore,
      context: "Dashboard hero selected journey pill label",
    }),
  };
}

function ClarityScoreRing({ score, label }: { score: number; label: string }) {
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
        <Compass className="h-2.5 w-2.5" /> {label}
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
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const journeyId = isJourneyId(journeyType) ? journeyType : null;
  const meta = journeyId ? JOURNEY_META[journeyId] : null;
  const Icon = meta?.icon ?? HelpCircle;
  const isIndeciso = journeyId === "indeciso";

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const greetingSource = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const profileComplete = clampPercent(profilePercent) >= 100;
  const safeConfirmedSectorName = confirmedSectorName?.trim() || null;
  const sectorHref = sessionId ? `/risultati/${sessionId}` : "/test";
  const heroKey = meta && journeyId ? journeyId : "default";
  const journeyLabels = useJourneyLabels(locale);
  const headline = useDynamicTranslation({
    locale,
    key: `dashboard.hero.${heroKey}.headline`,
    source: meta?.headline ?? "Il tuo prossimo passo",
    context: "Dashboard hero headline for the user's journey type",
  });
  const subline = useDynamicTranslation({
    locale,
    key: `dashboard.hero.${heroKey}.subline`,
    source: meta?.subline ?? "Scegli il percorso piu adatto a te e riprendi da dove eri rimasto.",
    context: "Dashboard hero supporting copy for the user's journey type",
  });
  const greeting = useDynamicTranslation({
    locale,
    key: `dashboard.hero.greeting.${greetingKey}`,
    source: greetingSource,
    context: "Dashboard hero time-based greeting",
  });
  const clarityLabel = useDynamicTranslation({
    locale,
    key: "dashboard.hero.clarity",
    source: "Chiarezza",
    context: "Dashboard hero clarity score label",
  });
  const chooseJourneyLabel = useDynamicTranslation({
    locale,
    key: "dashboard.hero.chooseJourney",
    source: "Scegli il percorso",
    context: "Dashboard hero call to action for users without a journey type",
  });
  const chooseSectorRoleJobsLabel = useDynamicTranslation({
    locale,
    key: "dashboard.hero.chooseSectorRoleJobs",
    source: "Scegli settore, ruolo e lavori",
    context: "Dashboard hero call to action for undecided users after completing the test",
  });
  const startTestLabel = useDynamicTranslation({
    locale,
    key: "dashboard.hero.startTest",
    source: "Inizia il test",
    context: "Dashboard hero call to action for undecided users without a completed test",
  });
  const takeTestLabel = useDynamicTranslation({
    locale,
    key: "dashboard.hero.takeTest",
    source: "Fai il test",
    context: "Dashboard hero call to action to take the orientation test",
  });
  const sectorLabel = useDynamicTranslation({
    locale,
    key: "dashboard.hero.sector",
    source: "Settore",
    context: "Dashboard hero confirmed professional sector label",
  });
  const manageProLabel = useDynamicTranslation({
    locale,
    key: "dashboard.hero.managePro",
    source: "Gestisci abbonamento Pro",
    context: "Dashboard hero Pro subscription link aria label",
  });

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
                    <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">{headline}</h2>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/60">{subline}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">{headline}</h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/60">
                    {subline}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              {/* Clarity Score ring — only for indeciso */}
              {isIndeciso && clarityScore !== undefined && (
                <ClarityScoreRing score={clarityScore} label={clarityLabel} />
              )}

              <div className="flex flex-wrap gap-2">
                {!journeyId ? (
                  <Link
                    href="/percorso"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <MapPin className="h-3.5 w-3.5" /> {chooseJourneyLabel}
                  </Link>
                ) : (
                  <Link
                    href="/percorso"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/70 transition-colors hover:border-white/35 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{journeyLabels[journeyId]}</span>
                  </Link>
                )}
                {isIndeciso && session ? (
                  <Link
                    href="/settori"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/20 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    {chooseSectorRoleJobsLabel}
                  </Link>
                ) : !session ? (
                  <Link
                    href="/test"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/20 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    {isIndeciso ? startTestLabel : takeTestLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {((profileComplete && safeConfirmedSectorName) || isPremium) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
              {safeConfirmedSectorName && (
                <Link
                  href={sectorHref}
                  className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-white/35 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  <Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-white/50">{sectorLabel}</span>
                  <span className="truncate">{safeConfirmedSectorName}</span>
                </Link>
              )}
              {isPremium && (
                <Link
                  href="/abbonamento"
                  aria-label={manageProLabel}
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
