import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { getJson } from "@/lib/apiClient";
import { RIASEC_LABELS, SectorIcon } from "@/lib/sector-icon";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  DollarSign,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

type Role = {
  id: number;
  title: string;
  description: string | null;
  skills: string[];
  workModes: string[];
  riasecFit: string[];
  salaryRange: string | null;
  growthOutlook: string | null;
  autonomyScore: number | null;
  stabilityScore: number | null;
  sectorId: number | null;
  sectorName: string | null;
  sectorIcon: string | null;
};

const GROWTH_COLOR: Record<string, string> = {
  "Molto alto": "text-emerald-600",
  "Alto": "text-emerald-500",
  "Stabile": "text-slate-500",
  "Variabile": "text-amber-600",
};

const ALL_RIASEC = ["R", "I", "A", "S", "E", "C"];

function RoleCard({ role }: { role: Role }) {
  const growthColor = GROWTH_COLOR[role.growthOutlook ?? ""] ?? "text-slate-500";
  return (
    <Link href={`/ruolo/${role.id}`} className="block group">
      <div className="h-full bg-card border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col">
        {/* Sector tag */}
        {role.sectorName && (
          <div className="flex items-center gap-1.5 mb-3">
            {role.sectorIcon && <SectorIcon name={role.sectorIcon} size={13} className="text-muted-foreground" />}
            <span className="text-xs text-muted-foreground truncate">{role.sectorName}</span>
          </div>
        )}

        <h3 className="font-semibold text-foreground mb-1.5 group-hover:text-primary transition-colors leading-snug">
          {role.title}
        </h3>

        {role.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-1">
            {role.description}
          </p>
        )}

        {/* RIASEC chips */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(role.riasecFit as string[]).map((code) => (
            <span
              key={code}
              title={RIASEC_LABELS[code]?.label}
              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
            >
              {code}
            </span>
          ))}
        </div>

        {/* Skill chips */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(role.skills as string[]).slice(0, 3).map((skill, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {skill}
            </span>
          ))}
          {role.skills.length > 3 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{role.skills.length - 3}
            </span>
          )}
        </div>

        {/* Salary + growth */}
        <div className="flex items-center justify-between text-xs border-t pt-3 mt-auto">
          <span className="flex items-center gap-1 text-muted-foreground font-medium">
            <DollarSign className="w-3 h-3" />
            {role.salaryRange ?? "—"}
          </span>
          {role.growthOutlook && (
            <span className={cn("flex items-center gap-1 font-semibold", growthColor)}>
              <TrendingUp className="w-3 h-3" />
              {role.growthOutlook}
            </span>
          )}
        </div>

        <div className="mt-2.5 flex items-center text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Scopri il lavoro <ArrowRight className="w-3 h-3 ml-1" />
        </div>
      </div>
    </Link>
  );
}

export default function Ruoli() {
  usePageMeta({
    title: "Lavori Professionali — NorthStar",
    description: "Esplora tutti i lavori e le professioni disponibili per settore. Scopri competenze, stipendi e prospettive di crescita per ogni professione.",
    path: "/ruoli",
  });
  useWendyPageContext({
    page: "ruoli",
    title: "Ruoli",
    capabilities: ["navigate", "set_filters"],
    fields: ["search", "sectorId", "riasecTypes"],
    actions: ["Filtra ruoli", "Apri ruolo", "Confronta professioni"],
  });

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["all-roles"],
    queryFn: () => getJson<Role[]>(`${BASE}api/roles`),
    staleTime: 300_000,
  });

  const { data: sectors = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["all-sectors"],
    queryFn: () => getJson<{ id: number; name: string }[]>(`${BASE}api/sectors`),
    staleTime: 300_000,
  });

  const [search, setSearch] = useState("");
  const [activeSector, setActiveSector] = useState<number | null>(null);
  const [activeRiasec, setActiveRiasec] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keyword = params.get("keyword") ?? params.get("query") ?? params.get("q") ?? "";
    const riasec = params.get("riasecTypes") ?? params.get("riasec") ?? "";
    const sectorId = Number(params.get("sectorId") ?? "");
    if (keyword) setSearch(keyword);
    if (riasec) {
      setActiveRiasec(riasec.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean));
      setShowFilters(true);
    }
    if (Number.isFinite(sectorId) && sectorId > 0) {
      setActiveSector(sectorId);
      setShowFilters(true);
    }
  }, []);

  const hasFilters = !!search.trim() || activeSector !== null || activeRiasec.length > 0;

  function clearAll() {
    setSearch("");
    setActiveSector(null);
    setActiveRiasec([]);
  }

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchDesc = (r.description ?? "").toLowerCase().includes(q);
        const matchSkill = (r.skills as string[]).some((s) => s.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchSkill) return false;
      }
      if (activeSector !== null && r.sectorId !== activeSector) return false;
      if (activeRiasec.length > 0 && !activeRiasec.some((code) => (r.riasecFit as string[]).includes(code))) return false;
      return true;
    });
  }, [roles, search, activeSector, activeRiasec]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-14 md:py-20">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-5">
            <Briefcase className="w-4 h-4" />
            {isLoading ? "Lavori" : `${roles.length} lavori`}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Esplora i <span className="text-primary">Lavori</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Scopri tutte le professioni disponibili per settore, con competenze richieste, fasce salariali e prospettive di crescita.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-6xl py-10">

        {/* Filters */}
        <div className="bg-card border rounded-2xl p-5 mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <SlidersHorizontal className="w-4 h-4" />
              Filtra i lavori
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-xs text-primary hover:underline"
            >
              {showFilters ? "Nascondi filtri" : "Mostra filtri avanzati"}
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca lavoro, competenza…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {showFilters && (
            <>
              {/* RIASEC filter */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                  Tipo di personalità RIASEC
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_RIASEC.map((r) => {
                    const meta = RIASEC_LABELS[r];
                    const active = activeRiasec.includes(r);
                    return (
                      <button
                        key={r}
                        onClick={() => setActiveRiasec((prev) =>
                          prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                        )}
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

              {/* Sector filter */}
              {sectors.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                    Settore
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sectors.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setActiveSector(activeSector === s.id ? null : s.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors",
                          activeSector === s.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {hasFilters && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Rimuovi filtri
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Caricamento…"
              : filtered.length === roles.length
                ? `${roles.length} lavori disponibili`
                : `${filtered.length} di ${roles.length} lavori`}
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
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nessun lavoro trovato</p>
            <p className="text-sm mt-1">Prova a modificare i filtri o la ricerca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>
        )}

        {/* CTA */}
        {!isLoading && roles.length > 0 && (
          <div className="mt-12 text-center rounded-3xl border border-primary/20 bg-primary/5 p-10">
            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
              Trova il lavoro giusto per te
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Fai il test RIASEC per scoprire quali ruoli sono più compatibili con la tua personalità e i tuoi punti di forza.
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
