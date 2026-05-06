import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ProssimiEventi } from "@/components/calendario/ProssimiEventi";
import { ArrowRight, ExternalLink, LogIn, Newspaper, Clock, Sparkles, TrendingUp, Bot, DollarSign, GitCompare, Flame, Briefcase, Laptop, GitMerge } from "lucide-react";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";
import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { UserDashboard } from "@/components/UserDashboard";
import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import { useReducedMotion } from "@/lib/motion";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

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

function HomeNewsCard({ item }: { item: HomeNewsItem }) {
  const { t } = useTranslation();
  const catColor = CAT_COLOR[item.category] ?? CAT_COLOR["general"];
  const catEmoji = CAT_EMOJI[item.category] ?? CAT_EMOJI["general"];
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
      className="group flex flex-col rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-300 overflow-hidden h-full"
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

type LatestRec = { sectorId: number; sectorName: string; matchScore: number; matchReason: string };
type LatestResult = { sessionId: number; workPreference: string; recommendations: LatestRec[]; confirmedSectorId: number | null };

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
          <span className="shrink-0 text-2xl font-bold text-white/8 leading-none">#{rank}</span>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">{sector.description}</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/50 rounded-xl p-2 text-center border border-border/50">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> {t("common.salary")}
            </div>
            <p className="text-xs font-bold text-foreground">€{Math.round(sector.avgSalaryMin / 1000)}k–{Math.round(sector.avgSalaryMax / 1000)}k</p>
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

function AnimatedNumber({ value, suffix = "" }: { value: number, suffix?: string }) {
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

export default function Home() {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const { data: stats, isLoading: isStatsLoading } = useGetStatsSummary();
  const { data: trendingData } = useTrendingSectors();
  const { data: newsData, isLoading: isNewsLoading } = useHomeNews();
  const { isLoggedIn, user } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  const { data: latestResult, isLoading: isLatestLoading } = useLatestRecommendations(isLoggedIn && !!user);

  if (isLoggedIn && user && isLatestLoading) {
    return (
      <div className="flex flex-col w-full">
        <div className="py-16 md:py-24 container mx-auto px-4 max-w-5xl">
          <Skeleton className="h-10 w-64 mb-4 rounded-xl" />
          <Skeleton className="h-5 w-80 mb-8 rounded-xl" />
          <Skeleton className="h-40 w-full rounded-2xl mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isLoggedIn && user) {
    const isPremium = !!(user as { stripeSubscriptionId?: string }).stripeSubscriptionId;
    return <UserDashboard userName={user.name} latestResult={latestResult ?? null} isPremium={isPremium} />;
  }

  return (
    <div className="flex flex-col w-full">

      {/* ── HERO ─────────────────────────────────────── */}
      <section className="relative w-full min-h-[88vh] flex items-center justify-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-primary/3 blur-[80px] pointer-events-none" />
        </div>

        <div className="container mx-auto px-5 md:px-6 relative z-10 flex flex-col items-center text-center max-w-4xl">

          {/* Logo badge — like martes M in circle */}
          <motion.div
            initial={prefersReduced ? {} : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 md:mb-10"
          >
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-white/15 bg-white/5 flex items-center justify-center overflow-hidden shadow-2xl">
              <img src="/logo.svg" alt="NorthStar" className="w-full h-full object-cover" />
            </div>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            className="text-[2.6rem] sm:text-5xl md:text-7xl font-bold tracking-tight text-foreground mb-4 md:mb-5 leading-[1.05]"
            initial={prefersReduced ? {} : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("home.title")}{" "}
            <span className="text-primary font-serif italic">{t("home.titleHighlight")}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-base md:text-xl text-muted-foreground mb-8 md:mb-10 max-w-2xl leading-relaxed"
            initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {t("home.subtitle")}
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto"
            initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link href="/test">
              <div className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm md:text-base rounded-full px-8 py-3 md:py-3.5 hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20 hover:shadow-xl">
                {t("home.startTest")} <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
            {isLoggedIn ? (
              <Link href="/risultati/latest">
                <div className="flex items-center justify-center gap-2 border border-white/15 text-foreground font-semibold text-sm md:text-base rounded-full px-8 py-3 md:py-3.5 hover:border-white/30 hover:bg-white/5 transition-all">
                  {t("home.reviewResults")}
                </div>
              </Link>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="flex items-center justify-center gap-2 border border-white/15 text-foreground font-semibold text-sm md:text-base rounded-full px-8 py-3 md:py-3.5 hover:border-white/30 hover:bg-white/5 transition-all"
              >
                <LogIn className="w-4 h-4" />
                {t("home.alreadyAccount")}
              </button>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────── */}
      <section className="py-10 md:py-14 border-y border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              { value: stats?.totalTestsTaken || 12450, label: t("home.stats.guided"), suffix: "" },
              { value: stats?.totalSectors || 42, label: t("home.stats.sectors"), suffix: "" },
              { value: stats?.avgGrowthRate || 15, label: t("home.stats.avgGrowth"), suffix: "%" },
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

      {/* ── UPCOMING EVENTS (logged in) ──────────────── */}
      {isLoggedIn && user && (
        <section className="py-8 border-b border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <ProssimiEventi userId={user.id} limit={4} />
          </div>
        </section>
      )}

      {/* ── PERSONALIZED RECS (logged in) ────────────── */}
      {isLoggedIn && user && <PersonalizedRecommendationsSection userId={user.id} />}

      {/* ── FEATURES (not logged in) ─────────────────── */}
      {!isLoggedIn && (
        <section className="py-16 md:py-24 border-b border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <AnimateOnScroll>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> Come funziona
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">
                  Il tuo percorso{" "}
                  <span className="text-primary font-serif italic">professionale</span>
                </h2>
                <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                  Scopri il settore giusto per te, poi esplora ruoli, roadmap e strumenti AI per crescere.
                </p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  step: "01",
                  title: "Test di orientamento",
                  desc: "17 domande RIASEC per mappare la tua personalità e preferenze lavorative.",
                  href: "/test",
                  label: "Inizia il test",
                },
                {
                  step: "02",
                  title: "Scopri i settori",
                  desc: "28 settori professionali con dati su stipendi, crescita e rischio automazione.",
                  href: "/settori",
                  label: "Esplora settori",
                },
                {
                  step: "03",
                  title: "Strumenti AI",
                  desc: "Roadmap personalizzate, skill gap analysis, simulazione colloqui e coach AI.",
                  href: "/premium",
                  label: "Vedi premium",
                },
              ].map(({ step, title, desc, href, label }) => (
                <AnimateOnScrollItem key={step}>
                  <Link href={href}>
                    <div className="group flex flex-col h-full p-6 rounded-2xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-300 cursor-pointer">
                      <div className="text-4xl font-bold text-white/6 mb-4 leading-none">{step}</div>
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

      {/* ── TRENDING SECTORS ─────────────────────────── */}
      <section className="py-14 md:py-22">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <AnimateOnScroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-3">
                  <Flame className="w-3.5 h-3.5" /> {t("home.trending.badge")}
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">
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

          {isStatsLoading || !trendingData ? (
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

      {/* ── NEWS ─────────────────────────────────────── */}
      <section className="py-14 md:py-22 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <AnimateOnScroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-3">
                  <Newspaper className="w-3.5 h-3.5" /> {t("home.news.title")}
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{t("home.news.title")}</h2>
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

      {/* ── FINAL CTA ────────────────────────────────── */}
      {!isLoggedIn && (
        <section className="py-16 md:py-24 border-t border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-3xl text-center">
            <AnimateOnScroll>
              <div className="w-16 h-16 rounded-full border-2 border-white/10 bg-white/5 flex items-center justify-center overflow-hidden mx-auto mb-6">
                <img src="/logo.svg" alt="NorthStar" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
                Pronto a scoprire{" "}
                <span className="text-primary font-serif italic">la tua strada?</span>
              </h2>
              <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-xl mx-auto">
                Il test è gratuito e richiede solo 5 minuti. Nessuna registrazione necessaria per iniziare.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/test">
                  <div className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-base rounded-full px-8 py-3.5 hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20">
                    {t("home.startTest")} <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
                <button
                  onClick={() => setLoginOpen(true)}
                  className="flex items-center justify-center gap-2 border border-white/15 text-foreground font-semibold text-base rounded-full px-8 py-3.5 hover:border-white/30 hover:bg-white/5 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  {t("home.alreadyAccount")}
                </button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      )}

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
