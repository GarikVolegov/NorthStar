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
import { CareerStepList, GrowthChart } from "@/features/sector/SectorCharts";
import { SectorPremiumTools } from "@/features/sector/SectorPremiumTools";
import {
  SectorCompareCta,
  SectorFreshness,
  SectorKeyMetrics,
  WorkModeAlignmentBadge,
} from "@/features/sector/SectorSummarySections";
import { SectorErrorState, SectorLoadingState } from "@/features/sector/SectorStates";
import type { ChartEntry, SectorExtended } from "@/features/sector/sectorTypes";
import { CompareDrawer } from "@/features/sector-vitals/CompareDrawer";
import { VitalSignsRow } from "@/features/sector-vitals/VitalSignsRow";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { getCareerStepGroup } from "@/lib/career-steps-utils";
import { RIASEC_LABELS, SectorIcon } from "@/lib/sector-icon";
import { buildSectorMeta, usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import {
  useGetSector,
  useGetSectorRoles,
  useGetSectorStats,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { getJson } from "@/lib/apiClient";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Laptop,
  Minus,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
  Zap
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface SectorMarket {
  hasData: boolean;
  period?: string;
  count?: number;
  growthRate?: number | null;
  avgSalaryMin?: number | null;
  avgSalaryMax?: number | null;
  topSkills?: string[];
  sources?: string[];
}

// Main page ───────────────────────────────────────────────────────────────
export default function Sector() {
  const { t } = useTranslation();
  const tr = (key: string, opts?: Record<string, unknown>) => opts ? t(key, opts) : t(key);
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();
  const { workPreference } = useWorkPreference(user?.id);
  const wendy = useWendy();
  const [compareOpen, setCompareOpen] = useState(false);

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

  const { data: market } = useQuery<SectorMarket>({
    queryKey: ["sectorMarket", id],
    queryFn: () => getJson<SectorMarket>(`${BASE}api/sectors/${id}/market`),
    enabled: !!id,
    staleTime: 60_000 * 10,
  });

  useWendyPageContext({
    page: "settore",
    title: sector?.name ?? t("sector.loadingTitle"),
    entityType: "sector",
    entityId: id || undefined,
    entityName: sector?.name,
    journeyType: user?.journeyType ?? undefined,
    sector: sector?.name,
    capabilities: ["get_sector_detail", "get_sector_roles", "search_rag"],
    fields: [
      "description",
      "riasecTypes",
      "trend",
      "workMode",
      "skills",
      "growthProjection",
      "roles",
    ],
    actions: [
      "spiega se il settore e coerente con il profilo dell'utente",
      "confronta opportunita, rischi e modalita di lavoro",
      "suggerisci ruoli e prossimi passi concreti",
    ],
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

  React.useEffect(() => {
    if (!sector || window.location.hash !== "#ruoli") return;

    document.getElementById("ruoli")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [sector?.id]);

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
    return <SectorLoadingState />;
  }

  if (sectorError || !sector) {
    return <SectorErrorState t={t} />;
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
            {workPreference && workPreference !== "unknown" && (
              <WorkModeAlignmentBadge sector={sector} workPreference={workPreference} t={t} />
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4 leading-tight">
            {sector.name}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            {sector.description}
          </p>
          <div className="mt-5">
            <Button variant="outline" onClick={() => setCompareOpen(true)}>
              <BarChart3 className="mr-2 h-4 w-4" />
              Confronta settori
            </Button>
          </div>
        </div>
      </div>
      <VitalSignsRow sectorId={id} sectorName={sector.name} className="mb-8" />
      <CompareDrawer
        open={compareOpen}
        onOpenChange={setCompareOpen}
        currentSectorId={id}
        currentSectorName={sector.name}
      />
      <SectorKeyMetrics sector={sector} t={t} />
      <SectorFreshness sector={sector} />
      <SectorCompareCta sectorId={id} sectorName={sector.name} t={t} />

      <SectorPremiumTools sectorId={id} t={t} onOpenWendy={() => wendy.open()} />

      <section id="ruoli" className="mb-12 rounded-3xl border border-primary/20 bg-primary/5 p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Prossima decisione</p>
            <h2 className="text-2xl font-serif font-bold">Scegli il ruolo target</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Il settore orienta il mercato; il ruolo decide quali competenze costruire e quali lavori cercare.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/ruoli?sectorId=${id}`}>Vedi tutti i ruoli</Link>
          </Button>
        </div>
        {isLoadingRoles ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-44 rounded-2xl" />)}
          </div>
        ) : roles && roles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.slice(0, 6).map((role) => (
              <article key={role.id} className="rounded-2xl border bg-card p-5">
                <h3 className="font-semibold text-foreground">{role.title}</h3>
                {role.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{role.description}</p>}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {role.skills?.slice(0, 3).map((skill) => (
                    <span key={skill} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{skill}</span>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <Button asChild className="rounded-full">
                    <Link href={`/ruolo/${role.id}?fromSector=${id}`} aria-label={`Scegli questo ruolo ${role.title}`}>
                      Scegli questo ruolo
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="rounded-full">
                    <Link href={`/ruolo/${role.id}`}>Approfondisci</Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Non ci sono ancora ruoli collegati a questo settore.
          </p>
        )}
      </section>

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
          {/* Domanda REALE di mercato (onesto: niente numeri inventati) */}
          <div className="mb-8 rounded-3xl border bg-card p-6 md:p-8 shadow-sm">
            <h3 className="mb-1 flex items-center gap-2 text-xl font-serif font-bold">
              <TrendingUp className="h-5 w-5 text-primary" /> Domanda reale di mercato
            </h3>
            {market?.hasData ? (
              <>
                <p className="mb-5 text-sm text-muted-foreground">
                  Dati aggregati dagli annunci di lavoro ({market.period}).
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 font-medium">
                    {market.count?.toLocaleString("it-IT")} annunci
                  </span>
                  {market.growthRate != null && (
                    <span className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5",
                      market.growthRate >= 0 ? "text-emerald-600" : "text-amber-600",
                    )}>
                      {market.growthRate >= 0 ? "+" : ""}{Math.round(market.growthRate)}% trend
                    </span>
                  )}
                  {(market.avgSalaryMin || market.avgSalaryMax) && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5">
                      💶 {market.avgSalaryMin?.toLocaleString("it-IT")}–{market.avgSalaryMax?.toLocaleString("it-IT")} €
                    </span>
                  )}
                </div>
                {market.topSkills && market.topSkills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {market.topSkills.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{s}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Stiamo aggiornando la domanda reale di questo settore dalle fonti di mercato.
                Appena disponibile la vedi qui — senza numeri inventati.
              </p>
            )}
          </div>

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
                <p className="mt-3 text-xs text-muted-foreground/70">
                  Proiezione indicativa basata sul tasso di crescita del settore — non sono dati di mercato live. La domanda reale è nel riquadro qui sopra.
                </p>
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
