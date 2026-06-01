import { AnimateOnScroll } from "@/components/motion";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWorkPreference,
  WorkModeBadge,
} from "@/components/WorkModeSelector";
import { useAuth } from "@/contexts/AuthContext";
import {
  ALL_RIASEC,
  ALL_RISK,
  formatSalaryRange,
  getRiskLabel,
  normalizeText,
  PyramidCard,
  rankSectors,
  SectorEmptyState,
  useAllSectors,
  useLatestSession,
} from "@/features/sectors/sectorExplorer";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { RIASEC_LABELS, SectorIcon } from "@/lib/sector-icon";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ChevronDown,
  GitCompare,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

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

  const sectorsQuery = useAllSectors();
  const { data: latestSession } = useLatestSession(Boolean(user?.id));
  const { workPreference } = useWorkPreference(user?.id);
  const sectors = sectorsQuery.data ?? [];

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
  const hasBackendData = sectors.length > 0;
  const hasVisibleResults = ranked.length > 0;

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

        {sectorsQuery.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-56 rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-44 rounded-2xl" />
              <Skeleton className="h-44 rounded-2xl" />
            </div>
          </div>
        ) : sectorsQuery.isError ? (
          <SectorEmptyState
            icon={RefreshCw}
            title="Errore nel caricamento dei settori"
            description="Non siamo riusciti a recuperare i dati. La piramide torna appena il catalogo risponde."
            action={
              <button
                type="button"
                onClick={() => void sectorsQuery.refetch()}
                className="mt-5 rounded-full border border-primary/25 px-4 py-2 text-sm font-semibold text-primary"
              >
                Riprova
              </button>
            }
          />
        ) : !hasBackendData ? (
          <SectorEmptyState
            icon={Search}
            title="Nessun dato backend"
            description="I settori non sono ancora disponibili."
          />
        ) : !hasVisibleResults ? (
          <SectorEmptyState
            icon={Search}
            title="Nessun risultato filtrato"
            description="Prova a rimuovere un filtro o cambiare ricerca."
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded-full border border-primary/25 px-4 py-2 text-sm font-semibold text-primary"
                >
                  Rimuovi filtri
                </button>
              ) : null
            }
          />
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

        {!sectorsQuery.isLoading && hasBackendData ? (
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
