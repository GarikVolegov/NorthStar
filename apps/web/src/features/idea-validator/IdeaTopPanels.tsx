import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Archive,
  BrainCircuit,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Plus,
  Save,
} from "lucide-react";
import type { ReactNode } from "react";
import { InfoHint } from "./InfoHint";
import {
  FIELD_HELP,
  GUIDED_STEPS,
  STATUS_LABELS,
  STEP_ACTIONS,
} from "./ideaValidatorConfig";
import type {
  BusinessIdea,
  GuidedStep,
  IdeaStatus,
  SaveState,
} from "./ideaValidatorTypes";
import { formatDate } from "./ideaValidatorUtils";

export function IdeaListPanel({
  ideas,
  activeIdeaId,
  loadingIdeas,
  saveState,
  createNewIdea,
  loadIdeaIntoForm,
}: {
  ideas: BusinessIdea[];
  activeIdeaId: number | null;
  loadingIdeas: boolean;
  saveState: SaveState;
  createNewIdea: () => void;
  loadIdeaIntoForm: (idea: BusinessIdea) => void;
}) {
  return (
    <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Le tue idee
          </p>
          <p className="text-sm text-muted-foreground">
            {ideas.length} {ideas.length === 1 ? "idea salvata" : "idee salvate"}
          </p>
        </div>
        <Button
          size="sm"
          className="min-h-11 rounded-full gap-1.5"
          onClick={createNewIdea}
          disabled={saveState === "saving"}
        >
          <Plus className="h-4 w-4" />
          Nuova
        </Button>
      </div>

      {loadingIdeas ? (
        <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Caricamento idee...
        </div>
      ) : ideas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nessuna idea salvata. Crea la prima bozza per non perdere il lavoro.
        </div>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => {
            const active = idea.id === activeIdeaId;
            return (
              <button
                key={idea.id}
                type="button"
                onClick={() => loadIdeaIntoForm(idea)}
                className={`w-full rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-background/40 hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold text-foreground">
                    {idea.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {STATUS_LABELS[idea.status] ?? idea.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {idea.ideaText || "Pitch non ancora definito"}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Aggiornata {formatDate(idea.updatedAt)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export function IdeaHeaderPanel({
  error,
  saveState,
  saveLabel,
  activeIdeaId,
  archiveConfirm,
  ideaName,
  oneLiner,
  status,
  persistIdea,
  archiveIdea,
  setIdeaName,
  setOneLiner,
  setStatus,
  addTimelineEvent,
  markDirty,
  children,
}: {
  error: string | null;
  saveState: SaveState;
  saveLabel: string;
  activeIdeaId: number | null;
  archiveConfirm: boolean;
  ideaName: string;
  oneLiner: string;
  status: IdeaStatus;
  persistIdea: (mode?: "create" | "update") => void;
  archiveIdea: () => void;
  setIdeaName: (value: string) => void;
  setOneLiner: (value: string) => void;
  setStatus: (value: IdeaStatus) => void;
  addTimelineEvent: (
    type: "status_changed",
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) => void;
  markDirty: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Laboratorio Idee
            </p>
            <h1 className="text-2xl font-serif font-bold text-foreground md:text-3xl">
              Valida un'idea con strumenti concreti
            </h1>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span
            className={`inline-flex min-h-9 items-center justify-center rounded-full px-3 text-xs font-semibold ${
              saveState === "error"
                ? "bg-destructive/10 text-destructive"
                : saveState === "saved"
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {saveState === "saving" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {saveState === "saved" && <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
            {saveLabel}
          </span>
          <Button
            variant="outline"
            className="min-h-11 rounded-full gap-2"
            onClick={() => persistIdea(activeIdeaId ? "update" : "create")}
            disabled={saveState === "saving"}
          >
            <Save className="h-4 w-4" />
            Salva bozza
          </Button>
          <Button
            variant="outline"
            className="min-h-11 rounded-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={archiveIdea}
            disabled={!activeIdeaId || saveState === "saving"}
          >
            <Archive className="h-4 w-4" />
            {archiveConfirm ? "Conferma" : "Archivia"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {children}

      <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr_180px]">
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nome idea
            <InfoHint title="Nome idea" {...FIELD_HELP.ideaName!} />
          </label>
          <Input
            value={ideaName}
            onChange={(event) => {
              setIdeaName(event.target.value);
              markDirty();
            }}
            placeholder="Es. Tutor AI per freelance"
            className="min-h-11"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pitch in una frase
            <InfoHint title="Pitch in una frase" {...FIELD_HELP.pitch!} />
          </label>
          <Input
            value={oneLiner}
            onChange={(event) => {
              setOneLiner(event.target.value);
              markDirty();
            }}
            placeholder="Aiuta X a ottenere Y senza Z"
            className="min-h-11"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Stato
            <InfoHint title="Stato" {...FIELD_HELP.status!} />
          </label>
          <select
            value={status}
            onChange={(event) => {
              const nextStatus = event.target.value as IdeaStatus;
              setStatus(nextStatus);
              if (nextStatus === "validated" || nextStatus === "discarded") {
                addTimelineEvent(
                  "status_changed",
                  nextStatus === "validated" ? "Idea validata" : "Idea scartata",
                  `Hai cambiato lo stato in ${STATUS_LABELS[nextStatus]}.`,
                  { status: nextStatus },
                );
              }
              markDirty();
            }}
            className="flex min-h-11 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function GuidedStepsPanel({
  activeStep,
  guidedProgress,
  setActiveStep,
  askWendy,
}: {
  activeStep: GuidedStep;
  guidedProgress: number;
  setActiveStep: (step: GuidedStep) => void;
  askWendy: (focus: string) => void;
}) {
  const activeStepMeta =
    GUIDED_STEPS.find((step) => step.id === activeStep) ?? GUIDED_STEPS[0]!;

  return (
    <div className="mb-5 rounded-2xl border border-border bg-background/40 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Percorso guidato
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {activeStepMeta.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {activeStepMeta.description}
          </p>
        </div>
        <div className="min-w-[180px]">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>Avanzamento</span>
            <span>{guidedProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${guidedProgress}%` }}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {GUIDED_STEPS.map((step, index) => {
          const active = step.id === activeStep;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveStep(step.id)}
              className={`min-h-14 rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wide">
                Step {index + 1}
              </span>
              <span className="mt-0.5 block text-sm font-semibold">{step.shortTitle}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cosa fare ora
          </p>
          <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-3">
            {(STEP_ACTIONS[activeStep] ?? []).map((action) => (
              <li key={action} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-full gap-2"
          onClick={() => askWendy(activeStepMeta.wendyPrompt)}
        >
          <BrainCircuit className="h-4 w-4" />
          Aiutami con questo step
        </Button>
      </div>
    </div>
  );
}
