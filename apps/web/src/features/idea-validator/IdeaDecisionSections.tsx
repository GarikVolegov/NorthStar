import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BrainCircuit,
  ClipboardCheck,
  Loader2,
  MessageSquareText,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import {
  DECISION_HINTS,
  DECISION_LABELS,
  STATUS_LABELS,
  TIMELINE_META,
  WENDY_IDEA_ACTIONS,
} from "./ideaValidatorConfig";
import type {
  DecisionState,
  DecisionSuggestion,
  IdeaStatus,
  TimelineEvent,
} from "./ideaValidatorTypes";
import { formatDate } from "./ideaValidatorUtils";

export function IdeaSummarySection({
  ideaName,
  oneLiner,
  averageScore,
  status,
  problem,
  customer,
  experiment,
  lastWendyAdvice,
}: {
  ideaName: string;
  oneLiner: string;
  averageScore: number;
  status: IdeaStatus;
  problem: string;
  customer: string;
  experiment: string;
  lastWendyAdvice: string;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Scheda idea
          </p>
          <h2 className="mt-1 text-2xl font-serif font-bold text-foreground">
            {ideaName.trim() || "Nuova idea"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {oneLiner.trim() || "Pitch non ancora definito"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Score
            </p>
            <p className="text-2xl font-bold text-foreground">{averageScore}%</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stato
            </p>
            <p className="text-sm font-bold text-foreground">{STATUS_LABELS[status]}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Target} title="Problema principale" value={problem || "Problema da chiarire"} />
        <SummaryCard icon={Users} title="Target" value={customer || "Target da definire"} />
        <SummaryCard icon={ClipboardCheck} title="Prossimo esperimento" value={experiment || "Nessun esperimento impostato"} />
        <SummaryCard icon={MessageSquareText} title="Ultimo consiglio Wendy" value={lastWendyAdvice || "Aggiungi o chiedi a Wendy un consiglio"} />
      </div>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Target;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
        {value}
      </p>
    </div>
  );
}

export function IdeaTimelineSection({
  displayTimeline,
  visibleTimeline,
  showAllTimeline,
  setShowAllTimeline,
}: {
  displayTimeline: TimelineEvent[];
  visibleTimeline: TimelineEvent[];
  showAllTimeline: boolean;
  setShowAllTimeline: (updater: (value: boolean) => boolean) => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Timeline idea
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Storia operativa dell'idea
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tieni traccia dei passaggi importanti: canvas, feedback Wendy, esperimenti, score e decisioni.
          </p>
        </div>
        <span className="inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-muted-foreground">
          {displayTimeline.length} eventi
        </span>
      </div>

      {displayTimeline.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/40 p-5">
          <p className="text-sm font-semibold text-foreground">Timeline pronta</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Appena salvi, modifichi il canvas, chiedi feedback a Wendy o completi un esperimento, qui apparirà la storia dell'idea.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTimeline.map((event) => {
            const meta = TIMELINE_META[event.type];
            const Icon = meta.icon;
            return (
              <div
                key={event.id}
                className="grid gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-[44px_1fr_auto]"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border ${meta.tone}`}
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>
                </div>
                <time className="text-left text-xs font-medium text-muted-foreground sm:text-right">
                  {formatDate(event.createdAt)}
                </time>
              </div>
            );
          })}
          {displayTimeline.length > 8 ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full"
              onClick={() => setShowAllTimeline((value) => !value)}
            >
              {showAllTimeline ? "Mostra meno" : "Mostra tutto"}
            </Button>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function IdeaDecisionSection({
  decisionState,
  decisionReason,
  decisionUpdatedAt,
  decisionSuggested,
  decisionLoading,
  decisionError,
  saveState,
  requestDecisionSuggestion,
  applyDecision,
  setDecisionState,
  setDecisionReason,
  setDecisionUpdatedAt,
  markDirty,
}: {
  decisionState: DecisionState | "";
  decisionReason: string;
  decisionUpdatedAt: string;
  decisionSuggested: DecisionSuggestion | null;
  decisionLoading: boolean;
  decisionError: string;
  saveState: "idle" | "saving" | "saved" | "error";
  requestDecisionSuggestion: () => void;
  applyDecision: (
    nextState: DecisionState,
    reason: string,
    source: "manual" | "wendy",
    suggestion?: DecisionSuggestion,
  ) => void;
  setDecisionState: (value: DecisionState | "") => void;
  setDecisionReason: (value: string) => void;
  setDecisionUpdatedAt: (value: string) => void;
  markDirty: () => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Decisione finale
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Decidi cosa fare dell'idea
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Wendy può consigliarti lo stato, ma la decisione viene salvata solo quando la approvi o la scegli manualmente.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 rounded-full gap-2"
          onClick={requestDecisionSuggestion}
          disabled={decisionLoading || saveState === "saving"}
        >
          {decisionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
          Chiedi consiglio a Wendy
        </Button>
      </div>

      {decisionError ? (
        <div className="mb-4 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {decisionError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Stato approvato
          </p>
          {decisionState ? (
            <>
              <div className="mt-3 inline-flex min-h-11 items-center rounded-full bg-primary/10 px-4 text-sm font-bold text-primary">
                {DECISION_LABELS[decisionState]}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {decisionReason || DECISION_HINTS[decisionState]}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Aggiornata {formatDate(decisionUpdatedAt)}
              </p>
            </>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Nessuna decisione finale</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Scegli uno stato manualmente o chiedi una proposta a Wendy quando hai abbastanza segnali.
              </p>
            </div>
          )}

          <label className="mt-5 mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scegli manualmente
          </label>
          <select
            value={decisionState}
            onChange={(event) => {
              const next = event.target.value as DecisionState | "";
              if (!next) {
                setDecisionState("");
                setDecisionReason("");
                setDecisionUpdatedAt("");
                markDirty();
                return;
              }
              applyDecision(next, decisionReason || DECISION_HINTS[next], "manual");
            }}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Nessuna decisione</option>
            {Object.entries(DECISION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="mt-4 mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Motivazione approvata
          </label>
          <Textarea
            value={decisionReason}
            onChange={(event) => {
              setDecisionReason(event.target.value);
              if (decisionState) setDecisionUpdatedAt(new Date().toISOString());
              markDirty();
            }}
            placeholder="Perché questa è la decisione giusta ora?"
            className="min-h-28 resize-none"
          />
        </div>

        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Wendy consiglia</h3>
          </div>
          {decisionSuggested ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {DECISION_LABELS[decisionSuggested.state]}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      Confidenza {decisionSuggested.confidence}%
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="min-h-11 rounded-full"
                    onClick={() =>
                      applyDecision(
                        decisionSuggested.state,
                        decisionSuggested.reason,
                        "wendy",
                        decisionSuggested,
                      )
                    }
                  >
                    Approva decisione
                  </Button>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {decisionSuggested.reason}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatDate(decisionSuggested.generatedAt)}
                  {decisionSuggested.model ? ` · ${decisionSuggested.model}` : ""}
                </p>
              </div>
              {decisionSuggested.nextActions.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Prossime azioni
                  </p>
                  <div className="space-y-2">
                    {decisionSuggested.nextActions.map((action, index) => (
                      <div
                        key={`${action}-${index}`}
                        className="flex gap-2 rounded-2xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
                      >
                        <span className="font-bold text-primary">{index + 1}.</span>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">
                Nessun suggerimento ancora
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Quando chiedi a Wendy, riceverai uno stato proposto, una motivazione basata sui dati e le prossime azioni.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function IdeaWendyActionsSection({
  askWendy,
}: {
  askWendy: (focus: string) => void;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Azioni Wendy</h2>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Wendy legge canvas, radar ed esperimenti: non sostituisce la pagina, lavora sopra i dati che hai già inserito.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {WENDY_IDEA_ACTIONS.map(({ label, icon: Icon, prompt }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            className="min-h-16 justify-start rounded-2xl px-4 py-3 text-left whitespace-normal"
            onClick={() => askWendy(prompt)}
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-semibold leading-snug">{label}</span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  );
}
