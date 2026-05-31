import { WendyAskButton } from "@/components/diary/WendyEntryContext";
import type { InvestorAnalysis as InvestorAnalysisItem, InvestorOutcome } from "@/components/diary/diaryTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { deleteJson, getJson, postJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, ShieldAlert, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

interface SectorOption {
  id: number;
  name: string;
  growthRate: number;
  trend: string;
  automationRisk: string;
}

const OUTCOMES: Array<{ value: InvestorOutcome; label: string; className: string }> = [
  { value: "opportunita", label: "Opportunita", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
  { value: "rischio", label: "Rischio", className: "border-red-500/30 bg-red-500/10 text-red-700" },
  { value: "neutro", label: "Neutro", className: "border-slate-400/30 bg-slate-500/10 text-slate-600" },
];
const DEFAULT_OUTCOME_META = OUTCOMES[2]!;

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean);
}

export function InvestorAnalysis() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sectorId, setSectorId] = useState("");
  const [freeSectorName, setFreeSectorName] = useState("");
  const [outcome, setOutcome] = useState<InvestorOutcome>("opportunita");
  const [notes, setNotes] = useState("");
  const [tagsText, setTagsText] = useState("");

  const { data: sectors = [] } = useQuery<SectorOption[]>({
    queryKey: ["sectors"],
    queryFn: () => getJson(`${BASE}api/sectors`),
  });

  const { data, isLoading } = useQuery<{ analyses: InvestorAnalysisItem[] }>({
    queryKey: ["diary", "analyses"],
    queryFn: () => getJson(`${BASE}api/diary/analyses`),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["diary"] });
  };

  const selectedSector = sectors.find((sector) => String(sector.id) === sectorId) ?? null;
  const createMutation = useMutation({
    mutationFn: () =>
      postJson(`${BASE}api/diary/analyses`, {
        sectorId: selectedSector ? selectedSector.id : null,
        sectorName: selectedSector?.name ?? freeSectorName,
        outcome,
        notes,
        tags: splitTags(tagsText),
      }),
    onSuccess: () => {
      setSectorId("");
      setFreeSectorName("");
      setOutcome("opportunita");
      setNotes("");
      setTagsText("");
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJson(`${BASE}api/diary/analyses/${id}`),
    onSuccess: invalidate,
  });

  const analyses = data?.analyses ?? [];
  const stats = useMemo(() => {
    return analyses.reduce(
      (acc, item) => {
        acc[item.outcome] += 1;
        return acc;
      },
      { opportunita: 0, rischio: 0, neutro: 0 } as Record<InvestorOutcome, number>,
    );
  }, [analyses]);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Analisi</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{analyses.length}</p>
        </div>
        {OUTCOMES.map((item) => (
          <div key={item.value} className="rounded-lg border bg-card p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{stats[item.value]}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Nuova analisi settore</h2>
            <p className="text-sm text-muted-foreground">Collega un settore NorthStar o inserisci un nome libero.</p>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedSector || freeSectorName.trim().length > 1) createMutation.mutate();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={sectorId}
              onChange={(event) => {
                setSectorId(event.target.value);
                if (event.target.value) setFreeSectorName("");
              }}
              className="min-h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Seleziona settore NorthStar</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>{sector.name}</option>
              ))}
            </select>
            <Input
              value={freeSectorName}
              onChange={(event) => {
                setFreeSectorName(event.target.value);
                if (event.target.value) setSectorId("");
              }}
              placeholder="Oppure nome settore libero"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setOutcome(item.value)}
                className={cn(
                  "min-h-9 rounded-md border px-3 text-xs font-semibold transition-colors",
                  outcome === item.value ? item.className : "border-border text-muted-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-24" placeholder="Tesi, segnali, dubbi, fonti..." />
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="tag separati da virgola" />
            <Button type="submit" disabled={createMutation.isPending || (!selectedSector && freeSectorName.trim().length < 2)}>
              Salva analisi
            </Button>
          </div>
        </form>
      </section>

      {isLoading && <Skeleton className="h-40 rounded-lg" />}

      <div className="grid gap-4 lg:grid-cols-2">
        {analyses.map((analysis) => {
          const outcomeMeta = OUTCOMES.find((item) => item.value === analysis.outcome) ?? DEFAULT_OUTCOME_META;
          const contentForWendy = `${analysis.sectorName}\nOutcome: ${analysis.outcome}\nNote: ${analysis.notes ?? ""}`;
          return (
            <article key={analysis.id} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{analysis.sectorName}</h3>
                  <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold", outcomeMeta.className)}>
                    {outcomeMeta.label}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Elimina analisi"
                  onClick={() => {
                    if (window.confirm("Eliminare questa analisi?")) deleteMutation.mutate(analysis.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {(analysis.sectorGrowthRate !== null || analysis.sectorTrend || analysis.sectorAutomationRisk) && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <span className="rounded-md border bg-muted/30 p-2 text-xs">
                    <TrendingUp className="mb-1 h-3.5 w-3.5 text-primary" />
                    Growth {analysis.sectorGrowthRate ?? "-"}%
                  </span>
                  <span className="rounded-md border bg-muted/30 p-2 text-xs">Trend {analysis.sectorTrend ?? "-"}</span>
                  <span className="rounded-md border bg-muted/30 p-2 text-xs">
                    <ShieldAlert className="mb-1 h-3.5 w-3.5 text-primary" />
                    Risk {analysis.sectorAutomationRisk ?? "-"}
                  </span>
                </div>
              )}

              {analysis.notes && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{analysis.notes}</p>}
              {analysis.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {analysis.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <WendyAskButton kind="analysis" content={contentForWendy} journeyType={user?.journeyType} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
