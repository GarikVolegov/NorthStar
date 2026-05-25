import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Archive,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FlaskConical,
  LineChart,
  Loader2,
  Plus,
} from "lucide-react";
import {
  EXPERIMENT_STATUS_LABELS,
  EXPERIMENT_TEMPLATES,
  SCORE_LABELS,
} from "./ideaValidatorConfig";
import type {
  ExperimentAction,
  ExperimentStatus,
  GuidedExperiment,
  RadarState,
  SaveState,
  ScoreKey,
} from "./ideaValidatorTypes";
import { formatDate } from "./ideaValidatorUtils";

export function RadarAndTestSetupSection({
  scores,
  proposedScores,
  scoreReasons,
  scoreSuggestions,
  scoreGeneratedAt,
  scoreModel,
  radarState,
  radarError,
  saveState,
  assumption,
  lastWendyAdvice,
  requestRadarSuggestion,
  applyProposedScore,
  updateScore,
  updateAssumption,
  updateLastWendyAdvice,
  askWendy,
}: {
  scores: Record<ScoreKey, number>;
  proposedScores: Partial<Record<ScoreKey, number>>;
  scoreReasons: Partial<Record<ScoreKey, string>>;
  scoreSuggestions: Partial<Record<ScoreKey, string>>;
  scoreGeneratedAt: string;
  scoreModel: string;
  radarState: RadarState;
  radarError: string;
  saveState: SaveState;
  assumption: string;
  lastWendyAdvice: string;
  requestRadarSuggestion: () => void;
  applyProposedScore: (key: ScoreKey) => void;
  updateScore: (key: ScoreKey, nextScore: number) => void;
  updateAssumption: (value: string) => void;
  updateLastWendyAdvice: (value: string) => void;
  askWendy: (focus: string) => void;
}) {
  return (
    <section className="mb-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <LineChart className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Radar di validazione</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Wendy puo proporre uno score, ma sei tu a decidere quando applicarlo.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="min-h-11 rounded-full gap-2"
            onClick={requestRadarSuggestion}
            disabled={radarState === "loading" || saveState === "saving"}
          >
            {radarState === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrainCircuit className="h-4 w-4" />
            )}
            Fai valutare a Wendy
          </Button>
        </div>

        {radarError ? (
          <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {radarError}
          </div>
        ) : null}

        {scoreGeneratedAt ? (
          <p className="mb-4 text-xs text-muted-foreground">
            Ultima proposta: {formatDate(scoreGeneratedAt)}
            {scoreModel ? ` · ${scoreModel}` : ""}
          </p>
        ) : null}

        <div className="space-y-4">
          {(Object.keys(SCORE_LABELS) as ScoreKey[]).map((key) => (
            <div key={key} className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{SCORE_LABELS[key].label}</p>
                  <p className="text-xs text-muted-foreground">{SCORE_LABELS[key].hint}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    {scores[key]}/5
                  </span>
                  {proposedScores[key] ? (
                    <Button type="button" variant="secondary" size="sm" className="min-h-11 rounded-full text-xs" onClick={() => applyProposedScore(key)}>
                      Applica {proposedScores[key]}/5
                    </Button>
                  ) : null}
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={scores[key]}
                onChange={(event) => updateScore(key, Number(event.target.value))}
                className="w-full accent-primary"
                aria-label={`Valutazione ${SCORE_LABELS[key].label}`}
              />
              {proposedScores[key] ? (
                <p className="mt-2 text-xs font-medium text-primary">
                  Proposto da Wendy: {proposedScores[key]}/5
                </p>
              ) : null}
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {scoreReasons[key] ||
                  "Nessuna motivazione ancora: chiedi a Wendy una valutazione del canvas."}
              </p>
              {scores[key] < 3 && scoreSuggestions[key] ? (
                <div className="mt-3 rounded-2xl border border-amber-300/40 bg-amber-100/60 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {scoreSuggestions[key]}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Ipotesi e prossimo test</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ipotesi critica
            </label>
            <Textarea value={assumption} onChange={(event) => updateAssumption(event.target.value)} placeholder="La cosa che deve essere vera perché l'idea funzioni..." className="min-h-32 resize-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ultimo consiglio Wendy
            </label>
            <Textarea value={lastWendyAdvice} onChange={(event) => updateLastWendyAdvice(event.target.value)} placeholder="Sintesi del consiglio ricevuto da Wendy..." className="min-h-32 resize-none" />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="min-h-11 flex-1 rounded-full gap-2" onClick={() => askWendy("Trova i rischi principali e come ridurli")}>
            Trova rischi
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="min-h-11 flex-1 rounded-full gap-2" onClick={() => askWendy("Trasforma questa idea in un piano di test di 7 giorni")}>
            Piano test 7 giorni
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ExperimentsSection({
  experiments,
  activeExperiment,
  selectedTemplate,
  experimentActionLoading,
  experimentActionError,
  setSelectedTemplate,
  setActiveExperimentId,
  createExperiment,
  duplicateActiveExperiment,
  discardActiveExperiment,
  createExperimentObjective,
  createExperimentCalendarEvent,
  completeActiveExperiment,
  updateActiveExperiment,
  askWendy,
}: {
  experiments: GuidedExperiment[];
  activeExperiment: GuidedExperiment | null;
  selectedTemplate: string;
  experimentActionLoading: ExperimentAction | null;
  experimentActionError: string;
  setSelectedTemplate: (value: string) => void;
  setActiveExperimentId: (value: string) => void;
  createExperiment: () => void;
  duplicateActiveExperiment: () => void;
  discardActiveExperiment: () => void;
  createExperimentObjective: () => void;
  createExperimentCalendarEvent: (type: "calendar" | "reminder") => void;
  completeActiveExperiment: () => void;
  updateActiveExperiment: (key: keyof GuidedExperiment, value: string) => void;
  askWendy: (focus: string) => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Esperimenti guidati</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Trasforma l'idea in test concreti: scegli un template, misura un segnale e registra l'esito.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={selectedTemplate} onChange={(event) => setSelectedTemplate(event.target.value)} className="min-h-11 rounded-full border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" aria-label="Template esperimento">
            {EXPERIMENT_TEMPLATES.map((template) => (
              <option key={template.template} value={template.template}>{template.title}</option>
            ))}
          </select>
          <Button type="button" className="min-h-11 rounded-full gap-2" onClick={createExperiment}>
            <Plus className="h-4 w-4" />
            Nuovo esperimento
          </Button>
        </div>
      </div>

      {experiments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/40 p-5">
          <p className="text-sm font-semibold text-foreground">Nessun esperimento impostato</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Scegli un template e crea il primo test per validare l'idea con dati reali.
          </p>
          <Button type="button" className="mt-4 min-h-11 rounded-full gap-2" onClick={createExperiment}>
            <FlaskConical className="h-4 w-4" />
            Scegli un template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {experiments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveExperimentId(item.id)}
                className={`min-h-16 w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  item.id === activeExperiment?.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/40 hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    {EXPERIMENT_STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {item.objective || "Obiettivo da definire"}
                </p>
              </button>
            ))}
          </div>

          {activeExperiment ? (
            <ActiveExperimentEditor
              activeExperiment={activeExperiment}
              experimentActionLoading={experimentActionLoading}
              experimentActionError={experimentActionError}
              duplicateActiveExperiment={duplicateActiveExperiment}
              discardActiveExperiment={discardActiveExperiment}
              createExperimentObjective={createExperimentObjective}
              createExperimentCalendarEvent={createExperimentCalendarEvent}
              completeActiveExperiment={completeActiveExperiment}
              updateActiveExperiment={updateActiveExperiment}
              askWendy={askWendy}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function ActiveExperimentEditor({
  activeExperiment,
  experimentActionLoading,
  experimentActionError,
  duplicateActiveExperiment,
  discardActiveExperiment,
  createExperimentObjective,
  createExperimentCalendarEvent,
  completeActiveExperiment,
  updateActiveExperiment,
  askWendy,
}: {
  activeExperiment: GuidedExperiment;
  experimentActionLoading: ExperimentAction | null;
  experimentActionError: string;
  duplicateActiveExperiment: () => void;
  discardActiveExperiment: () => void;
  createExperimentObjective: () => void;
  createExperimentCalendarEvent: (type: "calendar" | "reminder") => void;
  completeActiveExperiment: () => void;
  updateActiveExperiment: (key: keyof GuidedExperiment, value: string) => void;
  askWendy: (focus: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Esperimento attivo
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{activeExperiment.title}</h3>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 rounded-full gap-2" onClick={duplicateActiveExperiment}>
            <Copy className="h-4 w-4" />
            Duplica
          </Button>
          <Button type="button" variant="outline" className="min-h-11 rounded-full gap-2" onClick={discardActiveExperiment} disabled={activeExperiment.status === "discarded"}>
            <Archive className="h-4 w-4" />
            Archivia
          </Button>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Trasforma in azione</p>
        <p className="text-sm text-muted-foreground">Collega l'esperimento a obiettivi e calendario NorthStar.</p>
        {experimentActionError ? (
          <div className="my-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {experimentActionError}
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ActionButton loading={experimentActionLoading === "objective"} done={!!activeExperiment.objectiveId} label={activeExperiment.objectiveId ? "Task creato" : "Crea task"} icon={ClipboardCheck} onClick={createExperimentObjective} disabled={!!activeExperiment.objectiveId || experimentActionLoading !== null} />
          <ActionButton loading={experimentActionLoading === "calendar"} done={!!activeExperiment.calendarEventId} label={activeExperiment.calendarEventId ? "Evento creato" : "Aggiungi evento"} icon={CalendarDays} onClick={() => createExperimentCalendarEvent("calendar")} disabled={!!activeExperiment.calendarEventId || experimentActionLoading !== null} />
          <ActionButton loading={experimentActionLoading === "reminder"} done={!!activeExperiment.reminderEventId} label={activeExperiment.reminderEventId ? "Promemoria creato" : "Ricordamelo tra 7 giorni"} icon={CalendarDays} onClick={() => createExperimentCalendarEvent("reminder")} disabled={!!activeExperiment.reminderEventId || experimentActionLoading !== null} />
          <ActionButton loading={experimentActionLoading === "complete"} done={activeExperiment.status === "completed"} label={activeExperiment.status === "completed" ? "Completato" : "Segna completato"} icon={CheckCircle2} onClick={completeActiveExperiment} disabled={activeExperiment.status === "completed" || experimentActionLoading !== null} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ExperimentInput label="Titolo" value={activeExperiment.title} onChange={(value) => updateActiveExperiment("title", value)} input />
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stato</label>
          <select value={activeExperiment.status} onChange={(event) => updateActiveExperiment("status", event.target.value as ExperimentStatus)} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {Object.entries(EXPERIMENT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2"><ExperimentInput label="Obiettivo" value={activeExperiment.objective} onChange={(value) => updateActiveExperiment("objective", value)} /></div>
        <ExperimentInput label="Ipotesi" value={activeExperiment.hypothesis} onChange={(value) => updateActiveExperiment("hypothesis", value)} />
        <ExperimentInput label="Cosa misurare" value={activeExperiment.metric} onChange={(value) => updateActiveExperiment("metric", value)} />
        <ExperimentInput label="Risultato atteso" value={activeExperiment.expectedResult} onChange={(value) => updateActiveExperiment("expectedResult", value)} />
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Data limite
          </label>
          <Input type="date" value={activeExperiment.deadline} onChange={(event) => updateActiveExperiment("deadline", event.target.value)} className="min-h-11" />
        </div>
        <div className="md:col-span-2"><ExperimentInput label="Esito" value={activeExperiment.outcome} onChange={(value) => updateActiveExperiment("outcome", value)} placeholder="Cosa e successo? Quale dato hai raccolto? Cosa cambia nella prossima iterazione?" /></div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="min-h-11 flex-1 rounded-full gap-2" onClick={() => askWendy("Migliora l'esperimento attivo e rendilo piu misurabile")}>
          Migliora esperimento
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="min-h-11 flex-1 rounded-full gap-2" onClick={() => askWendy("Interpreta l'esito dell'esperimento attivo")}>
          Interpreta esito
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ActionButton({
  loading,
  done,
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  loading: boolean;
  done: boolean;
  label: string;
  icon: typeof CalendarDays;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button type="button" variant={done ? "secondary" : "outline"} className="min-h-11 rounded-full gap-2" onClick={onClick} disabled={disabled}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </Button>
  );
}

function ExperimentInput({
  label,
  value,
  onChange,
  placeholder,
  input = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  input?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {input ? (
        <Input value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11" />
      ) : (
        <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-28 resize-none" />
      )}
    </div>
  );
}
