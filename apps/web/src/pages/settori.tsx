import { AnimateOnScroll } from "@/components/motion";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWorkPreference,
  WorkModeBadge,
  type WorkPreference,
} from "@/components/WorkModeSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { getJson } from "@/lib/apiClient";
import { RIASEC_LABELS, SectorIcon } from "@/lib/sector-icon";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { Sector as ApiSector } from "@workspace/api-client-react";
import {
  ArrowRight,
  Award,
  BarChart3,
  ChevronDown,
  GitCompare,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";
const ALL_RIASEC = ["R", "I", "A", "S", "E", "C"];
const ALL_RISK = ["low", "medium", "high"];

type Sector = ApiSector & {
  workMode?: Array<"dipendente" | "autonomo" | "ibrido"> | null;
};

type LatestRecommendation = {
  sectorId: number;
  sectorName: string;
  matchScore: number;
  matchReason?: string;
};

type LatestSession = {
  sessionId: number;
  recommendations?: LatestRecommendation[];
  riasecScores?: Record<string, number>;
};

type RankedSector = Sector & {
  rankScore: number;
  fitScore: number;
  workModeScore: number;
  marketScore: number;
  reason: string;
};

function useAllSectors() {
  return useQuery<Sector[]>({
    queryKey: ["all-sectors"],
    queryFn: () => getJson<Sector[]>(`${BASE}api/sectors`),
    staleTime: 300_000,
  });
}

function useLatestSession(enabled: boolean) {
  return useQuery<LatestSession | null>({
    queryKey: ["test-sessions-latest-for-sectors"],
    enabled,
    queryFn: () =>
      getJson<LatestSession>(`${BASE}api/test-sessions/latest`, {
        okStatuses: [404],
      }).catch(() => null),
    staleTime: 120_000,
    retry: false,
  });
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatSalaryRange(min: number, max: number) {
  const minValue = Math.round(min / 1000);
  const maxValue = Math.round(max / 1000);

  if (!Number.isFinite(minValue) || minValue <= 0) return "Dato in verifica";
  if (!Number.isFinite(maxValue) || maxValue <= minValue) return `Da EUR ${minValue}k`;

  return `EUR ${minValue}k-${maxValue}k`;
}

function getTrendLabel(trend: string) {
  if (trend === "booming") return "Domanda molto alta";
  if (trend === "growing") return "Domanda in crescita";
  if (trend === "declining") return "Domanda in calo";
  return "Domanda stabile";
}

function getRiskLabel(risk: string) {
  if (risk === "low") return "Basso impatto";
  if (risk === "high") return "Alta esposizione";
  return "Impatto medio";
}

function computeMarketScore(sector: Sector) {
  const trendScore =
    sector.trend === "booming"
      ? 100
      : sector.trend === "growing"
        ? 78
        : sector.trend === "stable"
          ? 55
          : 28;
  const riskScore =
    sector.automationRisk === "low" ? 100 : sector.automationRisk === "medium" ? 62 : 34;
  const salaryMid = (sector.avgSalaryMin + sector.avgSalaryMax) / 2;
  const salaryScore = Math.max(20, Math.min(100, Math.round(salaryMid / 900)));

  return Math.round(trendScore * 0.45 + salaryScore * 0.3 + riskScore * 0.25);
}

function computeRiasecFit(sector: Sector, riasecScores?: Record<string, number>) {
  if (!riasecScores || !sector.riasecTypes.length) return 0;

  const maxScore = Math.max(...Object.values(riasecScores), 0);
  if (maxScore <= 0) return 0;

  const sectorScore =
    sector.riasecTypes.reduce((sum, type) => {
      const letter = type.charAt(0).toUpperCase();
      return sum + (riasecScores[letter] ?? 0);
    }, 0) / sector.riasecTypes.length;

  return Math.round((sectorScore / maxScore) * 100);
}

function computeWorkModeScore(
  sector: Sector,
  workPreference: WorkPreference | "unknown",
) {
  if (!workPreference || workPreference === "unknown") return 50;
  if (!sector.workMode?.length) return 50;
  if (sector.workMode.includes(workPreference)) return 100;
  if (workPreference === "autonomo" && sector.workMode.includes("ibrido")) return 72;
  if (workPreference === "dipendente" && sector.workMode.includes("ibrido")) return 72;
  return 32;
}

function buildReason(
  sector: Sector,
  fitScore: number,
  marketScore: number,
  recommendation?: LatestRecommendation,
) {
  if (recommendation?.matchReason) return recommendation.matchReason;
  if (fitScore >= 75) return "Forte coerenza con il tuo profilo e i tuoi interessi.";
  if (marketScore >= 75) return "Segnali di mercato solidi e buona sostenibilita del percorso.";
  if (sector.workMode?.length) return "Buona area da esplorare per modalita e competenze richieste.";
  return "Area ordinata per segnali generali di mercato.";
}

function rankSectors(
  sectors: Sector[],
  latestSession: LatestSession | null | undefined,
  workPreference: WorkPreference | "unknown",
) {
  const recommendations = new Map(
    (latestSession?.recommendations ?? []).map((rec) => [rec.sectorId, rec]),
  );

  return sectors
    .map((sector) => {
      const recommendation = recommendations.get(sector.id);
      const fitScore =
        recommendation?.matchScore ?? computeRiasecFit(sector, latestSession?.riasecScores);
      const workModeScore = computeWorkModeScore(sector, workPreference);
      const marketScore = computeMarketScore(sector);
      const rankScore = Math.round(fitScore * 0.6 + workModeScore * 0.2 + marketScore * 0.2);

      return {
        ...sector,
        rankScore,
        fitScore,
        workModeScore,
        marketScore,
        reason: buildReason(sector, fitScore, marketScore, recommendation),
      };
    })
    .sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      return computeMarketScore(b) - computeMarketScore(a);
    });
}

