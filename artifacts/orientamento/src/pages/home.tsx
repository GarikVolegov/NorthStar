import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ProssimiEventi } from "@/components/calendario/ProssimiEventi";
import {
  ArrowRight, ExternalLink, LogIn, Newspaper, Clock, Sparkles, TrendingUp, Bot, DollarSign,
  GitCompare, Flame, Briefcase, Laptop, GitMerge, HelpCircle, Rocket, Building2, BarChart3,
  CheckCircle2, MapPin, ChevronRight, Star, Zap,
} from "lucide-react";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import { useReducedMotion } from "@/lib/motion";
import { useTranslation } from "react-i18next";

const ONBOARDING_KEY = "northstar_onboarding_done";

const BASE = import.meta.env.BASE_URL || "/";

/* ── Types ─────────────────────────────────────────────── */
type TrendingSector = {
  id: number; name: string; icon: string; description: string;
  trend: string; growthRate: number; automationRisk: string;
  avgSalaryMin: number; avgSalaryMax: number;
  riasecTypes: string[]; weeklyPicks: number; totalPicks: number;
};
type HomeNewsItem = {
  id: string; title: string; description: string;
  source: string; url: string; publishedAt: string;
  image: string | null; category: string; tags: string[];
};
type LatestRec = { sectorId: number; sectorName: string; matchScore: number; matchReason: string };
type LatestResult = { sessionId: number; workPreference: string; recommendations: LatestRec[]; confirmedSectorId: number | null };

/* ── Palette helpers ───────────────────────────────────── */
const TREND_COLOR: Record<string, string> = {
  booming:  "text-primary bg-primary/10 border-primary/30",
  growing:  "text-blue-400 bg-blue-400/10 border-blue-400/30",
  stable:   "text-muted-foreground bg-muted border-border",
  declining:"text-red-400 bg-red-400/10 border-red-400/30",
};
const RISK_COLOR: Record<string, string> = {
  low:    "text-primary",
  medium: "text-amber-400",
  high:   "text-red-400",
};
const CAT_COLOR: Record<string, string> = {
  technology: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  business:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
  education:  "text-violet-400 bg-violet-400/10 border-violet-400/20",
  science:    "text-teal-400 bg-teal-400/10 border-teal-400/20",
  health:     "text-rose-400 bg-rose-400/10 border-rose-400/20",
  finance:    "text-primary bg-primary/10 border-primary/20",
  general:    "text-muted-foreground bg-muted border-border",
};
const CAT_EMOJI: Record<string, string> = {
  technology: "💻", business: "📈", education: "🎓",
  science: "🔬", health: "❤️", finance: "💰", general: "🌍",
};
const WORK_MODE_ICON: Record<string, React.ReactNode> = {
  dipendente: <Briefcase className="w-3.5 h-3.5" />,
  autonomo: <Laptop className="w-3.5 h-3.5" />,
  ibrido: <GitMerge className="w-3.5 h-3.5" />,
};
const WORK_MODE_COLOR: Record<string, string> = {
  dipendente: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  autonomo: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  ibrido: "text-primary bg-primary/10 border-primary/20",
};

