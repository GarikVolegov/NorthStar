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

const BASE = import.meta.env.BASE_URL || "/";

type Sector = ApiSector;

const TREND_META: Record<string, { label: string; color: string }> = {
  booming:  { label: "In forte crescita", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  growing:  { label: "In crescita",        color: "text-blue-700 bg-blue-50 border-blue-200" },
  stable:   { label: "Stabile",            color: "text-slate-600 bg-slate-50 border-slate-200" },
  declining:{ label: "In calo",            color: "text-rose-700 bg-rose-50 border-rose-200" },
};

const RISK_META: Record<string, { label: string; color: string }> = {
  low:    { label: "Basso",   color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  medium: { label: "Medio",   color: "text-amber-700 bg-amber-50 border-amber-200" },
  high:   { label: "Alto",    color: "text-rose-700 bg-rose-50 border-rose-200" },
};

function useAllSectors() {
  return useQuery<Sector[]>({
    queryKey: ["all-sectors"],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/sectors`);
      if (!res.ok) throw new Error("Errore caricamento settori");
      return res.json();
    },
    staleTime: 300_000,
  });
}

const ALL_RIASEC = ["R", "I", "A", "S", "E", "C"];
const ALL_RISK   = ["low", "medium", "high"];

export default function Settori() {
  usePageMeta({
    title: "Esplora i 21 settori professionali",
    description: "Sfoglia tutti i settori professionali italiani. Filtra per tipo RIASEC, rischio automazione AI e trend di mercato. Trova dove il tuo talento incontra un'opportunità reale.",
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
            {sectors.length} settori professionali
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Esplora i settori
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Non sai ancora cosa fare? Sfoglia tutti i settori, filtra in base al tuo stile e scopri dove potresti trovarti bene.
          </p>
          </AnimateOnScroll>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-6xl py-10">

        {/* Filters bar */}
        <div className="bg-card border rounded-2xl p-5 mb-8 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="w-4 h-4" />
            Filtra i settori
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome o descrizione…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* RIASEC filter */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
              Tipo di personalità
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
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    <span className="font-mono font-bold">{r}</span>
                    {meta && <span className="hidden sm:inline">— {meta.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Risk filter */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
              Rischio automazione (sostituzione da parte dell'AI)
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_RISK.map((r) => {
                const meta = RISK_META[r];
                const active = activeRisk.includes(r);
                return (
                  <button
                    key={r}
                    onClick={() => toggleRisk(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {meta?.label ?? r}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Rimuovi tutti i filtri
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Caricamento…"
              : filtered.length === sectors.length
                ? `${sectors.length} settori`
                : `${filtered.length} di ${sectors.length} settori`}
          </p>
          {!isLoading && filtered.length === 0 && (
            <button onClick={clearAll} className="text-sm text-primary hover:underline">
              Rimuovi filtri
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
            <p className="font-medium">Nessun settore trovato</p>
            <p className="text-sm mt-1">Prova a modificare i filtri o la ricerca</p>
          </div>
        ) : (
          <AnimateOnScroll stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((sector) => {
              const trend   = TREND_META[sector.trend] ?? TREND_META["stable"];
              const risk    = RISK_META[sector.automationRisk] ?? RISK_META["medium"];
              return (
                <AnimateOnScrollItem key={sector.id}>
                <Link href={`/settore/${sector.id}`}>
                  <div className="group h-full flex flex-col border bg-card rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer">

                    {/* Card header */}
                    <div className="p-5 pb-4 flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/15 transition-colors">
                        <SectorIcon name={sector.icon} size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-serif font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {sector.name}
                        </h2>
                        <span className={cn("mt-1.5 inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2 py-0.5", trend.color)}>
                          <TrendingUp className="w-3 h-3" />
                          {trend.label}
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="px-5 text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                      {sector.description}
                    </p>

                    {/* Metrics row */}
                    <div className="px-5 py-4 mt-3 border-t grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <DollarSign className="w-3 h-3" /> Stipendio
                        </div>
                        <span className="font-semibold text-foreground">
                          €{sector.avgSalaryMin / 1000}k–{sector.avgSalaryMax / 1000}k
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <TrendingUp className="w-3 h-3" /> Crescita
                        </div>
                        <span className="font-semibold text-emerald-600">+{sector.growthRate}%</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                          <Bot className="w-3 h-3" /> Auto.
                        </div>
                        <span className={cn("font-semibold", risk.color.split(" ")[0])}>
                          {risk.label}
                        </span>
                      </div>
                    </div>

                    {/* RIASEC + work mode + CTA */}
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
                        Scopri <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>

                  </div>
                </Link>
                </AnimateOnScrollItem>
              );
            })}
          </AnimateOnScroll>
        )}

        {/* Compare CTA */}
        {!isLoading && sectors.length > 0 && (
          <div className="mt-8 flex justify-center">
            <Link href="/confronta">
              <div className="inline-flex items-center gap-2 border border-primary/20 bg-primary/5 text-primary px-5 py-3 rounded-full text-sm font-medium hover:bg-primary/10 transition-colors">
                <GitCompare className="w-4 h-4" />
                Confronta due settori affiancati
              </div>
            </Link>
          </div>
        )}

        {/* CTA bottom */}
        {!isLoading && sectors.length > 0 && (
          <div className="mt-8 text-center rounded-3xl border border-primary/20 bg-primary/5 p-10">
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              Non sai da dove iniziare?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Fai il test gratuito: 17 domande e scopri quali settori si adattano meglio alla tua personalità e ai tuoi valori.
            </p>
            <Link href="/test">
              <div className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors">
                Inizia il test gratuito <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
