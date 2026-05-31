import { Button } from "@/components/ui/button";
import { getJson } from "@/lib/apiClient";
import { useOptionalWendy } from "@/contexts/WendyProvider";
import { AlertCircle, Loader2, Network } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BridgeFilters } from "./BridgeFilters";
import { BridgeMapCanvas } from "./BridgeMapCanvas";
import { ProfessionSidePanel } from "./ProfessionSidePanel";
import type {
  SkillBridgeFiltersState,
  SkillBridgeLens,
  SkillBridgeProfession,
  SkillBridgeResponse,
} from "./types";

const LENS_COPY: Record<SkillBridgeLens, { title: string; description: string }> = {
  indeciso: {
    title: "Esplora ruoli lontani ma interessanti",
    description: "Gli anelli ti fanno vedere sia i salti piccoli sia le possibilita che meritano curiosita.",
  },
  dipendente: {
    title: "Aumenti possibili e tempo di transizione",
    description: "Parti dalle skill gia spendibili e guarda quali ruoli richiedono pochi passi mirati.",
  },
  autonomo: {
    title: "Ruoli freelance o remote in evidenza",
    description: "La lente privilegia lavori compatibili con autonomia, consulenza e modalita flessibili.",
  },
  azienda: {
    title: "Mappa competenze per onboarding e crescita",
    description: "In questa versione legge le tue skill; la vista team arrivera come layer successivo.",
  },
};

const EMPTY_FILTERS: SkillBridgeFiltersState = {
  sectorId: "",
  minSalary: "",
  workMode: "",
  city: "",
};

export function SkillBridgeMap({ lens }: { lens: SkillBridgeLens }) {
  const wendy = useOptionalWendy();
  const [filters, setFilters] = useState<SkillBridgeFiltersState>(() => ({
    ...EMPTY_FILTERS,
    workMode: lens === "autonomo" ? "remote" : "",
  }));
  const [data, setData] = useState<SkillBridgeResponse | null>(null);
  const [selected, setSelected] = useState<SkillBridgeProfession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getJson<SkillBridgeResponse>(`/api/user/skill-bridge${toQuery(filters)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        setData(response);
        setSelected((current) => {
          if (!current) return response.professions[0] ?? null;
          return response.professions.find((item) => item.id === current.id) ?? response.professions[0] ?? null;
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Mappa competenze temporaneamente non disponibile");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters]);

  const professions = useMemo(() => sortForLens(data?.professions ?? [], lens), [data?.professions, lens]);
  const copy = LENS_COPY[lens];

  return (
    <section className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm" aria-label="Skill Bridge Map">
      <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Skill Bridge Map</h2>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{copy.title}</p>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
        </div>
        {data ? (
          <div className="shrink-0 rounded-lg border bg-background px-3 py-2 text-sm">
            <span className="font-semibold text-foreground">{data.center.skills.length}</span>{" "}
            <span className="text-muted-foreground">skill core</span>
          </div>
        ) : null}
      </div>

      <BridgeFilters value={filters} onChange={setFilters} />

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Calcolo le distanze di skill...
        </div>
      ) : error ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" onClick={() => setFilters({ ...filters })}>
            Riprova
          </Button>
        </div>
      ) : data && professions.length > 0 ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <BridgeMapCanvas
            userSkills={data.center.skills}
            professions={professions}
            selectedId={selected?.id}
            onSelect={setSelected}
          />
          <ProfessionSidePanel
            profession={selected}
            userSkills={data.center.skills}
            onAskWendy={(prompt) => {
              wendy?.ask(prompt);
            }}
          />
        </div>
      ) : (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 p-6 text-center">
          <Network className="h-6 w-6 text-muted-foreground" />
          <p className="font-medium text-foreground">Aggiungi skill per accendere la mappa</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Certificazioni, CV e import LinkedIn alimentano il centro della costellazione.
          </p>
        </div>
      )}
    </section>
  );
}

function toQuery(filters: SkillBridgeFiltersState): string {
  const params = new URLSearchParams();
  if (filters.sectorId.trim()) params.set("sectorId", filters.sectorId.trim());
  if (filters.minSalary.trim()) params.set("minSalary", filters.minSalary.trim());
  if (filters.workMode.trim()) params.set("workMode", filters.workMode.trim());
  if (filters.city.trim()) params.set("city", filters.city.trim());
  const query = params.toString();
  return query ? `?${query}` : "";
}

function sortForLens(professions: SkillBridgeProfession[], lens: SkillBridgeLens): SkillBridgeProfession[] {
  const ordered = [...professions];
  if (lens === "indeciso") {
    return ordered.sort((a, b) => b.ring - a.ring || b.overlapPercent - a.overlapPercent);
  }
  if (lens === "autonomo") {
    return ordered.sort((a, b) => {
      const aFlexible = hasFlexibleMode(a) ? 1 : 0;
      const bFlexible = hasFlexibleMode(b) ? 1 : 0;
      return bFlexible - aFlexible || a.ring - b.ring || b.overlapPercent - a.overlapPercent;
    });
  }
  return ordered.sort((a, b) => a.ring - b.ring || b.overlapPercent - a.overlapPercent);
}

function hasFlexibleMode(profession: SkillBridgeProfession): boolean {
  return profession.workModes.some((mode) => {
    const normalized = mode.toLowerCase();
    return normalized.includes("remote") || normalized.includes("freelance");
  });
}

