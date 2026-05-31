import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getJson, postJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { BarChart3, CheckCircle2, ChevronDown, Lock, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TimeBlock = "morning" | "afternoon" | "evening";

interface TryADayOption {
  id: string;
  label: string;
  signal: string;
  value: number;
}

interface TryADayScene {
  timeBlock: TimeBlock;
  title: string;
  narrative: string;
  taskImportance: string;
  interaction:
    | { type: "choice"; prompt: string; options: TryADayOption[] }
    | { type: "priority_order"; prompt: string; options: TryADayOption[] }
    | { type: "comfort_slider"; prompt: string; minLabel: string; maxLabel: string };
  emotionalPrompt: string;
  signals: { skills: string[]; values: string[]; energy: number; interest: number; competence: number };
}

interface TryADayDebrief {
  radar: {
    energy: number;
    interest: number;
    perceivedCompetence: number;
    valuesAlignment: number;
  };
  summary: string;
  highlights: string[];
}

type SceneResponse = {
  choiceId?: string;
  orderedIds?: string[];
  comfort?: number;
  emotion?: number;
};

type Responses = Partial<Record<TimeBlock, SceneResponse>>;

interface RoleForTryADay {
  id: number;
  title: string;
  sector: string;
  description?: string | null;
  skills: string[];
  riasecFit: string[];
  workModes: string[];
}

interface TryADaySectionProps {
  role: RoleForTryADay;
  journeyType?: string | null | undefined;
  onSceneChange?: (scene: TimeBlock | null) => void;
}

const ctaByJourney: Record<string, string> = {
  indeciso: "scopri se fa per te",
  dipendente: "valuta la transizione",
  autonomo: "assaggia un ruolo affine",
  azienda: "immagina onboarding o employer branding",
  investitore: "capisci i ruoli chiave del settore",
};

const blockLabels: Record<TimeBlock, string> = {
  morning: "Mattina",
  afternoon: "Pomeriggio",
  evening: "Sera",
};

export function TryADaySection({ role, journeyType, onSceneChange }: TryADaySectionProps) {
  const { isLoggedIn } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [simulationId, setSimulationId] = useState<number | null>(null);
  const [scenes, setScenes] = useState<TryADayScene[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [responses, setResponses] = useState<Responses>({});
  const [emotion, setEmotion] = useState(3);
  const [comfort, setComfort] = useState(60);
  const [debrief, setDebrief] = useState<TryADayDebrief | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [loginGate, setLoginGate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctaCopy = ctaByJourney[journeyType ?? ""] ?? ctaByJourney.indeciso;
  const activeScene = scenes[activeIndex] ?? null;

  useEffect(() => {
    if (!isLoggedIn) return;
    getJson<{ completed: boolean; completedAt?: string; debrief?: TryADayDebrief }>(
      `/api/simulated-days/by-profession/${role.id}`,
    )
      .then((state) => {
        if (state.completed) {
          setCompletedAt(state.completedAt ?? null);
          setDebrief(state.debrief ?? null);
        }
      })
      .catch(() => {});
  }, [isLoggedIn, role.id]);

  useEffect(() => {
    onSceneChange?.(activeScene?.timeBlock ?? null);
  }, [activeScene?.timeBlock, onSceneChange]);

  const completedDate = useMemo(() => {
    if (!completedAt) return null;
    return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" }).format(new Date(completedAt));
  }, [completedAt]);

  async function startSimulation() {
    setExpanded(true);
    setLoginGate(false);
    setError(null);
    if (scenes.length > 0) return;

    if (!isLoggedIn) {
      setScenes(buildPreviewScenes(role));
      setSimulationId(null);
      return;
    }

    setLoading(true);
    try {
      const generated = await postJson<{
        simulationId: number;
        scenes: TryADayScene[];
        completedAt: string | null;
      }>("/api/simulated-days/generate", { professionId: role.id });
      setSimulationId(generated.simulationId);
      setScenes(generated.scenes);
      setCompletedAt(generated.completedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Non riesco a generare la giornata ora.");
    } finally {
      setLoading(false);
    }
  }

  function patchResponse(block: TimeBlock, patch: SceneResponse) {
    setResponses((prev) => ({
      ...prev,
      [block]: { ...prev[block], ...patch },
    }));
  }

  async function continueFromScene() {
    if (!activeScene) return;
    const nextResponses = {
      ...responses,
      [activeScene.timeBlock]: {
        ...responses[activeScene.timeBlock],
        ...(activeScene.interaction.type === "comfort_slider" ? { comfort } : {}),
        emotion,
      },
    };
    setResponses(nextResponses);
    setEmotion(3);

    if (!isLoggedIn) {
      setLoginGate(true);
      return;
    }

    if (activeIndex < scenes.length - 1) {
      setActiveIndex((value) => value + 1);
      return;
    }

    if (!simulationId) return;
    setLoading(true);
    try {
      const completed = await postJson<{
        debrief: TryADayDebrief;
        completedAt: string | null;
      }>(`/api/simulated-days/${simulationId}/complete`, { responses: nextResponses });
      setDebrief(completed.debrief);
      setCompletedAt(completed.completedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Non riesco a salvare il debrief ora.");
    } finally {
      setLoading(false);
    }
  }

  const continueLabel =
    activeIndex === 0
      ? "Continua al pomeriggio"
      : activeIndex === 1
        ? "Continua alla sera"
        : "Vedi debrief";

  return (
    <section className="mb-12 rounded-2xl border bg-card p-5 shadow-sm md:p-6" aria-label="Prova questa giornata">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              Try-a-Day
            </Badge>
            {completedDate && (
              <Badge variant="outline" className="rounded-full text-emerald-700">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Provata il {completedDate}
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-serif font-bold md:text-2xl">
            Vuoi vedere com'è davvero una giornata da {role.title}?
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Provala in tre momenti guidati: {ctaCopy}, senza uscire dalla scheda professione.
          </p>
        </div>
        <Button onClick={startSimulation} disabled={loading} className="min-h-11 shrink-0 rounded-full">
          <Sparkles className="mr-2 h-4 w-4" />
          {expanded ? "Riapri" : "Provala"}
          <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </Button>
      </div>

      {expanded && (
        <div className="mt-6 space-y-5">
          <Timeline scenes={scenes} activeIndex={activeIndex} />
          {loading && <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Sto preparando la giornata...</div>}
          {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
          {activeScene && !debrief && (
            <SceneCard
              scene={activeScene}
              response={responses[activeScene.timeBlock]}
              emotion={emotion}
              comfort={comfort}
              onEmotionChange={setEmotion}
              onComfortChange={setComfort}
              onPatchResponse={(patch) => patchResponse(activeScene.timeBlock, patch)}
              onContinue={continueFromScene}
              continueLabel={continueLabel}
              loading={loading}
            />
          )}
          {loginGate && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Accedi per completare e salvare questa esperienza nel profilo.</p>
              </div>
            </div>
          )}
          {debrief && <DebriefPanel debrief={debrief} />}
        </div>
      )}
    </section>
  );
}

function Timeline({ scenes, activeIndex }: { scenes: TryADayScene[]; activeIndex: number }) {
  return (
    <div className="grid gap-2 md:grid-cols-3" aria-label="Timeline Try-a-Day">
      {(["morning", "afternoon", "evening"] as TimeBlock[]).map((block, index) => (
        <div
          key={block}
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            index === activeIndex && scenes.length > 0
              ? "border-primary bg-primary/5 text-primary"
              : index < activeIndex
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "bg-muted/30 text-muted-foreground",
          )}
        >
          <div className="font-semibold">{blockLabels[block]}</div>
          <div className="text-xs">{index < activeIndex ? "Completata" : index === activeIndex && scenes.length > 0 ? "Attiva" : "Bloccata"}</div>
        </div>
      ))}
    </div>
  );
}

interface SceneCardProps {
  scene: TryADayScene;
  response: SceneResponse | undefined;
  emotion: number;
  comfort: number;
  onEmotionChange: (value: number) => void;
  onComfortChange: (value: number) => void;
  onPatchResponse: (patch: SceneResponse) => void;
  onContinue: () => void;
  continueLabel: string;
  loading: boolean;
}

function SceneCard({
  scene,
  response,
  emotion,
  comfort,
  onEmotionChange,
  onComfortChange,
  onPatchResponse,
  onContinue,
  continueLabel,
  loading,
}: SceneCardProps) {
  return (
    <article className="rounded-2xl border bg-background p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-primary" />
        {blockLabels[scene.timeBlock]}
      </div>
      <h3 className="mb-3 text-xl font-semibold">{scene.title}</h3>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{scene.narrative}</p>
      <div className="mb-5 rounded-xl bg-muted/40 p-4 text-sm">
        <strong className="text-foreground">Perché conta: </strong>
        <span className="text-muted-foreground">{scene.taskImportance}</span>
      </div>
      <InteractionControl scene={scene} response={response} comfort={comfort} onComfortChange={onComfortChange} onPatchResponse={onPatchResponse} />
      <div className="mt-5 space-y-2">
        <label className="text-sm font-medium" htmlFor={`emotion-${scene.timeBlock}`}>
          Energia emotiva: {scene.emotionalPrompt}
        </label>
        <div className="flex items-center gap-3">
          <span aria-hidden>Stanca</span>
          <input
            id={`emotion-${scene.timeBlock}`}
            aria-label="Energia emotiva"
            className="h-11 flex-1 accent-primary"
            max={5}
            min={1}
            type="range"
            value={emotion}
            onChange={(event) => onEmotionChange(Number(event.target.value))}
          />
          <span aria-hidden>Carica</span>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onContinue} disabled={loading} className="min-h-11 rounded-full">
          {continueLabel}
        </Button>
      </div>
    </article>
  );
}

function InteractionControl({
  scene,
  response,
  comfort,
  onComfortChange,
  onPatchResponse,
}: {
  scene: TryADayScene;
  response: SceneResponse | undefined;
  comfort: number;
  onComfortChange: (value: number) => void;
  onPatchResponse: (patch: SceneResponse) => void;
}) {
  const interaction = scene.interaction;
  if (interaction.type === "comfort_slider") {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor={`comfort-${scene.timeBlock}`}>
          Comfort
        </label>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{interaction.minLabel}</span>
          <input
            id={`comfort-${scene.timeBlock}`}
            aria-label="Comfort"
            className="h-11 flex-1 accent-primary"
            max={100}
            min={0}
            type="range"
            value={comfort}
            onChange={(event) => onComfortChange(Number(event.target.value))}
          />
          <span>{interaction.maxLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{interaction.prompt}</p>
      <div className="grid gap-2">
        {interaction.options.map((option) => {
          const selected =
            response?.choiceId === option.id || response?.orderedIds?.[0] === option.id;
          return (
            <Button
              key={option.id}
              type="button"
              variant={selected ? "default" : "outline"}
              className="min-h-11 justify-start whitespace-normal rounded-xl text-left"
              onClick={() => {
                if (interaction.type === "choice") {
                  onPatchResponse({ choiceId: option.id });
                } else {
                  onPatchResponse({
                    orderedIds: [option.id, ...interaction.options.filter((item) => item.id !== option.id).map((item) => item.id)],
                  });
                }
              }}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function DebriefPanel({ debrief }: { debrief: TryADayDebrief }) {
  const entries = [
    ["Energia", debrief.radar.energy],
    ["Interesse", debrief.radar.interest],
    ["Competenza percepita", debrief.radar.perceivedCompetence],
    ["Valori allineati", debrief.radar.valuesAlignment],
  ] as const;

  return (
    <div className="rounded-2xl border bg-primary/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold">Debrief della giornata</h3>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{debrief.summary}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-background p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">{label}</span>
              <span className="font-bold">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
            </div>
          </div>
        ))}
      </div>
      {debrief.highlights.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {debrief.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              {highlight}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildPreviewScenes(role: RoleForTryADay): TryADayScene[] {
  const skill = role.skills[0] ?? "ascolto attivo";
  return [
    {
      timeBlock: "morning",
      title: `Mattina da ${role.title}`,
      narrative: `Inizi con una richiesta concreta del settore ${role.sector}. Devi capire che cosa conta, quali vincoli rispettare e quale primo passo sblocca valore. Usi ${skill} per leggere la situazione senza perdere il contesto.`,
      taskImportance: "Questa preview ti fa assaggiare il ritmo del ruolo; per completare e salvare serve l'accesso.",
      interaction: {
        type: "choice",
        prompt: "Quale prima mossa scegli?",
        options: [
          { id: "investigate", label: "Analizzo i dati", signal: "analisi", value: 90 },
          { id: "align", label: "Allineo persone e aspettative", signal: "collaborazione", value: 76 },
          { id: "execute", label: "Provo una soluzione rapida", signal: "azione", value: 64 },
        ],
      },
      emotionalPrompt: "Quanto ti carica questo inizio?",
      signals: { skills: [skill], values: ["chiarezza"], energy: 70, interest: 75, competence: 65 },
    },
  ];
}
