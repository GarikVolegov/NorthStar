import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import { usePageMeta } from "@/lib/seo";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SectorIcon, RIASEC_LABELS } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import {
  Search, TrendingUp, DollarSign, Bot, ArrowRight,
  Zap, SlidersHorizontal, X, GitCompare,
} from "lucide-react";
import { WorkModeBadge } from "@/components/WorkModeSelector";
import type { Sector as ApiSector } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

type Sector = ApiSector;

const TREND_COLOR: Record<string, string> = {
  booming:  "text-emerald-700 bg-emerald-50 border-emerald-200",
  growing:  "text-blue-700 bg-blue-50 border-blue-200",
  stable:   "text-slate-600 bg-slate-50 border-slate-200",
  declining:"text-rose-700 bg-rose-50 border-rose-200",
};
const RISK_COLOR: Record<string, string> = {
  low:    "text-emerald-700 bg-emerald-50 border-emerald-200",
  medium: "text-amber-700 bg-amber-50 border-amber-200",
  high:   "text-rose-700 bg-rose-50 border-rose-200",
};

function useAllSectors() {
  return useQuery<Sector[]>({
    queryKey: ["all-sectors"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/sectors`);
      if (!res.ok) throw new Error("error loading sectors");
      return res.json();
    },
    staleTime: 300_000,
  });
}

const ALL_RIASEC = ["R", "I", "A", "S", "E", "C"];
const ALL_RISK   = ["low", "medium", "high"];

export default function Settori() {
  const { t } = useTranslation();

  usePageMeta({
    title: t("seo.sectors.title"),
    description: t("seo.sectors.description"),
    path: "/settori",
  });

  const { data: sectors = [], isLoading } = useAllSectors();

  const [search, setSearch] = useState("");
  const [activeRiasec, setActiveRiasec] = useState<string[]>([]);
  const [activeRisk, setActiveRisk]     = useState<string[]>([]);

  function toggleRiasec(r: string) {
    setActiveRiasec((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function toggleRisk(r: string) {
    setActiveRisk((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function clearAll() {
    setSearch(""); setActiveRiasec([]); setActiveRisk([]);
  }
  const hasFilters = !!search.trim() || activeRiasec.length > 0 || activeRisk.length > 0;

  const filtered = useMemo(() => {
    return sectors.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
      }
      if (activeRiasec.length && !activeRiasec.some((r) => s.riasecTypes.includes(r))) return false;
      if (activeRisk.length && !activeRisk.includes(s.automationRisk)) return false;
      return true;
    });
  }, [sectors, search, activeRiasec, activeRisk]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-14 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <AnimateOnScroll>
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <Zap className="w-4 h-4" />
            {t("sectors.badge", { count: sectors.length })}
          </div>
          <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground mb-4">
            {t("sectors.title")}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {t("sectors.subtitle")}
          </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-6xl py-10">

        {/* Filters bar */}
        <div className="bg-card border rounded-2xl p-5 mb-8 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="w-4 h-4" />
            {t("sectors.filterTitle")}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("sectors.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
              {t("sectors.personalityType")}
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_RIASEC.map((r) => {
                const meta = RIASEC_LABELS[r];
                const active = activeRiasec.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() => toggleRiasec(r)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <span className="font-mono font-bold">{r}</span>
                    {meta && <span className="hidden sm:inline">— {meta.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
              {t("sectors.automationRisk")}
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_RISK.map((r) => {
                const active = activeRisk.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() => toggleRisk(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {t(`sectors.risk.${r}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t("sectors.removeFilters")}
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? t("common.loading")
              : filtered.length === sectors.length
                ? t("sectors.allSectors", { count: sectors.length })
                : t("sectors.filteredSectors", { filtered: filtered.length, total: sectors.length })}
          </p>
          {!isLoading && filtered.length === 0 && (
            <button onClick={clearAll} className="text-sm text-primary hover:underline">
              {t("sectors.removeFiltersBtn")}
            </button>
          )}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{t("sectors.noResults")}</p>
            <p className="text-sm mt-1">{t("sectors.noResultsHint")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((sector) => {
              const trendColor = TREND_COLOR[sector.trend] ?? TREND_COLOR["stable"];
              const trendLabel = t(`sectors.trend.${sector.trend}`, { defaultValue: sector.trend });
              const riskColor  = RISK_COLOR[sector.automationRisk] ?? RISK_COLOR["medium"];
              const riskLabel  = t(`sectors.risk.${sector.automationRisk}`, { defaultValue: sector.automationRisk });
              return (
                <div key={sector.id}>
                <Link href={`/settore/${sector.id}`}>
                  <div className="group h-full flex flex-col border bg-card rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer">
                    <div className="p-5 pb-4 flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/15 transition-colors">
                        <SectorIcon name={sector.icon} size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-serif font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {sector.name}
                        </h2>
                        <span className={cn("mt-1.5 inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5", trendColor)}>
                          <TrendingUp className="w-3 h-3" />
                          {trendLabel}
                        </span>
                      </div>
                    </div>

                    <p className="px-5 text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                      {sector.description}
                    </p>

                    <div className="px-5 py-4 mt-3 border-t grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <DollarSign className="w-3 h-3" /> {t("common.salary")}
                        </div>
                        <span className="font-semibold text-foreground">
                          €{sector.avgSalaryMin / 1000}k–{sector.avgSalaryMax / 1000}k
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <TrendingUp className="w-3 h-3" /> {t("common.growth")}
                        </div>
                        <span className="font-semibold text-emerald-600">+{sector.growthRate}%</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <Bot className="w-3 h-3" /> {t("common.aiRisk")}
                        </div>
                        <span className={cn("font-semibold", riskColor.split(" ")[0])}>
                          {riskLabel}
                        </span>
                      </div>
                    </div>

                    <div className="px-5 pb-4 flex items-center justify-between gap-2">
                      <div className="flex gap-1 flex-wrap">
                        {sector.riasecTypes.map((r) => (
                          <span
                            key={r}
                            title={RIASEC_LABELS[r]?.label}
                            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                          >
                            {r}
                          </span>
                        ))}
                        {sector.workMode && sector.workMode.length > 0 && (
                          <WorkModeBadge modes={sector.workMode} size="xs" />
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all shrink-0">
                        {t("sectors.discover")} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && sectors.length > 0 && (
          <div className="mt-8 flex justify-center">
            <Link href="/confronta">
              <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/5 text-primary px-5 py-3 rounded-full text-sm font-medium hover:bg-primary/10 transition-colors">
                <GitCompare className="w-4 h-4" />
                {t("sectors.compareSide")}
              </div>
            </Link>
          </div>
        )}

        {!isLoading && sectors.length > 0 && (
          <div className="mt-8 text-center rounded-3xl border border-primary/20 bg-primary/5 p-10">
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">{t("sectors.ctaTitle")}</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t("sectors.ctaDesc")}</p>
            <Link href="/test">
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors">
                {t("sectors.startFreeTest")} <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
