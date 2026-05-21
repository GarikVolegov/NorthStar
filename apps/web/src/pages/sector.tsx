import { SectorFreshnessBadge } from "@/components/sector/SectorFreshnessBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  WorkModeBadge,
  useWorkPreference,
} from "@/components/WorkModeSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useWendy } from "@/contexts/WendyProvider";
import { getCareerStepGroup } from "@/lib/career-steps-utils";
import { RIASEC_LABELS, SectorIcon } from "@/lib/sector-icon";
import { buildSectorMeta, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getWorkModeAlignment } from "@/lib/work-mode-utils";
import {
  useGetSector,
  useGetSectorRoles,
  useGetSectorStats,
  type Sector as SectorBase,
} from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Brain,
  Briefcase,
  Clock,
  DollarSign,
  GitCompare,
  Laptop,
  MapPin,
  MessageSquare,
  Minus,
  Network,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Zap
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, useParams } from "wouter";

// ── Memoised chart component ────────────────────────────────────────────────
// Wrapped in React.memo so switching tabs or triggering parent re-renders
// (e.g. i18n language change) does NOT remount/recalculate the Recharts tree.
interface ChartEntry {
  name: string;
  value: number;
  color: string;
}

const GrowthChart = React.memo(function GrowthChart({
  data,
}: {
  data: ChartEntry[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="hsl(var(--border))"
        />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          dy={10}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickFormatter={(v) => `+${v}%`}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid hsl(var(--border))",
            boxShadow: "var(--shadow-md)",
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

// ── Memoised career-step list ───────────────────────────────────────────────
// Switching dipendente <-> autonomo only re-renders the active list,
// not the entire Sector component tree.
interface CareerStep {
  step: number;
  title: string;
  description: string;
}

type SectorExtended = SectorBase & {
  workMode?: Array<"dipendente" | "autonomo" | "ibrido">;
  dipendentiSteps?: CareerStep[];
  freelanceSteps?: CareerStep[];
};
interface CareerStepListProps {
  steps: CareerStep[];
  stepGroup: string;
  pathKey: "dipendente" | "freelance";
  activeColor: "blue" | "violet";
  t: (key: string, opts?: Record<string, unknown>) => string;
}

const CareerStepList = React.memo(function CareerStepList({
  steps,
  stepGroup,
  pathKey,
  activeColor,
  t,
}: CareerStepListProps) {
  const ring =
    activeColor === "blue"
      ? "bg-blue-100 border-blue-300 text-blue-700"
      : "bg-violet-100 border-violet-300 text-violet-700";
  const line = activeColor === "blue" ? "bg-blue-100" : "bg-violet-100";

  return (
    <div className="space-y-0">
      {steps.map((s, i) => (
        <div key={s.step} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 font-bold text-sm",
                ring,
              )}
            >
              {s.step}
            </div>
            {i < steps.length - 1 && (
              <div className={cn("w-0.5 h-full mt-1", line)} />
            )}
          </div>
          <div className="pb-8">
            <h4 className="font-semibold text-foreground mb-1">
              {t(`careerSteps.${pathKey}.${stepGroup}.${s.step}.title`, {
                defaultValue: s.title,
              })}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(`careerSteps.${pathKey}.${stepGroup}.${s.step}.desc`, {
                defaultValue: s.description,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});

// ── Main page ───────────────────────────────────────────────────────────────
export default function Sector() {
  const { t } = useTranslation();
  const tr = (key: string, opts?: Record<string, unknown>) => opts ? t(key, opts) : t(key);
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();
  const { workPreference } = useWorkPreference(user?.id);
  const wendy = useWendy();

  const [stepsView, setStepsView] = useState<"dipendente" | "autonomo">(
    workPreference === "autonomo" ? "autonomo" : "dipendente",
  );

  // Stabilised effect: only update when workPreference actually differs from
  // the current view — avoids double-render on mount when both share the same
  // initial value.
  React.useEffect(() => {
    if (workPreference === "autonomo" && stepsView !== "autonomo") {
      setStepsView("autonomo");
    } else if (workPreference === "dipendente" && stepsView !== "dipendente") {
      setStepsView("dipendente");
    }
  }, [workPreference]);

  const {
    data: _sector,
    isLoading: isLoadingSector,
    error: sectorError,
  } = useGetSector(id, {
    query: { enabled: !!id, queryKey: ["sector", id] },
  });
  const sector = _sector as SectorExtended | undefined;

  const { data: stats, isLoading: isLoadingStats } = useGetSectorStats(id, {
    query: { enabled: !!id, queryKey: ["sectorStats", id] },
  });

  const { data: roles, isLoading: isLoadingRoles } = useGetSectorRoles(id, {
    query: { enabled: !!id, queryKey: ["sectorRoles", id] },
  });

  usePageMeta(
    sector
      ? buildSectorMeta(sector as Parameters<typeof buildSectorMeta>[0])
      : {
          title: t("sector.loadingTitle"),
          description: t("sector.loadingDesc"),
          noIndex: true,
        },
  );

  // Memoised: recomputed only when stats change or t() reference changes (lang switch).
  const chartData = useMemo<ChartEntry[]>(() => {
    if (!stats?.growthProjection) return [];
    return [
      {
        name: t("sector.shortTerm"),
        value: parseInt(stats.growthProjection.shortTerm ?? "0"),
        color: "hsl(var(--chart-1))",
      },
      {
        name: t("sector.midTerm"),
        value: parseInt(stats.growthProjection.midTerm ?? "0"),
        color: "hsl(var(--chart-2))",
      },
      {
        name: t("sector.longTerm"),
        value: parseInt(stats.growthProjection.longTerm ?? "0"),
        color: "hsl(var(--chart-3))",
      },
    ];
  }, [stats, t]);

  // Memoised: getCareerStepGroup is pure but called twice in the original code.
  // Now computed once and shared by both path views.
  const stepGroup = useMemo(
    () => (sector ? getCareerStepGroup(sector.name) : ""),
    [sector],
  );

  if (isLoadingSector) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Skeleton className="h-8 w-24 mb-8" />
        <div className="flex gap-6 mb-12">
          <Skeleton className="h-24 w-24 rounded-2xl" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (sectorError || !sector) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold mb-4">{t("sector.notFound")}</h2>
        <Button asChild variant="outline">
          <Link href="/">{t("sector.goHome")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 max-w-5xl">
      <Button asChild variant="ghost" size="sm" className="mb-8 rounded-full">
        <button onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("sector.backToResults")}
        </button>
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start mb-12">
        <div className="w-24 h-24 md:w-32 md:h-32 bg-primary/10 rounded-3xl flex items-center justify-center shrink-0 shadow-inner text-primary">
          <SectorIcon name={sector.icon} size={52} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-4">
            {sector.riasecTypes.map((type) => {
              const meta = RIASEC_LABELS[type];
              return (
                <span
                  key={type}
                  title={meta?.desc}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 text-secondary-foreground text-sm font-medium"
                >
                  <span className="font-mono font-bold">{type}</span>
                  {meta && (
                    <span className="text-muted-foreground">
                      — {meta.label}
                    </span>
                  )}
                </span>
              );
            })}
            <Badge
              variant="outline"
              className="border-emerald-200 text-emerald-700 bg-emerald-50"
            >
              <TrendingUp className="w-3 h-3 mr-1" />{" "}
              {t(`sector.trendValues.${sector.trend}`, {
                defaultValue: sector.trend,
              })}
            </Badge>
            {sector.workMode && sector.workMode.length > 0 && (
              <WorkModeBadge modes={sector.workMode} size="sm" />
            )}
            {workPreference &&
              workPreference !== "unknown" &&
              (() => {
                const alignment = getWorkModeAlignment(
                  workPreference,
                  sector.workMode,
                );
                if (!alignment.tooltipKey) return null;
                const title = alignment.tooltipModes
                  ? t(alignment.tooltipKey, {
                      modes: alignment.tooltipModes
                        .map((m) => t(`workMode.${m}`, { defaultValue: m }))
                        .join("/"),
                    })
                  : t(alignment.tooltipKey);
                return (
                  <div
                    title={title}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                      alignment.type === "aligned"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : alignment.type === "partial"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200",
                    )}
                  >
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          alignment.type === "aligned"
                            ? "hsl(var(--chart-2))"
                            : alignment.type === "partial"
                              ? "hsl(var(--chart-1))"
                              : "hsl(var(--chart-5))",
                      }}
                    />
                    {alignment.type === "aligned"
                      ? t("sector.alignment.aligned")
                      : alignment.type === "partial"
                        ? t("sector.alignment.partial")
                        : t("sector.alignment.misaligned")}
                  </div>
                );
              })()}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4 leading-tight">
            {sector.name}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            {sector.description}
          </p>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16">
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <DollarSign className="w-4 h-4 mr-1.5" /> {t("sector.annualSalary")}
          </div>
          <div className="text-xl md:text-2xl font-semibold">
            €{sector.avgSalaryMin / 1000}k - {sector.avgSalaryMax / 1000}k
          </div>
          <div className="text-xs text-muted-foreground/60 mt-1">
            {t("sector.italianMarketNote")}
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 mr-1.5" /> {t("sector.growth")}
          </div>
          <div className="text-xl md:text-2xl font-semibold text-emerald-600">
            {t("sector.annualGrowth", { rate: sector.growthRate })}
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <Clock className="w-4 h-4 mr-1.5" /> {t("sector.trainingTime")}
          </div>
          <div className="text-xl md:text-2xl font-semibold capitalize">
            {t("sector.timeToAutonomyValue", {
              defaultValue: sector.timeToAutonomy,
            })}
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <Bot className="w-4 h-4 mr-1.5" /> {t("sector.automationRisk")}
          </div>
          <div className="text-xl md:text-2xl font-semibold capitalize">
            {t(`sectors.risk.${sector.automationRisk}`, {
              defaultValue: sector.automationRisk,
            })}
          </div>
        </div>
      </div>

      {/* Data Freshness */}
      {sector && (
        <div className="flex justify-end mb-4">
          <SectorFreshnessBadge
            {...(((sector as unknown as Record<string, unknown>).updatedAt as string | undefined)
              ? { updatedAt: (sector as unknown as Record<string, unknown>).updatedAt as string }
              : {})}
          />
        </div>
      )}

      {/* Compare CTA */}
      <div className="mb-8 flex items-center justify-between gap-4 p-4 rounded-2xl border border-dashed border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <GitCompare className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("sector.compareNotSure")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("sector.compareDesc", { name: sector.name })}
            </p>
          </div>
        </div>
        <Link href={`/confronta?a=${id}`}>
          <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            {t("sector.compare")} <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Premium Feature Cards */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-5">
          <Badge
            variant="outline"
            className="border-primary/20 text-primary bg-primary/5 text-xs"
          >
            <Sparkles className="w-3 h-3 mr-1" /> {t("sector.premiumTools")}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {t("sector.deepenWithAI")}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={() => wendy.open()}
            className="block w-full text-left"
          >
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
                <Brain className="w-5 h-5 text-indigo-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">
                {t("sector.wikiAI")}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {t("sector.wikiDesc")}
              </p>
              <div className="flex items-center text-indigo-600 text-xs font-medium">
                {t("sector.openChat")}{" "}
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </button>

          <Link href={`/roadmap/${id}`} className="block">
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">
                {t("sector.roadmap")}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {t("sector.roadmapDesc")}
              </p>
              <div className="flex items-center text-emerald-600 text-xs font-medium">
                {t("sector.generatePlan")}{" "}
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>

          <Link href={`/grafo/${id}`} className="block">
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4 group-hover:bg-violet-100 transition-colors">
                <Network className="w-5 h-5 text-violet-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">
                {t("sector.knowledgeGraph")}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {t("sector.graphDesc")}
              </p>
              <div className="flex items-center text-violet-600 text-xs font-medium">
                {t("sector.exploreGraph")}{" "}
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>

          <button
            onClick={() => wendy.open()}
            className="block w-full text-left"
          >
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                <MessageSquare className="w-5 h-5 text-orange-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">
                Simulatore Colloquio
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Preparati al colloquio con AI nel tuo settore
              </p>
              <div className="flex items-center text-orange-600 text-xs font-medium">
                Inizia colloquio{" "}
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </button>

          <Link href={`/skills-gap/${id}`} className="block">
            <div className="h-full p-5 bg-card border rounded-2xl hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 group-hover:bg-rose-100 transition-colors">
                <Target className="w-5 h-5 text-rose-600" />
              </div>
              <h4 className="font-semibold mb-1.5 text-sm">
                Skills Gap Analysis
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Scopri cosa ti manca per entrare nel settore
              </p>
              <div className="flex items-center text-rose-600 text-xs font-medium">
                Analizza gap{" "}
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Deep Dive Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex justify-start border-b rounded-none h-auto bg-transparent p-0 mb-8 space-x-6 overflow-x-auto">
          {(["overview", "percorso", "skills", "data", "roles"] as const).map(
            (v) => (
              <TabsTrigger
                key={v}
                value={v}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 text-base"
              >
                {v === "roles" ? (
                  <>
                    {t("role.rolesTab")}
                    {roles && roles.length > 0 && (
                      <span className="ml-1.5 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        {roles.length}
                      </span>
                    )}
                  </>
                ) : (
                  t(
                    `sector.tabs.${v === "percorso" ? "career" : v === "data" ? "data" : v}`,
                  )
                )}
              </TabsTrigger>
            ),
          )}
        </TabsList>

        {/* Overview */}
        <TabsContent
          value="overview"
          className="space-y-10 animate-in fade-in duration-500"
        >
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-xl font-serif font-bold flex items-center">
                <Plus className="w-5 h-5 mr-2 text-emerald-500" />{" "}
                {t("sector.advantages")}
              </h3>
              <ul className="space-y-4">
                {sector.advantages.map((adv, i) => (
                  <li key={i} className="flex items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 mr-3 shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">
                      {adv}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-6">
              <h3 className="text-xl font-serif font-bold flex items-center">
                <Minus className="w-5 h-5 mr-2 text-amber-500" />{" "}
                {t("sector.disadvantages")}
              </h3>
              <ul className="space-y-4">
                {sector.disadvantages.map((dis, i) => (
                  <li key={i} className="flex items-start">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 mr-3 shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">
                      {dis}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10">
            <h3 className="text-xl font-serif font-bold flex items-center mb-6">
              <Sparkles className="w-5 h-5 mr-2 text-primary" />{" "}
              {t("sector.opportunities")}
            </h3>
            <ul className="grid md:grid-cols-2 gap-6">
              {sector.opportunities.map((opp, i) => (
                <li key={i} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-background border shadow-sm flex items-center justify-center shrink-0 font-mono text-xs font-bold text-primary">
                    {i + 1}
                  </div>
                  <span className="text-muted-foreground leading-relaxed">
                    {opp}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        {/* Career path */}
        <TabsContent
          value="percorso"
          className="animate-in fade-in duration-500"
        >
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h3 className="text-2xl font-serif font-bold">
                {t("sector.careerPath")}
              </h3>
              <div className="flex items-center gap-2 bg-muted rounded-xl p-1">
                <button
                  onClick={() => setStepsView("dipendente")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    stepsView === "dipendente"
                      ? "bg-background shadow-sm text-blue-700 border border-blue-200"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Briefcase className="w-4 h-4" /> {t("sector.employed")}
                </button>
                <button
                  onClick={() => setStepsView("autonomo")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    stepsView === "autonomo"
                      ? "bg-background shadow-sm text-violet-700 border border-violet-200"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Laptop className="w-4 h-4" /> {t("sector.freelance")}
                </button>
              </div>
            </div>

            {stepsView === "dipendente" ? (
              <div>
                <p className="text-muted-foreground mb-8 text-base">
                  <span>{t("sector.employedDesc", { name: sector.name })}</span>
                </p>
                {!sector.dipendentiSteps ||
                sector.dipendentiSteps.length === 0 ? (
                  <p className="text-muted-foreground italic">
                    {t("sector.noEmployedPath")}
                  </p>
                ) : (
                  <CareerStepList
                    steps={sector.dipendentiSteps}
                    stepGroup={stepGroup}
                    pathKey="dipendente"
                    activeColor="blue"
                    t={tr}
                  />
                )}
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground mb-8 text-base">
                  <span>
                    {t("sector.freelanceDesc", { name: sector.name })}
                  </span>
                </p>
                {!sector.freelanceSteps ||
                sector.freelanceSteps.length === 0 ? (
                  <p className="text-muted-foreground italic">
                    {t("sector.noFreelancePath")}
                  </p>
                ) : (
                  <CareerStepList
                    steps={sector.freelanceSteps}
                    stepGroup={stepGroup}
                    pathKey="freelance"
                    activeColor="violet"
                    t={tr}
                  />
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Skills */}
        <TabsContent value="skills" className="animate-in fade-in duration-500">
          <div className="max-w-3xl">
            <h3 className="text-2xl font-serif font-bold mb-6 flex items-center">
              <Target className="w-6 h-6 mr-3 text-primary" />{" "}
              {t("sector.keySkills")}
            </h3>
            <p className="text-muted-foreground mb-8 text-lg">
              {t("sector.skillsDesc", { time: sector.timeToAutonomy })}
            </p>
            <div className="flex flex-wrap gap-3">
              {sector.skills.map((skill, i) => (
                <div
                  key={i}
                  className="px-5 py-3 bg-card border rounded-xl shadow-sm text-foreground font-medium flex items-center"
                >
                  <Zap className="w-4 h-4 mr-2 text-amber-500 opacity-70" />{" "}
                  {skill}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Data / chart */}
        <TabsContent value="data" className="animate-in fade-in duration-500">
          {isLoadingStats ? (
            <Skeleton className="h-[400px] w-full rounded-3xl" />
          ) : stats ? (
            <div className="grid md:grid-cols-5 gap-8">
              <div className="md:col-span-3 bg-card border rounded-3xl p-6 md:p-8 shadow-sm">
                <h3 className="text-xl font-serif font-bold mb-8">
                  {t("sector.growthProjection")}
                </h3>
                <div className="h-[300px] w-full">
                  {/* GrowthChart is memo'd: won't re-render unless chartData reference changes */}
                  <GrowthChart data={chartData} />
                </div>
              </div>
              <div className="md:col-span-2 space-y-6">
                <div className="bg-card border rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
                    {t("sector.platformStats")}
                  </h4>
                  <div className="space-y-6">
                    <div>
                      <div className="text-3xl font-serif font-bold text-foreground mb-1">
                        {stats.timesPicked}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("sector.platformStatsUsers")}
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <div className="text-3xl font-serif font-bold text-foreground mb-1">
                        {stats.avgMatchScore}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("sector.platformStatsMatch")}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-md">
                  <h4 className="font-serif font-bold text-lg mb-2">
                    {t("sector.readyTitle")}
                  </h4>
                  <p className="text-primary-foreground/80 text-sm mb-6">
                    {t("sector.readyDesc")}
                  </p>
                  <Button variant="secondary" className="w-full" asChild>
                    <button onClick={() => window.history.back()}>
                      {t("sector.backAndConfirm")}
                    </button>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{t("sector.noStats")}</p>
          )}
          {stats && (
            <p className="text-xs text-muted-foreground/60 mt-6 leading-relaxed">
              {t("sector.dataSourceNote")}
            </p>
          )}
        </TabsContent>

        {/* Roles */}
        <TabsContent value="roles" className="animate-in fade-in duration-500">
          {isLoadingRoles ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          ) : roles && roles.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => (
                <Link
                  key={role.id}
                  href={`/ruolo/${role.id}`}
                  className="block group"
                >
                  <div className="h-full bg-card border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all">
                    <h4 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {role.title}
                    </h4>
                    {role.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                        {role.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {role.skills?.slice(0, 3).map((skill, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-secondary/60 text-secondary-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                      {role.skills && role.skills.length > 3 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          +{role.skills.length - 3}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium">{role.salaryRange}</span>
                      <span className="text-emerald-600 font-medium">
                        {role.growthOutlook}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {t("role.viewRole")}{" "}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              {t("role.noRoles")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