/* ── Persona definitions ──────────────────────────────── */
type JourneyId = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";
interface Persona {
  id: JourneyId;
  icon: React.ElementType;
  label: string;
  tagline: string;
  ctaLabel: string;
  ctaHref: string;
  tools: string[];
  accentClass: string;
  borderClass: string;
}
const PERSONAS: Persona[] = [
  {
    id: "indeciso",
    icon: HelpCircle,
    label: "Indeciso",
    tagline: "Non so ancora cosa fare",
    ctaLabel: "Fai il test gratuito",
    ctaHref: "/test",
    tools: ["Test RIASEC", "Esplora settori", "Coach AI"],
    accentClass: "text-primary",
    borderClass: "hover:border-primary/50",
  },
  {
    id: "dipendente",
    icon: TrendingUp,
    label: "Dipendente",
    tagline: "Ho un lavoro e voglio crescere",
    ctaLabel: "Analizza le mie skill",
    ctaHref: "/test",
    tools: ["Skill Gap", "Simulatore colloquio", "Roadmap"],
    accentClass: "text-[#A8D5BA]",
    borderClass: "hover:border-[#A8D5BA]/50",
  },
  {
    id: "autonomo",
    icon: Rocket,
    label: "Autonomo",
    tagline: "Lavoro in proprio e voglio scalare",
    ctaLabel: "Valida la mia idea",
    ctaHref: "/validatore-idea",
    tools: ["Validatore Idea", "Roadmap business", "Coach AI"],
    accentClass: "text-primary",
    borderClass: "hover:border-primary/50",
  },
  {
    id: "azienda",
    icon: Building2,
    label: "Azienda",
    tagline: "Cerco il profilo giusto",
    ctaLabel: "Esplora i profili",
    ctaHref: "/settori",
    tools: ["Profili RIASEC", "Settori in crescita", "Affilazione"],
    accentClass: "text-[#A8D5BA]",
    borderClass: "hover:border-[#A8D5BA]/50",
  },
  {
    id: "investitore",
    icon: BarChart3,
    label: "Investitore",
    tagline: "Valuto opportunità di mercato",
    ctaLabel: "Vedi i trend",
    ctaHref: "/settori",
    tools: ["Settori in crescita", "Analisi trend", "Knowledge Graph"],
    accentClass: "text-primary",
    borderClass: "hover:border-primary/50",
  },
];

const JOURNEY_LABELS: Record<JourneyId, { label: string; Icon: React.ElementType; accentClass: string }> = {
  indeciso:    { label: "Indeciso",     Icon: HelpCircle,  accentClass: "text-primary" },
  dipendente:  { label: "Dipendente",   Icon: TrendingUp,  accentClass: "text-[#A8D5BA]" },
  autonomo:    { label: "Autonomo",     Icon: Rocket,      accentClass: "text-primary" },
  azienda:     { label: "Azienda",      Icon: Building2,   accentClass: "text-[#A8D5BA]" },
  investitore: { label: "Investitore",  Icon: BarChart3,   accentClass: "text-primary" },
};

/* ── Data hooks ───────────────────────────────────────── */
function useHomeNews() {
  return useQuery<{ news: HomeNewsItem[] }>({
    queryKey: ["home-news"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/news?multi=true&categories=technology,business,education&perCategory=1`);
      if (!res.ok) throw new Error("news error");
      return res.json();
    },
    staleTime: 600_000,
  });
}

function useTrendingSectors() {
  return useQuery<TrendingSector[]>({
    queryKey: ["trending-sectors"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/trending-sectors`);
      if (!res.ok) throw new Error("error");
      return res.json();
    },
    staleTime: 300_000,
  });
}

