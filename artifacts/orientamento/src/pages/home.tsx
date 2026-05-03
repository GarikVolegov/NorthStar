import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ProssimiEventi } from "@/components/calendario/ProssimiEventi";
import { ArrowRight, Compass, ExternalLink, LogIn, MapPin, Newspaper, Clock, Sparkles, Star, TrendingUp, Users, Bot, DollarSign, GitCompare, Flame, Briefcase, Laptop, GitMerge } from "lucide-react";
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
import { useReducedMotion, listItem } from "@/lib/motion";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

const TREND_COLOR: Record<string, string> = {
  booming:  "text-emerald-700 bg-emerald-50 border-emerald-200",
  growing:  "text-blue-700 bg-blue-50 border-blue-200",
  stable:   "text-slate-600 bg-slate-50 border-slate-200",
  declining:"text-rose-700 bg-rose-50 border-rose-200",
};
const RISK_COLOR: Record<string, string> = {
  low:    "text-emerald-700",
  medium: "text-amber-700",
  high:   "text-rose-700",
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
  technology: "bg-blue-50 text-blue-700 border-blue-200",
  business:   "bg-amber-50 text-amber-700 border-amber-200",
  education:  "bg-violet-50 text-violet-700 border-violet-200",
  science:    "bg-teal-50 text-teal-700 border-teal-200",
  health:     "bg-rose-50 text-rose-700 border-rose-200",
  finance:    "bg-green-50 text-green-700 border-green-200",
  general:    "bg-slate-50 text-slate-700 border-slate-200",
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
  dipendente: "text-blue-700 bg-blue-50 border-blue-200",
  autonomo: "text-violet-700 bg-violet-50 border-violet-200",
  ibrido: "text-emerald-700 bg-emerald-50 border-emerald-200",
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
      className="group flex flex-col rounded-2xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300 overflow-hidden h-full"
    >
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className={cn("inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5", catColor)}>
            {catEmoji} {catLabel}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {timeLabel}
          </span>
        </div>
        <h3 className="font-serif font-bold text-foreground leading-snug mb-2 line-clamp-3 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1 mb-4">
          {item.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/60">
          <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%]">{item.source}</span>
          <span className="flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all">
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
    <section className="py-10 bg-primary/5 border-b">
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
    <section className="py-10 bg-primary/5 border-b">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5" /> {t("home.personalized.badge")}
            </div>
            <h2 className="text-xl md:text-2xl font-serif font-bold text-foreground">
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
            <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-primary/20 bg-background text-sm font-medium text-primary hover:bg-primary/5 transition-colors">
              {t("home.personalized.fullDetail")} <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.recommendations.map((rec, i) => (
            <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`}>
              <div className={cn(
                "group flex items-start gap-3 p-4 rounded-2xl border bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full",
                rec.sectorId === data.confirmedSectorId && "border-primary/40 bg-primary/5",
              )}>
                <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-lg font-serif font-bold">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">
                    {rec.sectorName}
                    {rec.sectorId === data.confirmedSectorId && (
                      <span className="ml-2 text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">{t("home.personalized.chosen")}</span>
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
    <div className="group relative flex flex-col rounded-2xl border bg-card hover:shadow-lg hover:border-primary/30 transition-all duration-300 overflow-hidden">
      {rank === 1 && (
        <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5">
          <Flame className="w-3 h-3" /> {t("home.trending.topThisWeek")}
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <SectorIcon name={sector.icon} size={24} />
            </div>
            <div>
              <h3 className="font-serif font-bold text-foreground leading-tight">{sector.name}</h3>
              <span className={cn("mt-1 inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5", trendColor)}>
                <TrendingUp className="w-3 h-3" /> {trendLabel}
              </span>
            </div>
          </div>
          <span className="shrink-0 text-3xl font-serif font-bold text-primary/20 leading-none">#{rank}</span>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-5">{sector.description}</p>

        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-muted/40 rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="w-3 h-3" /> {t("common.salary")}
            </div>
            <p className="text-xs font-bold text-foreground">€{Math.round(sector.avgSalaryMin / 1000)}k–{Math.round(sector.avgSalaryMax / 1000)}k</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /> {t("common.growth")}
            </div>
            <p className="text-xs font-bold text-emerald-600">+{sector.growthRate}%</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-0.5 text-xs text-muted-foreground mb-1">
              <Bot className="w-3 h-3" /> {t("common.aiRisk")}
            </div>
            <p className={cn("text-xs font-bold", riskColor)}>{riskLabel}</p>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <Link href={`/settore/${sector.id}`} className="flex-1">
            <div className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15 text-primary text-sm font-medium hover:bg-primary/15 transition-colors group-hover:border-primary/30">
              {t("home.trending.deepen")} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
          <Link href={`/confronta?a=${sector.id}`}>
            <div className="px-3 py-2 rounded-xl bg-muted/60 border border-border text-muted-foreground text-sm hover:text-primary hover:border-primary/30 transition-colors" title={t("home.trending.compareWith")}>
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
  const hasConfirmedSector = !!(latestResult?.confirmedSectorId);

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
      {/* Hero Section */}
      <section className="relative w-full py-16 md:py-32 overflow-hidden flex items-center justify-center min-h-[80vh] md:min-h-[90vh]">
        <div className="absolute inset-0 z-0">
          <img src="/hero.png" alt="Serene path in nature" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px]"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background"></div>
        </div>
        <div className="container mx-auto px-5 md:px-6 relative z-10 flex flex-col items-center text-center max-w-4xl">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary mb-6 md:mb-8 animate-in slide-in-from-bottom-4 fade-in duration-700">
            <Star className="mr-2 h-4 w-4 fill-primary" />
            <span>{t("home.badge")}</span>
          </div>
          <h1 className="text-[2.4rem] leading-[1.15] sm:text-5xl md:text-7xl font-serif font-bold tracking-tight text-foreground mb-5 md:mb-6 animate-in slide-in-from-bottom-6 fade-in duration-700 delay-150 fill-mode-both">
            {t("home.title")}<br />
            <span className="text-primary italic">{t("home.titleHighlight")}</span>
          </h1>
          <p className="text-base md:text-2xl text-muted-foreground mb-8 md:mb-10 max-w-2xl animate-in slide-in-from-bottom-8 fade-in duration-700 delay-300 fill-mode-both leading-relaxed font-light">
            {t("home.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full sm:w-auto animate-in slide-in-from-bottom-10 fade-in duration-700 delay-500 fill-mode-both">
            <Button asChild size="lg" className="rounded-full text-base h-12 md:h-14 px-8 shadow-xl">
              <Link href="/test">
                {t("home.startTest")} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            {isLoggedIn ? (
              <Button asChild size="lg" variant="outline" className="rounded-full text-base h-12 md:h-14 px-8 border-primary/20 bg-background/50 backdrop-blur">
                <Link href="/risultati/latest">{t("home.reviewResults")}</Link>
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="rounded-full text-base h-12 md:h-14 px-8 border-primary/20 bg-background/50 backdrop-blur" onClick={() => setLoginOpen(true)}>
                <LogIn className="mr-2 h-5 w-5" />
                {t("home.alreadyAccount")}
              </Button>
            )}
          </div>
          {isLoggedIn && user && (
            <p className="mt-4 text-sm text-muted-foreground animate-in fade-in duration-500">
              {t("home.welcomeBack", { name: user.name })}
            </p>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-10 md:py-16 bg-card border-y">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-3 gap-4 md:gap-12 divide-x md:divide-x divide-border">
            <div className="flex flex-col items-center text-center px-2">
              <div className="text-3xl md:text-5xl font-serif font-bold text-primary mb-1 md:mb-2">
                {isStatsLoading ? <Skeleton className="h-9 w-16 rounded-md mx-auto" /> : <AnimatedNumber value={stats?.totalTestsTaken || 12450} />}
              </div>
              <p className="text-[10px] md:text-sm font-medium uppercase tracking-wider text-muted-foreground leading-tight">{t("home.stats.guided")}</p>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="text-3xl md:text-5xl font-serif font-bold text-primary mb-1 md:mb-2">
                {isStatsLoading ? <Skeleton className="h-9 w-16 rounded-md mx-auto" /> : <AnimatedNumber value={stats?.totalSectors || 42} />}
              </div>
              <p className="text-[10px] md:text-sm font-medium uppercase tracking-wider text-muted-foreground leading-tight">{t("home.stats.sectors")}</p>
            </div>
            <div className="flex flex-col items-center text-center px-2">
              <div className="text-3xl md:text-5xl font-serif font-bold text-primary mb-1 md:mb-2">
                {isStatsLoading ? <Skeleton className="h-9 w-16 rounded-md mx-auto" /> : <AnimatedNumber value={stats?.avgGrowthRate || 15} suffix="%" />}
              </div>
              <p className="text-[10px] md:text-sm font-medium uppercase tracking-wider text-muted-foreground leading-tight">{t("home.stats.avgGrowth")}</p>
            </div>
          </div>
        </div>
      </section>

      {isLoggedIn && user && (
        <section className="py-8 bg-background border-b">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <ProssimiEventi userId={user.id} limit={4} />
          </div>
        </section>
      )}

      {isLoggedIn && user && <PersonalizedRecommendationsSection userId={user.id} />}

      {/* Trending sectors */}
      <section className="py-12 md:py-20 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <AnimateOnScroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-3">
                  <Flame className="w-3.5 h-3.5" /> {t("home.trending.badge")}
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
                  {t("home.trending.title")}
                </h2>
                <p className="text-muted-foreground mt-2 max-w-xl">{t("home.trending.subtitle")}</p>
              </div>
              <Link href="/settori">
                <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
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

      {/* News Section */}
      <section className="py-12 md:py-20 bg-card border-y">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <AnimateOnScroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 md:mb-10">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-3">
                  <Newspaper className="w-3.5 h-3.5" /> {t("home.news.title")}
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground">{t("home.news.title")}</h2>
                <p className="text-muted-foreground mt-2 max-w-xl">{t("home.news.subtitle")}</p>
              </div>
              <Link href="/news">
                <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors bg-background">
                  {t("news.allNews")} <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </AnimateOnScroll>

          {isNewsLoading || !newsData ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
            </div>
          ) : (
            <AnimateOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {newsData.news.slice(0, 3).map((item) => (
                <AnimateOnScrollItem key={item.id}>
                  <HomeNewsCard item={item} />
                </AnimateOnScrollItem>
              ))}
            </AnimateOnScroll>
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="come-funziona" className="py-14 md:py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <AnimateOnScroll>
            <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-3">
                {t("home.howItWorks.badge")}
              </div>
              <h2 className="text-2xl md:text-4xl font-serif font-bold text-foreground mb-3 md:mb-4">{t("home.howItWorks.title")}</h2>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll stagger className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-px bg-border -z-10" />

            <AnimateOnScrollItem>
              <div className="flex flex-col items-center text-center group">
                <motion.div
                  className="w-24 h-24 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center mb-6 shadow-sm"
                  whileHover={prefersReduced ? undefined : { scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Users className="h-10 w-10" />
                </motion.div>
                <h3 className="text-xl font-bold font-serif mb-3">{t("home.howItWorks.step1Title")}</h3>
                <p className="text-muted-foreground leading-relaxed">{t("home.howItWorks.step1Desc")}</p>
              </div>
            </AnimateOnScrollItem>

            <AnimateOnScrollItem>
              <div className="flex flex-col items-center text-center group">
                <motion.div
                  className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm"
                  whileHover={prefersReduced ? undefined : { scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Compass className="h-10 w-10" />
                </motion.div>
                <h3 className="text-xl font-bold font-serif mb-3">{t("home.howItWorks.step2Title")}</h3>
                <p className="text-muted-foreground leading-relaxed">{t("home.howItWorks.step2Desc")}</p>
              </div>
            </AnimateOnScrollItem>

            <AnimateOnScrollItem>
              <div className="flex flex-col items-center text-center group">
                <motion.div
                  className="w-24 h-24 rounded-full bg-accent text-accent-foreground flex items-center justify-center mb-6 shadow-sm"
                  whileHover={prefersReduced ? undefined : { scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <MapPin className="h-10 w-10" />
                </motion.div>
                <h3 className="text-xl font-bold font-serif mb-3">{t("home.howItWorks.step3Title")}</h3>
                <p className="text-muted-foreground leading-relaxed">{t("home.howItWorks.step3Desc")}</p>
              </div>
            </AnimateOnScrollItem>
          </AnimateOnScroll>

          <div className="text-center mt-12">
            <Button asChild size="lg" className="rounded-full px-8 h-12">
              <Link href="/test">{t("home.howItWorks.startNow")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Philosophy quote */}
      <section className="py-14 md:py-24 bg-primary text-primary-foreground">
        <div className="container mx-auto px-5 md:px-6">
          <AnimateOnScroll>
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                whileHover={prefersReduced ? undefined : { rotate: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="inline-block mb-6 md:mb-8"
              >
                <Compass className="h-10 w-10 md:h-12 md:w-12 opacity-80" />
              </motion.div>
              <blockquote className="text-xl md:text-4xl font-serif font-medium leading-relaxed mb-6 md:mb-8">
                "Il futuro non si indovina, si costruisce. La migliore carriera non è quella che paga di più in assoluto, ma quella in cui il tuo talento naturale incontra una reale opportunità di mercato."
              </blockquote>
              <p className="text-primary-foreground/80 font-medium tracking-wider uppercase text-sm">
                La Filosofia di NorthStar
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 md:py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <AnimateOnScroll>
            <div className="bg-card rounded-3xl p-7 md:p-16 text-center border shadow-xl max-w-5xl mx-auto relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <TrendingUp className="w-64 h-64" />
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl md:text-5xl font-serif font-bold text-foreground mb-4 md:mb-6">
                  {t("chiSiamo.ctaTitle")}
                </h2>
                <p className="text-base md:text-xl text-muted-foreground mb-7 md:mb-10 max-w-2xl mx-auto font-light">
                  {t("chiSiamo.ctaDesc")}
                </p>
                <Button asChild size="lg" className="rounded-full text-base md:text-lg h-12 md:h-14 px-8 md:px-10 shadow-lg hover:shadow-xl transition-all">
                  <Link href="/test">{t("home.howItWorks.startNow")}</Link>
                </Button>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </div>
  );
}