function PyramidCard({
  sector,
  rank,
  variant,
}: {
  sector: RankedSector;
  rank: number;
  variant: "apex" | "middle" | "base";
}) {
  const isApex = variant === "apex";
  const isMiddle = variant === "middle";

  return (
    <Link
      href={`/settore/${sector.id}`}
      className={cn("block", variant === "base" && "shrink-0")}
    >
      <article
        className={cn(
          "group relative h-full overflow-hidden border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-md",
          isApex
            ? "rounded-2xl border-primary/35 bg-linear-to-br from-card via-card to-primary/10 p-5 shadow-lg shadow-primary/10 md:p-6"
            : isMiddle
              ? "rounded-2xl border-primary/20 p-4 md:p-5"
              : "min-h-64 w-52 rounded-xl border-border p-4 md:w-60",
        )}
      >
        <div
          className={cn(
            "absolute inset-x-0 top-0 bg-linear-to-r from-primary/20 via-primary to-primary/20",
            isApex ? "h-1" : "h-0.5",
          )}
        />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center border border-primary/25 bg-primary/10 text-primary",
                isApex
                  ? "h-14 w-14 rounded-2xl"
                  : isMiddle
                    ? "h-11 w-11 rounded-xl"
                    : "h-10 w-10 rounded-xl",
              )}
            >
              <SectorIcon name={sector.icon} size={isApex ? 24 : isMiddle ? 20 : 18} />
            </div>
            {isApex ? (
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Award className="h-3 w-3" />
                  Area guida
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Il settore piu coerente con i segnali attivi.
                </p>
              </div>
            ) : null}
            {isMiddle ? (
              <div className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                Alternative forti
              </div>
            ) : null}
          </div>
          <span className="font-bold tabular-nums text-foreground/30">#{rank}</span>
        </div>

        <div className={cn(isApex ? "mt-6" : "mt-5")}>
          <h2
            className={cn(
              "font-bold leading-tight text-foreground transition-colors group-hover:text-primary",
              isApex ? "text-xl md:text-2xl" : isMiddle ? "text-base" : "line-clamp-2 text-sm",
            )}
          >
            {sector.name}
          </h2>
          <p
            className={cn(
              "mt-2 leading-relaxed text-muted-foreground",
              isApex ? "line-clamp-2 text-sm" : "line-clamp-2 text-xs",
            )}
          >
            {sector.description}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
            <BarChart3 className="h-3 w-3" />
            {getTrendLabel(sector.trend)}
          </span>
        </div>

        <div
          className={cn(
            "mt-5 border-t border-border/60",
            isApex ? "grid grid-cols-1 gap-3 pt-4 sm:grid-cols-3" : "space-y-3 pt-4",
          )}
        >
          <EvidenceItem
            icon={Target}
            label="Perche e in alto"
            value={sector.reason}
            large={isApex}
          />
          <EvidenceItem
            icon={UsersRound}
            label="Compenso indicativo"
            value={formatSalaryRange(sector.avgSalaryMin, sector.avgSalaryMax)}
            large={isApex}
          />
          <EvidenceItem
            icon={ShieldCheck}
            label="Impatto AI"
            value={getRiskLabel(sector.automationRisk)}
            large={isApex}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {sector.riasecTypes.slice(0, 3).map((type) => (
              <span
                key={type}
                className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold text-secondary-foreground"
              >
                {type}
              </span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Apri <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </article>
    </Link>
  );
}

function EvidenceItem({
  icon: Icon,
  label,
  value,
  large,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  large: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2", large && "rounded-lg border border-border/60 bg-background/35 p-3")}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("line-clamp-2 font-bold text-foreground", large ? "text-sm" : "text-xs")}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function Settori() {
  const { t } = useTranslation();
  const { user } = useAuth();

  usePageMeta({
    title: t("seo.sectors.title"),
    description: t("seo.sectors.description"),
    path: "/settori",
  });
  useWendyPageContext({
    page: "settori",
    title: "Settori",
    capabilities: ["navigate", "set_filters"],
    fields: ["search", "riasecTypes", "automationRisk"],
    actions: ["Filtra settori", "Apri settore", "Confronta opportunita"],
  });

  const { data: sectors = [], isLoading } = useAllSectors();
  const { data: latestSession } = useLatestSession(Boolean(user?.id));
  const { workPreference } = useWorkPreference(user?.id);

  const [search, setSearch] = useState("");
  const [activeRiasec, setActiveRiasec] = useState<string[]>([]);
  const [activeRisk, setActiveRisk] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keyword = params.get("keyword") ?? params.get("query") ?? params.get("q") ?? "";
    const riasec = params.get("riasecTypes") ?? params.get("riasec") ?? "";
    const risk = params.get("automationRisk") ?? params.get("risk") ?? "";
    if (keyword) setSearch(keyword);
    if (riasec) {
      setActiveRiasec(
        riasec
          .split(",")
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean),
      );
    }
    if (risk) {
      setActiveRisk(
        risk
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
      );
    }
  }, []);

  const hasFilters = !!search.trim() || activeRiasec.length > 0 || activeRisk.length > 0;
  const hasProfile = Boolean(latestSession?.recommendations?.length || latestSession?.riasecScores);

  function toggleRiasec(type: string) {
    setActiveRiasec((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  }

  function toggleRisk(risk: string) {
    setActiveRisk((prev) =>
      prev.includes(risk) ? prev.filter((item) => item !== risk) : [...prev, risk],
    );
  }

  function clearAll() {
    setSearch("");
    setActiveRiasec([]);
    setActiveRisk([]);
  }

  const filtered = useMemo(() => {
    const query = normalizeText(search.trim());
    return sectors.filter((sector) => {
      if (query) {
        const haystack = normalizeText(`${sector.name} ${sector.description}`);
        if (!haystack.includes(query)) return false;
      }
      if (
        activeRiasec.length &&
        !activeRiasec.some((type) => sector.riasecTypes.includes(type))
      ) {
        return false;
      }
      if (activeRisk.length && !activeRisk.includes(sector.automationRisk)) return false;
      return true;
    });
  }, [sectors, search, activeRiasec, activeRisk]);

  const ranked = useMemo(
    () => rankSectors(filtered, latestSession, workPreference),
    [filtered, latestSession, workPreference],
  );
  const pyramid = ranked.slice(0, 8);
  const [apexSector, ...rest] = pyramid;
  const middleSectors = rest.slice(0, 2);
  const baseSectors = rest.slice(2);

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-background py-12 md:py-16">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <AnimateOnScroll>
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Esplora con criterio
              </div>
              <h1 className="text-3xl font-bold leading-tight text-foreground md:text-5xl">
                Scegli i settori da una piramide, non da una lista infinita.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                La classifica si adatta ai tuoi filtri, al test e alla modalita di lavoro che preferisci.
                Senza profilo, parte dai segnali generali di mercato.
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <main className="container mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <section className="mb-8 rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("sectors.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 rounded-full border-border bg-background pl-9"
              />
            </div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
              aria-expanded={advancedOpen}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtri
              <ChevronDown className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {ALL_RIASEC.map((type) => {
              const active = activeRiasec.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleRiasec(type)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground",
                  )}
                >
                  <span className="font-mono font-bold">{type}</span>
                  <span className="hidden sm:inline">{RIASEC_LABELS[type]?.label}</span>
                </button>
              );
            })}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive/35 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
                Rimuovi filtri
              </button>
            ) : null}
          </div>

          <div
            data-testid="advanced-sector-filters"
            hidden={!advancedOpen}
            className="mt-4 border-t border-border pt-4"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rischio automazione
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_RISK.map((risk) => {
                const active = activeRisk.includes(risk);
                return (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => toggleRisk(risk)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground",
                    )}
                  >
                    {getRiskLabel(risk)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          </div>
        ) : ranked.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
            <Search className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-semibold text-foreground">Nessun settore trovato</p>
            <p className="mt-1 text-sm">Prova a rimuovere un filtro o cambiare ricerca.</p>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="mt-5 rounded-full border border-primary/25 px-4 py-2 text-sm font-semibold text-primary"
              >
                Rimuovi filtri
              </button>
            ) : null}
          </section>
        ) : (
          <>
            <section
              data-testid="sector-pyramid"
              className="rounded-3xl border border-border bg-card/70 p-4 md:p-6"
            >
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {hasProfile ? "Piramide personale" : "Piramide mercato"}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">
                    I settori ordinati per decisione
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {hasProfile
                      ? "La posizione nasce da fit personale, preferenza lavoro e segnali mercato."
                      : "Classifica generale basata sui segnali disponibili. Il test la rende personale."}
                  </p>
                </div>
                {!hasProfile ? (
                  <Link href="/test">
                    <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                      Fai il test per personalizzarla
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ) : null}
              </div>

              {apexSector ? (
                <div data-testid="sector-pyramid-apex" className="mx-auto max-w-2xl">
                  <PyramidCard sector={apexSector} rank={1} variant="apex" />
                </div>
              ) : null}

              {middleSectors.length ? (
                <div className="mx-auto mt-4 grid max-w-4xl gap-4 sm:grid-cols-2">
                  {middleSectors.map((sector, index) => (
                    <PyramidCard
                      key={sector.id}
                      sector={sector}
                      rank={index + 2}
                      variant="middle"
                    />
                  ))}
                </div>
              ) : null}

              {baseSectors.length ? (
                <div className="mt-4 flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {baseSectors.map((sector, index) => (
                    <PyramidCard
                      key={sector.id}
                      sector={sector}
                      rank={index + 4}
                      variant="base"
                    />
                  ))}
                </div>
              ) : null}
            </section>

            <section className="mt-8">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Catalogo compatto
                  </p>
                  <h2 className="text-xl font-bold text-foreground">
                    Tutti i risultati filtrati
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {ranked.length} di {sectors.length} settori
                </p>
              </div>

              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {ranked.map((sector, index) => (
                  <Link key={sector.id} href={`/settore/${sector.id}`}>
                    <div className="grid gap-4 p-4 transition-colors hover:bg-primary/5 md:grid-cols-[auto_1fr_auto] md:items-center">
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-sm font-bold tabular-nums text-muted-foreground">
                          #{index + 1}
                        </span>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                          <SectorIcon name={sector.icon} size={18} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground">{sector.name}</h3>
                        <p className="line-clamp-1 text-sm text-muted-foreground">
                          {sector.reason}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:justify-end">
                        <span className="font-semibold text-foreground">
                          {formatSalaryRange(sector.avgSalaryMin, sector.avgSalaryMax)}
                        </span>
                        <span>{getRiskLabel(sector.automationRisk)}</span>
                        <WorkModeBadge modes={sector.workMode} size="xs" />
                        <ArrowRight className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {!isLoading && sectors.length > 0 ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/confronta">
              <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10">
                <GitCompare className="h-4 w-4" />
                Confronta settori
              </div>
            </Link>
            <Link href="/test">
              <div className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                Inizia il test gratuito <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}
