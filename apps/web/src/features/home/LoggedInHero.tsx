import { cn } from "@/lib/utils";
import { ArrowRight, BarChart3, Bot, Building2, ChevronRight, HelpCircle, MapPin, Rocket, TrendingUp, Zap } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { JourneyId, LatestResult } from "./homeTypes";

export function LoggedInHero({
  userName,
  journeyType,
  latestResult,
}: {
  userName: string;
  journeyType: string | null | undefined;
  latestResult: LatestResult | null;
}) {
  const { t } = useTranslation();

  const JOURNEY_LABELS: Record<
    JourneyId,
    { label: string; Icon: React.ElementType; accentClass: string }
  > = {
    indeciso: {
      label: t("home.personas.indeciso.label"),
      Icon: HelpCircle,
      accentClass: "text-primary",
    },
    dipendente: {
      label: t("home.personas.dipendente.label"),
      Icon: TrendingUp,
      accentClass: "text-growth",
    },
    autonomo: {
      label: t("home.personas.autonomo.label"),
      Icon: Rocket,
      accentClass: "text-primary",
    },
    azienda: {
      label: t("home.personas.azienda.label"),
      Icon: Building2,
      accentClass: "text-growth",
    },
    investitore: {
      label: t("home.personas.investitore.label"),
      Icon: BarChart3,
      accentClass: "text-primary",
    },
  };

  const journey = journeyType ? JOURNEY_LABELS[journeyType as JourneyId] : null;
  const JourneyIcon = journey?.Icon;
  const hasTest = !!latestResult?.recommendations?.length;

  const NEXT_STEP: Record<
    JourneyId,
    { label: string; desc: string; href: string; icon: React.ElementType }
  > = {
    indeciso: {
      label: t("home.nextStep.indeciso.label"),
      desc: t("home.nextStep.indeciso.desc"),
      href: "/test",
      icon: Zap,
    },
    dipendente: {
      label: t("home.nextStep.dipendente.label"),
      desc: t("home.nextStep.dipendente.desc"),
      href: "/dashboard",
      icon: TrendingUp,
    },
    autonomo: {
      label: t("home.nextStep.autonomo.label"),
      desc: t("home.nextStep.autonomo.desc"),
      href: "#wendy",
      icon: Rocket,
    },
    azienda: {
      label: t("home.nextStep.azienda.label"),
      desc: t("home.nextStep.azienda.desc"),
      href: "/settori",
      icon: Building2,
    },
    investitore: {
      label: t("home.nextStep.investitore.label"),
      desc: t("home.nextStep.investitore.desc"),
      href: "/settori",
      icon: BarChart3,
    },
  };

  const nextStep = journeyType ? NEXT_STEP[journeyType as JourneyId] : null;
  const NextIcon = nextStep?.icon;

  return (
    <section className="hero-navy py-8 md:py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div>
            <p className="text-white/55 text-xs font-medium mb-1 uppercase tracking-wider">
              Bentornato,
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2.5">
              {userName.split(" ")[0]} ðŸ‘‹
            </h1>
            {journey && JourneyIcon ? (
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
                <JourneyIcon
                  className={cn("w-3.5 h-3.5", journey.accentClass)}
                />
                <span
                  className={cn("text-xs font-semibold", journey.accentClass)}
                >
                  {journey.label}
                </span>
              </div>
            ) : (
              <Link href="/percorso">
                <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/30 transition-colors cursor-pointer">
                  <MapPin className="w-3.5 h-3.5" /> Scegli il tuo percorso{" "}
                  <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            )}
          </div>

          {nextStep && NextIcon && (
            <Link href={nextStep.href} className="w-full md:w-auto md:max-w-xs">
              <div className="group flex items-center gap-3 bg-white/10 border border-white/15 rounded-2xl px-4 py-3.5 hover:bg-white/15 hover:border-white/25 transition-all cursor-pointer w-full">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 group-hover:bg-primary/30 transition-colors">
                  <NextIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wide mb-0.5">
                    Prossimo passo
                  </p>
                  <p className="text-sm font-bold text-white leading-snug">
                    {nextStep.label}
                  </p>
                  <p className="text-xs text-white/55 mt-0.5 leading-snug">
                    {nextStep.desc}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/35 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          )}
        </div>

        {hasTest && latestResult && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {latestResult.recommendations.slice(0, 4).map((rec, i) => (
              <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`}>
                <div className="group bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/14 hover:border-white/18 transition-all cursor-pointer">
                  <p className="text-[10px] text-white/45 font-medium mb-0.5">
                    #{i + 1}
                  </p>
                  <p className="text-xs font-semibold text-white leading-snug truncate group-hover:text-primary transition-colors">
                    {rec.sectorName}
                  </p>
                  <p className="text-xs text-primary font-bold mt-0.5">
                    {rec.matchScore}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!hasTest && (
          <div className="mt-4 bg-white/8 border border-white/10 rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <Bot className="w-7 h-7 text-white/25 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                Non hai ancora completato il test
              </p>
              <p className="text-xs text-white/55 leading-relaxed">
                Fai il test RIASEC gratuito per sbloccare l'analisi AI e le
                raccomandazioni personalizzate.
              </p>
            </div>
            <Link href="/test" className="shrink-0">
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-xs rounded-full px-5 py-2.5 hover:bg-primary/90 transition-all">
                Inizia ora <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

