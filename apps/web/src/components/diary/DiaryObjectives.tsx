import { ObjectiveProgressGauge } from "@/components/dashboard/DashboardObjectives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardObjective } from "@/hooks/useDashboardData";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/apiClient";
import {
  getObjectiveImportance,
  getObjectiveStepText,
  getStrategicProgressPercent,
  groupStrategicObjectivesByMacroArea,
  OBJECTIVE_HORIZONS,
} from "@/lib/objectives-presentation";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BadgeCheck, CheckCircle2, Circle, Flag, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useState } from "react";

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function ObjectiveTimeline({
  objective,
  onToggleCertifiable,
  certifiablePending,
}: {
  objective: DashboardObjective;
  onToggleCertifiable: () => void;
  certifiablePending: boolean;
}) {
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
            {!objective.completed && (
              <button
                type="button"
                aria-label={
                  objective.isCertifiableMilestone
                    ? "Rimuovi milestone certificabile"
                    : "Rendi milestone certificabile"
                }
                onClick={onToggleCertifiable}
                disabled={certifiablePending}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors",
                  objective.isCertifiableMilestone
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-primary",
                )}
              >
                <BadgeCheck className="h-3 w-3" />
                {objective.isCertifiableMilestone ? "Milestone certificabile" : "Milestone non certificabile"}
              </button>
            )}
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

export function DiaryObjectives() {
  const { user, authReady } = useAuth();
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("carriera");
  const [operationError, setOperationError] = useState<string | null>(null);

  const { data: objectives = [], isLoading, isError, error, refetch } = useQuery<DashboardObjective[]>({
    queryKey: ["objectives-me"],
    queryFn: () => getJson<DashboardObjective[]>(`${BASE}api/objectives`),
    enabled: authReady && !!user,
    retry: false,
  });

  const invalidateObjectives = () => {
    setOperationError(null);
    void queryClient.invalidateQueries({ queryKey: ["objectives-me"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { text: string; category: string }) => postJson(`${BASE}api/objectives`, payload),
    onSuccess: invalidateObjectives,
    onError: (mutationError) =>
      setOperationError(getErrorMessage(mutationError, "Non sono riuscita a creare l'obiettivo.")),
  });

  const toggleMutation = useMutation({
    mutationFn: (objective: DashboardObjective) => patchJson(`${BASE}api/objectives/${objective.id}`, { completed: !objective.completed }),
    onSuccess: invalidateObjectives,
    onError: (mutationError) =>
      setOperationError(getErrorMessage(mutationError, "Non sono riuscita ad aggiornare l'obiettivo.")),
  });

  const certifiableMutation = useMutation({
    mutationFn: (objective: DashboardObjective) =>
      patchJson(`${BASE}api/objectives/${objective.id}`, {
        isCertifiableMilestone: !objective.isCertifiableMilestone,
      }),
    onSuccess: invalidateObjectives,
    onError: (mutationError) =>
      setOperationError(getErrorMessage(mutationError, "Non sono riuscita ad aggiornare la milestone.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteJson(`${BASE}api/objectives/${id}`),
    onSuccess: invalidateObjectives,
    onError: (mutationError) =>
      setOperationError(getErrorMessage(mutationError, "Non sono riuscita a eliminare l'obiettivo.")),
  });

  const groups = groupStrategicObjectivesByMacroArea(objectives);
  const progress = getStrategicProgressPercent(objectives);
  const strategicCount = groups.reduce((sum, group) => sum + group.objectives.length, 0);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const text = newText.trim();
    if (text.length < 3) return;
    setOperationError(null);
    createMutation.mutate({ text, category: newCategory });
    setNewText("");
  };

  if (!authReady || isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <section className="rounded-lg border border-destructive/25 bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/25 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Obiettivi non disponibili</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {getErrorMessage(error, "Non sono riuscita a caricare gli obiettivi. Riprova tra poco.")}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" className="rounded-lg" onClick={() => void refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Riprova
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {operationError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Aggiornamento non riuscito</p>
              <p className="mt-0.5 text-destructive/90">{operationError}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Chiudi errore"
            onClick={() => setOperationError(null)}
            className="inline-flex min-h-9 min-w-9 items-center justify-center self-start rounded-lg text-destructive/80 hover:bg-destructive/10 hover:text-destructive sm:self-auto"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Direzione strategica</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">Obiettivi</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Macro aree, obiettivi principali e step temporali raccolti nel diario del tuo percorso.
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

      {groups.length === 0 && (
        <section className="rounded-lg border bg-card p-5">
          <h3 className="text-base font-semibold text-foreground">Nessun obiettivo principale</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Aggiungi un obiettivo per costruire la tua prima macro area di direzione.
          </p>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.macroArea.key} className="rounded-lg border bg-card p-5">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Macro area</p>
            <h3 className="mt-1 text-xl font-bold text-foreground">{group.macroArea.label}</h3>
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
              <ObjectiveTimeline
                objective={objective}
                onToggleCertifiable={() => certifiableMutation.mutate(objective)}
                certifiablePending={certifiableMutation.isPending}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