function useLatestRecommendations(enabled: boolean) {
  return useQuery<LatestResult>({
    queryKey: ["latest-recommendations"],
    enabled,
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/test-sessions/latest`);
      if (!res.ok) throw new Error("No session");
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
}

/* ── Animated counter ─────────────────────────────────── */
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let startTime: number;
    const duration = 1500;
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setCurrent(Math.floor(ease * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <span>{current}{suffix}</span>;
}

/* ── News card ────────────────────────────────────────── */
function HomeNewsCard({ item }: { item: HomeNewsItem }) {
  const { t } = useTranslation();
  const catColor = CAT_COLOR[item.category] ?? CAT_COLOR["general"];
  const catEmoji = CAT_EMOJI[item.category] ?? "🌍";
  const catLabel = t(`news.categories.${item.category}`, { defaultValue: item.category });
  const diff = Date.now() - new Date(item.publishedAt).getTime();
  const h = Math.floor(diff / 3600000);
  let timeLabel: string;
  if (h < 1) timeLabel = t("news.timeAgo.lessThan1h");
  else if (h === 1) timeLabel = t("news.timeAgo.1h");
  else if (h < 24) timeLabel = t("news.timeAgo.hours", { h });
  else {
    const d = Math.floor(h / 24);
    timeLabel = d === 1 ? t("news.timeAgo.yesterday") : t("news.timeAgo.days", { d });
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300 overflow-hidden h-full"
    >
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5", catColor)}>
            {catEmoji} {catLabel}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {timeLabel}
          </span>
        </div>
        <h3 className="font-semibold text-foreground leading-snug mb-2 line-clamp-3 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1 mb-4">
          {item.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/60">
          <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%]">{item.source}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
            {t("common.readMore")} <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </div>
    </a>
  );
}

/* ── Trending sector card ─────────────────────────────── */
function TrendingSectorCard({ sector, rank }: { sector: TrendingSector; rank: number }) {
  const { t } = useTranslation();
  const trendColor = TREND_COLOR[sector.trend] ?? TREND_COLOR["stable"];
  const trendLabel = t(`results.trend.${sector.trend}`, { defaultValue: sector.trend });
  const riskColor  = RISK_COLOR[sector.automationRisk] ?? RISK_COLOR["medium"];
  const riskLabel  = t(`results.risk.${sector.automationRisk}`, { defaultValue: sector.automationRisk });

  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300 overflow-hidden">
      {rank === 1 && (
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary border-b border-primary/20 text-xs font-bold px-4 py-1.5">
          <Flame className="w-3 h-3" /> {t("home.trending.topThisWeek")}
        </div>
      )}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
              <SectorIcon name={sector.icon} size={22} />
            </div>
            <div>
              <h3 className="font-bold text-foreground leading-tight">{sector.name}</h3>
              <span className={cn("mt-1 inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5", trendColor)}>
                <TrendingUp className="w-3 h-3" /> {trendLabel}
              </span>
            </div>
          </div>
          <span className="shrink-0 text-2xl font-bold text-foreground/8 leading-none">#{rank}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">{sector.description}</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/50 rounded-xl p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> {t("common.salary")}
            </div>
            <p className="text-xs font-bold text-foreground">€{Math.round(sector.avgSalaryMin/1000)}k–{Math.round(sector.avgSalaryMax/1000)}k</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /> {t("common.growth")}
            </div>
            <p className="text-xs font-bold text-primary">+{sector.growthRate}%</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <Bot className="w-3 h-3" /> {t("common.aiRisk")}
            </div>
            <p className={cn("text-xs font-bold", riskColor)}>{riskLabel}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-auto">
          <Link href={`/settore/${sector.id}`} className="flex-1">
            <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
              {t("home.trending.deepen")} <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
          <Link href={`/confronta?a=${sector.id}`}>
            <div className="px-3 py-2 rounded-xl bg-muted/60 border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors" title={t("home.trending.compareWith")}>
              <GitCompare className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Guest hero: 5 persona picker ─────────────────────── */
function GuestPersonaHero({ onLoginClick }: { onLoginClick: () => void }) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const [, setLocation] = useLocation();

  return (
    <section className="relative w-full overflow-hidden">
      {/* Background */}
      <div className="hero-navy py-16 md:py-20 px-4 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-primary/6 blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={prefersReduced ? {} : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-semibold text-primary border border-primary/30 mb-5">
              <Star className="w-3.5 h-3.5" /> Orientamento professionale personalizzato
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
              Qual è il tuo{" "}
              <span className="text-italic-serif text-primary">obiettivo?</span>
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              NorthStar si adatta al tuo percorso. Scegli il profilo che ti rappresenta e ricevi
              strumenti e consigli su misura per te.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Persona cards — slightly below the hero */}
      <div className="bg-background relative -mt-2 pb-2">
        <div className="max-w-6xl mx-auto px-4 pt-8 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {PERSONAS.map((persona, i) => {
              const Icon = persona.icon;
              return (
                <motion.div
                  key={persona.id}
                  initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.4 }}
                  onClick={() => setLocation(persona.ctaHref)}
                  className={cn(
                    "group cursor-pointer rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 transition-all duration-200",
                    persona.borderClass,
                    "hover:bg-card/80 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
                  )}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/15 transition-colors">
                    <Icon className={cn("w-5 h-5", persona.accentClass)} />
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">{persona.label}</p>
                    <p className={cn("text-xs font-semibold mt-0.5", persona.accentClass)}>{persona.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {persona.tools.slice(0, 2).map((tool) => (
                      <span key={tool} className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        {tool}
                      </span>
                    ))}
                  </div>
                  <div className={cn("flex items-center gap-1 text-xs font-semibold", persona.accentClass, "group-hover:gap-1.5 transition-all")}>
                    {persona.ctaLabel} <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Sub-CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 pb-4">
            <Link href="/test">
              <div className="flex items-center gap-2 bg-primary text-primary-foreground font-bold text-sm rounded-full px-7 py-3 hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20">
                {t("home.startTest")} <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
            <button
              onClick={onLoginClick}
              className="flex items-center gap-2 border border-border text-muted-foreground font-semibold text-sm rounded-full px-7 py-3 hover:border-white/20 hover:text-foreground hover:bg-white/5 transition-all"
            >
              <LogIn className="w-4 h-4" />
              {t("home.alreadyAccount")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Logged-in personalized hero ──────────────────────── */
function LoggedInHero({
  userName,
  journeyType,
  latestResult,
}: {
  userName: string;
  journeyType: string | null | undefined;
  latestResult: LatestResult | null;
}) {
  const { t } = useTranslation();
  const journey = journeyType ? JOURNEY_LABELS[journeyType as JourneyId] : null;
  const JourneyIcon = journey?.Icon;
  const hasTest = !!latestResult?.recommendations?.length;

  const NEXT_STEP: Record<JourneyId, { label: string; desc: string; href: string; icon: React.ElementType }> = {
    indeciso:    { label: "Fai il test RIASEC",        desc: "Scopri la tua personalità professionale",          href: "/test",             icon: Zap },
    dipendente:  { label: "Analizza il tuo gap",        desc: "Identifica le competenze che ti mancano",          href: "/dashboard",        icon: TrendingUp },
    autonomo:    { label: "Valida la tua idea",         desc: "Ricevi una valutazione AI del tuo business",       href: "/validatore-idea",  icon: Rocket },
    azienda:     { label: "Esplora i profili",          desc: "Trova i profili RIASEC più adatti al tuo team",    href: "/settori",          icon: Building2 },
    investitore: { label: "Vedi i settori in crescita", desc: "Analizza trend e opportunità del mercato italiano", href: "/settori",          icon: BarChart3 },
  };

  const nextStep = journeyType ? NEXT_STEP[journeyType as JourneyId] : null;
  const NextIcon = nextStep?.icon;

  return (
    <section className="hero-navy py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Greeting */}
          <div>
            <p className="text-white/60 text-sm font-medium mb-1">Bentornato,</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {userName.split(" ")[0]} 👋
            </h1>
            {journey && JourneyIcon ? (
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5">
                <JourneyIcon className={cn("w-4 h-4", journey.accentClass)} />
                <span className={cn("text-sm font-semibold", journey.accentClass)}>{journey.label}</span>
              </div>
            ) : (
              <Link href="/percorso">
                <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/30 rounded-full px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/30 transition-colors cursor-pointer">
                  <MapPin className="w-4 h-4" /> Scegli il tuo percorso <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            )}
          </div>

          {/* Next step card */}
          {nextStep && NextIcon && (
            <Link href={nextStep.href}>
              <div className="group flex items-center gap-4 bg-white/10 border border-white/15 rounded-2xl px-5 py-4 hover:bg-white/15 hover:border-white/25 transition-all cursor-pointer min-w-[280px]">
                <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30 group-hover:bg-primary/30 transition-colors">
                  <NextIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-0.5">Prossimo passo</p>
                  <p className="text-sm font-bold text-white leading-snug">{nextStep.label}</p>
                  <p className="text-xs text-white/60 mt-0.5">{nextStep.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          )}
        </div>

        {/* Quick stats row */}
        {hasTest && latestResult && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {latestResult.recommendations.slice(0, 4).map((rec, i) => (
              <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`}>
                <div className="group bg-white/8 border border-white/12 rounded-xl px-4 py-3 hover:bg-white/14 hover:border-white/20 transition-all cursor-pointer">
                  <p className="text-xs text-white/50 font-medium mb-1">#{i + 1} match</p>
                  <p className="text-sm font-semibold text-white leading-snug truncate group-hover:text-primary transition-colors">{rec.sectorName}</p>
                  <p className="text-xs text-primary font-bold mt-0.5">{rec.matchScore}%</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!hasTest && (
          <div className="mt-5 bg-white/8 border border-white/12 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <Bot className="w-8 h-8 text-white/30 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Non hai ancora completato il test</p>
              <p className="text-xs text-white/60">Fai il test RIASEC gratuito per sbloccare l'analisi AI e le raccomandazioni personalizzate.</p>
            </div>
            <Link href="/test">
              <div className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold text-xs rounded-full px-5 py-2.5 hover:bg-primary/90 transition-all">
                Inizia ora <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Personalized recs section (logged in) ────────────── */
function PersonalizedRecommendationsSection({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useLatestRecommendations(!!userId);
  if (isLoading) return (
    <section className="py-10 border-b border-border">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <Skeleton className="h-6 w-64 mb-4 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      </div>
    </section>
  );
  if (!data?.recommendations?.length) return null;

  const wm = data.workPreference;
  const wmLabel = t(`workMode.${wm}`, { defaultValue: wm });
  const wmIcon = WORK_MODE_ICON[wm];
  const wmColor = WORK_MODE_COLOR[wm];

  return (
    <section className="py-10 border-b border-border">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-2">
              <Sparkles className="w-3.5 h-3.5" /> {t("home.personalized.badge")}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {t("home.personalized.title")}
            </h2>
            {wmLabel && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                {t("home.personalized.sortedBy")}
                <span className={cn("inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5", wmColor)}>
                  {wmIcon} {wmLabel}
                </span>
              </p>
            )}
          </div>
          <Link href={`/risultati/${data.sessionId}`}>
            <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
              {t("home.personalized.fullDetail")} <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.recommendations.map((rec, i) => (
            <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`}>
              <div className={cn(
                "group flex items-start gap-3 p-4 rounded-2xl border bg-card hover:border-primary/30 transition-all duration-200 cursor-pointer h-full",
                rec.sectorId === data.confirmedSectorId ? "border-primary/40 bg-primary/5" : "border-border",
              )}>
                <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-bold border border-primary/20">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">
                    {rec.sectorName}
                    {rec.sectorId === data.confirmedSectorId && (
                      <span className="ml-2 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">{t("home.personalized.chosen")}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{rec.matchReason}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Quick tools grid (logged in) ─────────────────────── */
function QuickToolsSection({ journeyType, sessionId }: { journeyType: string | null | undefined; sessionId?: number }) {
  type ToolDef = { href: string; icon: React.ElementType; title: string; desc: string; badge?: string };

  const ALL_TOOLS: Record<string, ToolDef[]> = {
    indeciso: [
      { href: "/test",       icon: Zap,        title: "Test RIASEC",       desc: "17 domande per mappare la tua personalità" },
      { href: "/settori",    icon: TrendingUp,  title: "Esplora settori",   desc: "28 settori con stipendi e crescita" },
      { href: "/coach",      icon: Bot,         title: "Coach AI",          desc: "Sessioni di coaching personalizzato", badge: "Premium" },
      { href: "/news",       icon: Newspaper,   title: "News del lavoro",   desc: "Ultime notizie dal mercato" },
    ],
    dipendente: [
      { href: sessionId ? `/skills-gap/${sessionId}` : "/dashboard", icon: Zap, title: "Gap Competenze", desc: "Skill mancanti per il tuo ruolo", badge: "AI" },
      { href: sessionId ? `/colloquio/${sessionId}` : "/dashboard",  icon: TrendingUp, title: "Simulatore Colloquio", desc: "Allenati con domande reali", badge: "AI" },
      { href: "/coach",      icon: Bot,         title: "Career Coach AI",   desc: "Percorso di crescita personalizzato" },
      { href: "/candidature",icon: Briefcase,   title: "Le mie candidature",desc: "Gestisci le tue richieste di lavoro" },
    ],
    autonomo: [
      { href: "/validatore-idea", icon: Rocket, title: "Valida la tua idea", desc: "Score AI su 10 con report dettagliato", badge: "AI" },
      { href: "/coach",           icon: Bot,    title: "Business Coach AI",  desc: "Consigli strategici per il tuo business" },
      { href: "/settori",         icon: TrendingUp, title: "Mercati in crescita", desc: "Trova il settore più profittevole" },
      { href: "/news",            icon: Newspaper, title: "News business",  desc: "Ultime notizie imprenditoria" },
    ],
    azienda: [
      { href: "/settori",    icon: TrendingUp,  title: "Profili RIASEC",    desc: "Trova il profilo psicologico ideale" },
      { href: "/affiliazione",icon: Building2,  title: "Affiliazione",      desc: "Pubblica la tua opportunità" },
      { href: "/news",       icon: Newspaper,   title: "News HR",           desc: "Tendenze del mercato del lavoro" },
      { href: "/crescita",   icon: Sparkles,    title: "Crescita aziendale",desc: "Articoli su cultura e team building" },
    ],
    investitore: [
      { href: "/settori",    icon: BarChart3,   title: "Settori in crescita", desc: "Analisi trend del mercato italiano" },
      { href: "/news",       icon: Newspaper,   title: "News mercati",      desc: "Ultime notizie economia e finanza" },
      { href: "/crescita",   icon: TrendingUp,  title: "Report di crescita", desc: "Dati e insight per investire" },
      { href: sessionId ? `/grafo` : "/settori", icon: Sparkles, title: "Knowledge Graph", desc: "Rete di connessioni tra settori" },
    ],
  };

  const tools = (journeyType && ALL_TOOLS[journeyType]) ? ALL_TOOLS[journeyType] : ALL_TOOLS.indeciso;

  return (
    <section className="py-10 border-b border-border">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-foreground">I tuoi strumenti</h2>
            <p className="text-xs text-muted-foreground">Selezionati per il tuo percorso</p>
          </div>
          <Link href="/dashboard" className="ml-auto">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">
              Dashboard completa <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tools.map(({ href, icon: Icon, title, desc, badge }) => (
            <Link key={title} href={href}>
              <div className="group rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-primary/30 hover:shadow-md hover:shadow-black/10 transition-all duration-200 cursor-pointer h-full">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  {badge && (
                    <span className="text-xs font-semibold bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">{badge}</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm leading-snug">{title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 mt-auto self-end text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Main Home component ──────────────────────────────── */
export default function Home() {
  const { t } = useTranslation();
  const { data: stats, isLoading: isStatsLoading } = useGetStatsSummary();
  const { data: trendingData } = useTrendingSectors();
  const { data: newsData, isLoading: isNewsLoading } = useHomeNews();
  const { isLoggedIn, user, updateUser } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const prefersReduced = useReducedMotion();

  const { data: latestResult, isLoading: isLatestLoading } = useLatestRecommendations(isLoggedIn && !!user);

  // Show onboarding wizard once per browser — after login, if not already completed
  useEffect(() => {
    if (!isLoggedIn || !user || isLatestLoading) return;
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      // Small delay so the page renders first
      const t = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(t);
    }
  }, [isLoggedIn, user, isLatestLoading]);

  if (isLoggedIn && user && isLatestLoading) {
    return (
      <div className="flex flex-col w-full">
        <div className="hero-navy py-10 px-4">
          <div className="max-w-5xl mx-auto">
            <Skeleton className="h-8 w-48 mb-3 rounded-xl" />
            <Skeleton className="h-5 w-64 mb-6 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          </div>
        </div>
        <div className="py-10 container mx-auto px-4 max-w-6xl">
          <Skeleton className="h-6 w-48 mb-4 rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">

      {/* ── HERO (persona-aware) ────────────────────────── */}
      {isLoggedIn && user ? (
        <LoggedInHero
          userName={user.name}
          journeyType={user.journeyType}
          latestResult={latestResult ?? null}
        />
      ) : (
        <GuestPersonaHero onLoginClick={() => setLoginOpen(true)} />
      )}

      {/* ── STATS BAR ──────────────────────────────────── */}
      <section className="py-8 md:py-10 border-y border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              { value: stats?.totalTestsTaken || 12450, label: t("home.stats.guided"), suffix: "" },
              { value: stats?.totalSectors || 42,       label: t("home.stats.sectors"), suffix: "" },
              { value: stats?.avgGrowthRate || 15,      label: t("home.stats.avgGrowth"), suffix: "%" },
            ].map(({ value, label, suffix }, i) => (
              <div key={i} className="flex flex-col items-center text-center px-4 py-2">
                <div className="text-3xl md:text-5xl font-bold text-primary mb-1">
                  {isStatsLoading ? (
                    <Skeleton className="h-9 w-16 rounded-md mx-auto" />
                  ) : (
                    <AnimatedNumber value={value} suffix={suffix} />
                  )}
                </div>
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-muted-foreground leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUICK TOOLS (logged in) ─────────────────────── */}
      {isLoggedIn && user && (
        <QuickToolsSection
          journeyType={user.journeyType}
          sessionId={latestResult?.sessionId}
        />
      )}

      {/* ── PERSONALIZED RECS (logged in) ──────────────── */}
      {isLoggedIn && user && <PersonalizedRecommendationsSection userId={user.id} />}

      {/* ── UPCOMING EVENTS (logged in) ─────────────────── */}
      {isLoggedIn && user && (
        <section className="py-8 border-b border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <ProssimiEventi userId={user.id} limit={4} />
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS (guests only) ─────────────────── */}
      {!isLoggedIn && (
        <section className="py-14 md:py-20 border-b border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <AnimateOnScroll>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> Come funziona
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  Il percorso giusto per{" "}
                  <span className="text-italic-serif text-primary">te</span>
                </h2>
                <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                  Tre semplici passi per capire dove sei, dove vuoi arrivare e come arrivarci.
                </p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: "01", icon: Zap,
                  title: "Scegli il tuo profilo",
                  desc: "Seleziona il percorso che ti rappresenta: indeciso, dipendente, autonomo, azienda o investitore.",
                  href: "/percorso",
                  label: "Scegli il percorso",
                  accent: "bg-primary/10 text-primary border-primary/20",
                },
                {
                  step: "02", icon: CheckCircle2,
                  title: "Completa il test",
                  desc: "17 domande RIASEC per mappare la tua personalità professionale e preferenze di lavoro.",
                  href: "/test",
                  label: "Inizia il test gratuito",
                  accent: "bg-[#A8D5BA]/10 text-[#A8D5BA] border-[#A8D5BA]/20",
                },
                {
                  step: "03", icon: Bot,
                  title: "Ottieni strumenti AI",
                  desc: "Roadmap personalizzate, skill gap analysis, simulazione colloqui, business validator e coach AI.",
                  href: "/premium",
                  label: "Scopri gli strumenti",
                  accent: "bg-primary/10 text-primary border-primary/20",
                },
              ].map(({ step, icon: Icon, title, desc, href, label, accent }) => (
                <AnimateOnScrollItem key={step}>
                  <Link href={href}>
                    <div className="group flex flex-col h-full p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-300 cursor-pointer">
                      <div className={cn("inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-1 border mb-4 w-fit", accent)}>
                        <Icon className="w-3.5 h-3.5" />
                        Passo {step}
                      </div>
                      <h3 className="font-bold text-foreground mb-2">{title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">{desc}</p>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
                        {label} <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Link>
                </AnimateOnScrollItem>
              ))}
            </AnimateOnScroll>
          </div>
        </section>
      )}

      {/* ── TRENDING SECTORS ───────────────────────────── */}
      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <AnimateOnScroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-3">
                  <Flame className="w-3.5 h-3.5" /> {t("home.trending.badge")}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  {t("home.trending.title")}
                </h2>
                <p className="text-muted-foreground mt-2 max-w-xl">{t("home.trending.subtitle")}</p>
              </div>
              <Link href="/settori">
                <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
                  {t("home.trending.exploreAll")} <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </AnimateOnScroll>

          {!trendingData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-full rounded-2xl" />)}
            </div>
          ) : (
            <AnimateOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {trendingData.map((sector, i) => (
                <AnimateOnScrollItem key={sector.id}>
                  <TrendingSectorCard sector={sector} rank={i + 1} />
                </AnimateOnScrollItem>
              ))}
            </AnimateOnScroll>
          )}
        </div>
      </section>

      {/* ── NEWS ───────────────────────────────────────── */}
      <section className="py-14 md:py-20 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <AnimateOnScroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-3">
                  <Newspaper className="w-3.5 h-3.5" /> {t("home.news.title")}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">{t("home.news.title")}</h2>
                <p className="text-muted-foreground mt-2 max-w-xl">{t("home.news.subtitle")}</p>
              </div>
              <Link href="/news">
                <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
                  {t("home.news.readAll")} <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </AnimateOnScroll>

          {isNewsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
            </div>
          ) : newsData?.news?.length ? (
            <AnimateOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {newsData.news.map((item) => (
                <AnimateOnScrollItem key={item.id}>
                  <HomeNewsCard item={item} />
                </AnimateOnScrollItem>
              ))}
            </AnimateOnScroll>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Newspaper className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">{t("home.news.empty")}</p>
              <Link href="/news">
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">
                  {t("home.news.readAll")} <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── FINAL CTA (guests only) ─────────────────────── */}
      {!isLoggedIn && (
        <section className="py-16 md:py-24 border-t border-border">
          <div className="max-w-5xl mx-auto px-4">
            <AnimateOnScroll>
              {/* Persona mini-grid CTA */}
              <div className="rounded-3xl overflow-hidden border border-border bg-card">
                <div className="hero-navy px-8 py-10 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-white/15 bg-white/8 flex items-center justify-center overflow-hidden mx-auto mb-5">
                    <img src="/logo.svg" alt="NorthStar" className="w-full h-full object-cover" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                    Pronto a trovare{" "}
                    <span className="text-italic-serif text-primary">la tua strada?</span>
                  </h2>
                  <p className="text-white/60 mb-8 max-w-xl mx-auto">
                    Il test è gratuito, nessuna carta di credito richiesta. Ottieni la tua analisi in 5 minuti.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/test">
                      <div className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-base rounded-full px-8 py-3.5 hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20">
                        {t("home.startTest")} <ArrowRight className="w-4 h-4" />
                      </div>
                    </Link>
                    <Link href="/percorso">
                      <div className="flex items-center justify-center gap-2 border border-white/20 text-white font-semibold text-base rounded-full px-8 py-3.5 hover:border-white/30 hover:bg-white/8 transition-all">
                        <MapPin className="w-4 h-4" />
                        Scegli il tuo percorso
                      </div>
                    </Link>
                  </div>
                </div>
                {/* Bottom social proof */}
                <div className="px-8 py-4 flex flex-wrap items-center justify-center gap-4 border-t border-border">
                  {[
                    { icon: CheckCircle2, text: "Test gratuito" },
                    { icon: CheckCircle2, text: "Nessuna registrazione obbligatoria" },
                    { icon: CheckCircle2, text: "Risultati immediati" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Icon className="w-4 h-4 text-primary" /> {text}
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      )}

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

      {/* ── Onboarding wizard (first login) ─────────────── */}
      <AnimatePresence>
        {showOnboarding && isLoggedIn && user && (
          <OnboardingWizard
            userId={user.id}
            userName={user.name}
            currentJourneyType={user.journeyType}
            sessionId={latestResult?.sessionId}
            topSectorName={latestResult?.recommendations?.[0]?.sectorName ?? null}
            onClose={() => {
              setShowOnboarding(false);
              localStorage.setItem(ONBOARDING_KEY, "1");
            }}
            onComplete={(journeyType) => {
              setShowOnboarding(false);
              localStorage.setItem(ONBOARDING_KEY, "1");
              updateUser({ journeyType });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
