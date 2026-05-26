import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectiveProgressGauge } from "@/components/dashboard/DashboardObjectives";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardObjective } from "@/hooks/useDashboardData";
import { usePageModule } from "@/hooks/usePageModule";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/apiClient";
import {
  getObjectiveImportance,
  getObjectiveStepText,
  getStrategicProgressPercent,
  groupStrategicObjectivesByMacroArea,
  OBJECTIVE_HORIZONS,
} from "@/lib/objectives-presentation";
import { usePageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, Flag, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const CATEGORY_OPTIONS = [
  { value: "carriera", label: "Crescita professionale" },
  { value: "business", label: "Business e mercato" },
  { value: "scoperta", label: "Direzione personale" },
  { value: "selezione", label: "Persone e organizzazione" },
  { value: "altro", label: "Obiettivi personali" },
];

function importanceClass(label: ReturnType<typeof getObjectiveImportance>) {
  if (label === "Critica") return "border-red-500/20 bg-red-500/10 text-red-600";
  if (label === "Alta") return "border-amber-500/20 bg-amber-500/10 text-amber-600";
  if (label === "Media") return "border-blue-500/20 bg-blue-500/10 text-blue-600";
  if (label === "Completata") return "border-primary/20 bg-primary/10 text-primary";
  return "border-border bg-muted text-muted-foreground";
}

function ObjectiveTimeline({ objective }: { objective: DashboardObjective }) {
  const importance = getObjectiveImportance(objective);
  const displayedProgress = objective.completed ? 100 : objective.progress;

  return (
    <article className="border-t py-5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">Obiettivo principale</p>
          <h3 className={cn("mt-1 text-base font-semibold leading-snug text-foreground", objective.completed && "line-through text-muted-foreground")}>
            {objective.text}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold", importanceClass(importance))}>
              <Flag className="h-3 w-3" />
              Importanza {importance}
            </span>
            <span className="rounded-full border bg-muted/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              {displayedProgress}% progresso
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 ml-3 space-y-0">
        {OBJECTIVE_HORIZONS.map((horizon, index) => (
          <div key={horizon.key} className="relative flex gap-4 pb-5 last:pb-0">
            {index < OBJECTIVE_HORIZONS.length - 1 && (
              <span className="absolute left-[13px] top-7 h-full w-px bg-border" aria-hidden="true" />
            )}
            <span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{horizon.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {getObjectiveStepText(objective, horizon)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export default function ObjectivesPage() {
  usePageMeta({
    title: "Obiettivi | Fondazione NorthStar",
    description: "Macro aree, obiettivi principali e timeline operative del tuo percorso.",
  });
  useWendyPageContext({
    page: "objectives",
    title: "Obiettivi",
    capabilities: ["create_objective", "update_objective_progress", "navigate"],
    fields: ["objective.text", "objective.category", "objective.dueDate"],
    actions: ["Crea obiettivo", "Aggiorna progresso", "Mostra timeline"],
  });
  usePageModule({ pageId: "objectives" });

  const { user, authReady } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("carriera");

  useEffect(() => {
    if (authReady && !user) navigate("/");
  }, [authReady, user, navigate]);

  const { data: objectives = [], isLoading } = useQuery<DashboardObjective[]>({
    queryKey: ["objectives-me"],
    queryFn: () => getJson<DashboardObjective[]>(`${BASE}api/objectives`),
    enabled: authReady && !!user,
    retry: false,
  });

  const invalidateObjectives = () => {
    void queryClient.invalidateQueries({ queryKey: ["objectives-me"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { text: string; category: string }) => postJson(`${BASE}api/objectives`, payload),
    onSuccess: invalidateObjectives,
  });

  const toggleMutation = useMutation({
    mutationFn: (objective: DashboardObjective) => patchJson(`${BASE}api/objectives/${objective.id}`, { completed: !objective.completed }),
    onSuccess: invalidateObjectives,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJson(`${BASE}api/objectives/${id}`),
    onSuccess: invalidateObjectives,
  });

  const groups = groupStrategicObjectivesByMacroArea(objectives);
  const progress = getStrategicProgressPercent(objectives);
  const strategicCount = groups.reduce((sum, group) => sum + group.objectives.length, 0);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const text = newText.trim();
    if (text.length < 3) return;
    createMutation.mutate({ text, category: newCategory });
    setNewText("");
  };

  if (!authReady || isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="mb-4 h-10 w-64" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <Link href="/dashboard" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Torna alla dashboard
      </Link>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Direzione strategica</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Obiettivi</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Macro aree, obiettivi principali e step temporali per trasformare la direzione in azioni.
            </p>
            <p className="mt-3 text-sm font-medium text-foreground">{strategicCount} obiettivi principali attivi</p>
          </div>
          <ObjectiveProgressGauge value={progress} size="lg" />
        </div>

        <form onSubmit={handleCreate} className="mt-6 grid gap-3 border-t pt-5 md:grid-cols-[1fr_220px_auto]">
          <label className="sr-only" htmlFor="objective-text">Nuovo obiettivo</label>
          <input
            id="objective-text"
            value={newText}
            onChange={(event) => setNewText(event.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Aggiungi un obiettivo principale..."
          />
          <label className="sr-only" htmlFor="objective-category">Macro area</label>
          <select
            id="objective-category"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            className="min-h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button type="submit" className="min-h-11 rounded-lg" disabled={createMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi
          </Button>
        </form>
      </section>

      <div className="mt-6 space-y-5">
        {groups.length === 0 && (
          <section className="rounded-lg border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Nessun obiettivo principale</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Aggiungi un obiettivo per costruire la tua prima macro area di direzione.
            </p>
          </section>
        )}

        {groups.map((group) => (
          <section key={group.macroArea.key} className="rounded-lg border bg-card p-5">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Macro area</p>
              <h2 className="mt-1 text-xl font-bold text-foreground">{group.macroArea.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{group.macroArea.description}</p>
            </div>

            {group.objectives.map((objective) => (
              <div key={objective.id} className="group relative">
                <div className="absolute right-0 top-4 flex gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={objective.completed ? "Riapri obiettivo" : "Completa obiettivo"}
                    onClick={() => toggleMutation.mutate(objective)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    {objective.completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    aria-label="Elimina obiettivo"
                    onClick={() => deleteMutation.mutate(objective.id)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <ObjectiveTimeline objective={objective} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
