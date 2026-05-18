import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Copy,
  FlaskConical,
  Info,
  Lightbulb,
  LineChart,
  Loader2,
  Megaphone,
  MessageSquareText,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-fetch";
import { usePageModule } from "@/hooks/usePageModule";
import { useWendy } from "@/contexts/WendyProvider";

type IdeaStatus = "draft" | "in_validation" | "validated" | "discarded";
type SaveState = "idle" | "saving" | "saved" | "error";
type RadarState = "idle" | "loading" | "error";
type ExperimentAction = "objective" | "calendar" | "reminder" | "complete";
type ScoreKey = "problem" | "audience" | "solution" | "market" | "execution";
type CanvasKey = (typeof CANVAS_FIELDS)[number]["key"];
type ExperimentStatus = "planned" | "running" | "completed" | "discarded";
type GuidedStep = "describe" | "sense" | "test" | "decide";
type DecisionState =
  | "unclear"
  | "needs_test"
  | "promising"
  | "validated"
  | "discard"
  | "ready_for_ops";
type TimelineEventType =
  | "idea_created"
  | "canvas_updated"
  | "wendy_feedback"
  | "experiment_created"
  | "experiment_completed"
  | "score_updated"
  | "status_changed"
  | "decision_changed";

type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type MarketInsight = {
  currentAlternative: string;
  pricingPositioning: string;
  strengthsWeaknesses: string;
  opportunities: string;
};

type CompetitorEntry = {
  id: string;
  name: string;
  url: string;
  positioning: string;
  price: string;
  strengths: string;
  weaknesses: string;
  opportunity: string;
  createdAt: string;
  updatedAt: string;
};

type GuidedExperiment = {
  id: string;
  template: string;
  title: string;
  objective: string;
  hypothesis: string;
  metric: string;
  expectedResult: string;
  deadline: string;
  outcome: string;
  status: ExperimentStatus;
  objectiveId?: number;
  calendarEventId?: number;
  reminderEventId?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type IdeaValidationData = {
  canvas?: Partial<Record<CanvasKey, string>> & Record<string, string | undefined>;
  scores?: Partial<Record<ScoreKey, number>>;
  scoreReasons?: Partial<Record<ScoreKey, string>>;
  scoreSuggestions?: Partial<Record<ScoreKey, string>>;
  scoreGeneratedAt?: string;
  scoreModel?: string;
  assumption?: string;
  experiment?: string;
  experiments?: GuidedExperiment[];
  activeExperimentId?: string;
  market?: Partial<MarketInsight>;
  competitors?: CompetitorEntry[];
  activeCompetitorId?: string;
  lastWendyAdvice?: string;
  timeline?: TimelineEvent[];
  decisionState?: DecisionState;
  decisionReason?: string;
  decisionUpdatedAt?: string;
  decisionSuggested?: DecisionSuggestion;
  oneLiner?: string;
  uiVersion?: string;
};

type BusinessIdea = {
  id: number;
  title: string;
  ideaText: string;
  status: IdeaStatus;
  validationScore: number | null;
  validationData: IdeaValidationData | null;
  createdAt: string;
  updatedAt: string;
};

type RadarSuggestion = {
  scores: Record<ScoreKey, number>;
  reasons: Record<ScoreKey, string>;
  suggestions: Record<ScoreKey, string>;
  generatedAt: string;
  model: string;
};

type DecisionSuggestion = {
  state: DecisionState;
  reason: string;
  confidence: number;
  nextActions: string[];
  generatedAt: string;
  model: string;
};

const BASE = import.meta.env.BASE_URL || "/";

const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "Bozza",
  in_validation: "In validazione",
  validated: "Validata",
  discarded: "Scartata",
};

const DECISION_LABELS: Record<DecisionState, string> = {
  unclear: "Da chiarire",
  needs_test: "Da testare",
  promising: "Promettente",
  validated: "Validata",
  discard: "Da scartare",
  ready_for_ops: "Pronta per piano operativo",
};

const DECISION_HINTS: Record<DecisionState, string> = {
  unclear: "Mancano dati chiave su problema, target o soluzione.",
  needs_test: "L'idea ha una direzione, ma servono esperimenti concreti.",
  promising: "I segnali sono buoni, ma serve ancora validazione.",
  validated: "Le prove raccolte sono sufficienti per considerarla validata.",
  discard: "I segnali indicano che non conviene continuare ora.",
  ready_for_ops: "L'idea puo diventare piano operativo con task e calendario.",
};

const GUIDED_STEPS: Array<{
  id: GuidedStep;
  title: string;
  shortTitle: string;
  description: string;
  wendyPrompt: string;
}> = [
  {
    id: "describe",
    title: "Descrivi l'idea",
    shortTitle: "Descrivi",
    description: "Parti da parole semplici: cosa vuoi creare, per chi e quale problema risolve.",
    wendyPrompt:
      "Aiutami a compilare lo step Descrivi l'idea. Rendimi piu chiari pitch, problema, cliente ideale e soluzione usando parole semplici.",
  },
  {
    id: "sense",
    title: "Capisci se ha senso",
    shortTitle: "Valuta",
    description: "Guarda segnali, rischi, mercato e quanto l'idea e pronta prima di investirci troppo.",
    wendyPrompt:
      "Aiutami nello step Capisci se ha senso. Usa radar, prove raccolte, rischi e competitor per spiegarmi cosa e forte e cosa manca.",
  },
  {
    id: "test",
    title: "Testa sul campo",
    shortTitle: "Testa",
    description: "Trasforma l'idea in un piccolo test reale, collegato a task e calendario.",
    wendyPrompt:
      "Aiutami nello step Testa sul campo. Suggerisci un esperimento semplice, misurabile e collegabile a task o calendario.",
  },
  {
    id: "decide",
    title: "Decidi il prossimo passo",
    shortTitle: "Decidi",
    description: "Scegli se chiarire, testare, continuare, validare o scartare l'idea.",
    wendyPrompt:
      "Aiutami nello step Decidi il prossimo passo. Usa tutta la storia dell'idea e consigliami una decisione, senza salvarla automaticamente.",
  },
];

const STEP_ACTIONS: Record<GuidedStep, string[]> = {
  describe: [
    "Scrivi il pitch in una frase.",
    "Compila problema, cliente ideale e soluzione.",
    "Chiedi a Wendy di rendere l'idea piu chiara.",
  ],
  sense: [
    "Fai valutare il radar da Wendy.",
    "Aggiungi prove, rischi e almeno un'alternativa.",
    "Controlla se il target e troppo generico.",
  ],
  test: [
    "Scegli un template di esperimento.",
    "Crea task o evento calendario.",
    "Registra l'esito quando hai dati reali.",
  ],
  decide: [
    "Rileggi timeline e decisione attuale.",
    "Chiedi un consiglio finale a Wendy.",
    "Approva o scegli manualmente il prossimo passo.",
  ],
};

const FIELD_HELP: Record<string, { meaning: string; example: string; write: string }> = {
  ideaName: {
    meaning: "Il nome con cui riconosci questa idea nella tua lista.",
    example: "Tutor AI per freelance.",
    write: "Usa un nome breve, non perfetto: potrai cambiarlo dopo.",
  },
  pitch: {
    meaning: "Una frase che dice chi aiuti, cosa ottiene e quale fatica eviti.",
    example: "Aiuta freelance junior a trovare clienti senza perdere ore su candidature casuali.",
    write: "Formula: Aiuta [persona] a ottenere [risultato] senza [problema].",
  },
  status: {
    meaning: "Lo stato di lavoro interno dell'idea, separato dalla decisione finale.",
    example: "Bozza quando stai ancora scrivendo, In validazione quando stai testando.",
    write: "Cambialo solo per organizzarti, non serve che sia perfetto.",
  },
  customer: {
    meaning: "La persona precisa per cui stai creando questa idea.",
    example: "Freelance designer nei primi 12 mesi di attivita.",
    write: "Evita 'tutti': scegli un gruppo riconoscibile e raggiungibile.",
  },
  problem: {
    meaning: "Il problema concreto che qualcuno vive abbastanza spesso da volerlo risolvere.",
    example: "Perdere clienti perche non si riesce a rispondere velocemente ai preventivi.",
    write: "Descrivi chi lo vive, quando succede e cosa costa ignorarlo.",
  },
  solution: {
    meaning: "Il modo semplice in cui vuoi aiutare quella persona a ottenere un risultato.",
    example: "Un assistente che prepara preventivi chiari partendo da poche domande.",
    write: "Scrivi cosa fa la prima versione, non il prodotto perfetto.",
  },
  differentiation: {
    meaning: "Il motivo per cui una persona dovrebbe scegliere te invece di alternative gia note.",
    example: "Meno configurazione, linguaggio piu semplice, pensato solo per freelance junior.",
    write: "Confrontati con l'alternativa attuale e scegli un vantaggio concreto.",
  },
  channels: {
    meaning: "I posti o modi con cui puoi raggiungere le prime persone interessate.",
    example: "Post LinkedIn, community freelance, referral da commercialisti.",
    write: "Scegli 1-2 canali testabili subito, non una strategia completa.",
  },
  monetization: {
    meaning: "Come l'idea potrebbe generare ricavi se i test confermano interesse.",
    example: "Abbonamento mensile, servizio fatto-per-te, commissione sul risultato.",
    write: "Indica chi paga e quale prezzo potresti provare per primo.",
  },
  evidence: {
    meaning: "Segnali raccolti fuori dalla tua testa: conversazioni, dati, richieste, competitor.",
    example: "3 persone hanno chiesto una demo o hanno detto che pagherebbero.",
    write: "Scrivi prove reali, anche piccole. Se non ne hai, lascia chiaro cosa manca.",
  },
  risks: {
    meaning: "Le cose che potrebbero rendere l'idea poco utile, troppo costosa o difficile da vendere.",
    example: "Il target non paga, serve integrazione tecnica complessa, acquisizione troppo cara.",
    write: "Elenca i dubbi principali e trasformali in test.",
  },
  radar: {
    meaning: "Una lettura veloce di quanto l'idea e pronta su 5 criteri.",
    example: "Pubblico 2/5 significa che il target e ancora troppo vago.",
    write: "Usalo come bussola, non come voto definitivo.",
  },
  experiment: {
    meaning: "Un piccolo test reale per capire se vale la pena continuare.",
    example: "Intervistare 5 persone o pubblicare una landing con form di interesse.",
    write: "Scegli un test che puoi fare in pochi giorni e misurare chiaramente.",
  },
  decision: {
    meaning: "Il prossimo stato strategico dell'idea, approvato da te.",
    example: "Da testare se hai una buona direzione ma mancano prove.",
    write: "Fatti aiutare da Wendy, poi approva solo se la motivazione ti convince.",
  },
};

const TIMELINE_META: Record<
  TimelineEventType,
  { label: string; icon: typeof Lightbulb; tone: string }
> = {
  idea_created: {
    label: "Creazione",
    icon: Lightbulb,
    tone: "border-primary/30 bg-primary/10 text-primary",
  },
  canvas_updated: {
    label: "Canvas",
    icon: ClipboardCheck,
    tone: "border-blue-300/40 bg-blue-100/60 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100",
  },
  wendy_feedback: {
    label: "Wendy",
    icon: BrainCircuit,
    tone: "border-violet-300/40 bg-violet-100/60 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100",
  },
  experiment_created: {
    label: "Esperimento",
    icon: FlaskConical,
    tone: "border-emerald-300/40 bg-emerald-100/60 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
  experiment_completed: {
    label: "Completato",
    icon: CheckCircle2,
    tone: "border-green-300/40 bg-green-100/60 text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-100",
  },
  score_updated: {
    label: "Radar",
    icon: LineChart,
    tone: "border-amber-300/40 bg-amber-100/60 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  },
  status_changed: {
    label: "Stato",
    icon: Sparkles,
    tone: "border-border bg-background text-foreground",
  },
  decision_changed: {
    label: "Decisione",
    icon: CheckCircle2,
    tone: "border-primary/30 bg-primary/10 text-primary",
  },
};

const SCORE_LABELS: Record<ScoreKey, { label: string; hint: string }> = {
  problem: { label: "Problema", hint: "Quanto è reale e urgente?" },
  audience: { label: "Pubblico", hint: "Quanto è chiaro il target?" },
  solution: { label: "Soluzione", hint: "Quanto è concreta l'offerta?" },
  market: { label: "Mercato", hint: "Quanto è visibile la domanda?" },
  execution: { label: "Esecuzione", hint: "Quanto è fattibile partire?" },
};

const CANVAS_FIELDS = [
  {
    key: "problem",
    title: "Problema",
    icon: Target,
    questions: [
      "Chi soffre il problema?",
      "Quando succede?",
      "Quanto costa ignorarlo?",
    ],
    placeholder: "Sintetizza il problema reale, il contesto in cui appare e perche e urgente.",
  },
  {
    key: "customer",
    title: "Cliente ideale",
    questions: [
      "Chi compra o usa?",
      "Che ruolo ha?",
      "Dove lo trovi?",
    ],
    icon: Users,
    placeholder: "Descrivi il cliente ideale, il suo ruolo e il primo segmento da raggiungere.",
  },
  {
    key: "solution",
    title: "Soluzione",
    questions: [
      "Cosa offri?",
      "Quale risultato promette?",
      "Cosa fa il primo MVP?",
    ],
    icon: Lightbulb,
    placeholder: "Spiega la soluzione in modo concreto, includendo la prima versione testabile.",
  },
  {
    key: "differentiation",
    title: "Differenziazione",
    questions: [
      "Perche scegliere te?",
      "Qual e l'alternativa attuale?",
      "Quale vantaggio e difficile da copiare?",
    ],
    icon: Sparkles,
    placeholder: "Chiarisci cosa rende l'idea diversa e piu forte delle alternative esistenti.",
  },
  {
    key: "channels",
    title: "Canali",
    questions: [
      "Come trovi i primi utenti?",
      "Quali canali testare?",
      "Quale messaggio iniziale?",
    ],
    icon: Megaphone,
    placeholder: "Indica i canali di acquisizione iniziali e il messaggio da testare.",
  },
  {
    key: "monetization",
    title: "Monetizzazione",
    questions: [
      "Chi paga?",
      "Quanto potrebbe pagare?",
      "Abbonamento, servizio o commissione?",
    ],
    icon: BriefcaseBusiness,
    placeholder: "Definisci come l'idea puo generare ricavi e quale modello provare per primo.",
  },
  {
    key: "evidence",
    title: "Prove raccolte",
    questions: [
      "Hai interviste o feedback?",
      "Ci sono preordini, dati o segnali?",
      "Cosa fanno i competitor?",
    ],
    icon: LineChart,
    placeholder: "Raccogli prove, feedback, dati, competitor o segnali che riducono l'incertezza.",
    legacyPlaceholder: "Quali prove mostrano che puo funzionare?",
  },
  {
    key: "risks",
    title: "Rischi",
    questions: [
      "Cosa puo invalidare l'idea?",
      "Quali dipendenze sono critiche?",
      "Dove rischi su tecnologia, mercato o acquisizione?",
    ],
    icon: ShieldAlert,
    placeholder: "Elenca i rischi principali e cosa dovresti verificare prima di investire di piu.",
  },
] as const;

const DEFAULT_CANVAS = CANVAS_FIELDS.reduce(
  (acc, field) => ({ ...acc, [field.key]: "" }),
  {} as Record<CanvasKey, string>,
);

function normalizeCanvas(
  source?: IdeaValidationData["canvas"] | null,
): Record<CanvasKey, string> {
  return {
    ...DEFAULT_CANVAS,
    ...(source ?? {}),
    customer: source?.customer ?? source?.audience ?? "",
    channels: source?.channels ?? source?.channel ?? "",
    monetization: source?.monetization ?? source?.business ?? "",
    evidence: source?.evidence ?? source?.signals ?? "",
  };
}

const DEFAULT_SCORES: Record<ScoreKey, number> = {
  problem: 2,
  audience: 2,
  solution: 2,
  market: 2,
  execution: 2,
};

const EMPTY_SCORE_TEXT: Record<ScoreKey, string> = {
  problem: "",
  audience: "",
  solution: "",
  market: "",
  execution: "",
};

const DEFAULT_MARKET: MarketInsight = {
  currentAlternative: "",
  pricingPositioning: "",
  strengthsWeaknesses: "",
  opportunities: "",
};

const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {
  planned: "Pianificato",
  running: "In corso",
  completed: "Completato",
  discarded: "Scartato",
};

const EXPERIMENT_TEMPLATES: Array<
  Pick<
    GuidedExperiment,
    "template" | "title" | "objective" | "hypothesis" | "metric" | "expectedResult"
  >
> = [
  {
    template: "user_interviews",
    title: "Intervista a 5 potenziali utenti",
    objective: "Capire se il problema e reale, frequente e costoso per un segmento preciso.",
    hypothesis: "Almeno 3 persone su 5 riconoscono il problema e hanno gia provato soluzioni alternative.",
    metric: "Numero di interviste completate e persone che dichiarano urgenza alta.",
    expectedResult: "3/5 confermano problema, contesto d'uso e disponibilita a provare una soluzione.",
  },
  {
    template: "landing_page",
    title: "Landing page test",
    objective: "Misurare interesse reale verso la promessa dell'idea.",
    hypothesis: "Una pagina semplice genera iscrizioni o richieste demo dal target.",
    metric: "Visite, conversion rate, iscrizioni, click sulla CTA.",
    expectedResult: "Almeno 5 iscrizioni qualificate o conversion rate sopra il 5%.",
  },
  {
    template: "linkedin_post",
    title: "Post LinkedIn test",
    objective: "Testare messaggio, problema e promessa davanti a un pubblico reale.",
    hypothesis: "Il post genera conversazioni o segnali da persone in target.",
    metric: "Commenti utili, DM, salvataggi, richieste di approfondimento.",
    expectedResult: "Almeno 3 conversazioni qualificate o segnali espliciti di interesse.",
  },
  {
    template: "interest_form",
    title: "Form di interesse",
    objective: "Raccogliere adesioni e dati qualitativi da potenziali utenti.",
    hypothesis: "Le persone lasciano contatto e descrivono il problema con parole proprie.",
    metric: "Compilazioni, qualita risposte, email lasciate.",
    expectedResult: "Almeno 10 risposte o 5 contatti molto pertinenti.",
  },
  {
    template: "prototype",
    title: "Mockup/prototipo",
    objective: "Verificare se il flusso della soluzione e comprensibile prima di costruire.",
    hypothesis: "Gli utenti capiscono il valore guardando o provando il prototipo.",
    metric: "Task completati, domande ricorrenti, parti confuse, feedback sul valore.",
    expectedResult: "Almeno 4/5 utenti capiscono la promessa e completano il flusso principale.",
  },
  {
    template: "manual_offer",
    title: "Offerta manuale a 3 clienti",
    objective: "Validare disponibilita a pagare con una versione manuale del servizio.",
    hypothesis: "Almeno un cliente accetta una proposta concreta anche senza prodotto completo.",
    metric: "Proposte inviate, risposte, call fissate, pagamenti o preordini.",
    expectedResult: "1 cliente paga, prenota o chiede una proposta dettagliata.",
  },
  {
    template: "competitor_analysis",
    title: "Analisi competitor",
    objective: "Capire alternative, pricing, posizionamento e spazi scoperti.",
    hypothesis: "Esiste un segmento o un bisogno non servito bene dai competitor attuali.",
    metric: "Numero competitor analizzati, pattern prezzo, gap ricorrenti, recensioni negative.",
    expectedResult: "3 gap chiari e una differenziazione testabile.",
  },
];

const WENDY_IDEA_ACTIONS = [
  {
    label: "Trova punti deboli",
    icon: ShieldAlert,
    prompt:
      "Analizza questa idea usando i campi della pagina. Trova i punti deboli piu importanti basandoti su Problema, Cliente ideale, Soluzione, Differenziazione, Prove raccolte, Rischi, radar ed esperimento attivo. Cita i campi specifici che stai usando e chiudi con 3 azioni pratiche.",
  },
  {
    label: "Scrivi 10 domande intervista",
    icon: Users,
    prompt:
      "Scrivi 10 domande per intervistare potenziali utenti. Basati soprattutto su Problema, Cliente ideale, Ipotesi critica e Prove raccolte. Dividi le domande in problema, comportamento attuale, alternative, urgenza e disponibilita a provare.",
  },
  {
    label: "Genera landing page test",
    icon: Megaphone,
    prompt:
      "Genera una landing page test per questa idea usando pitch, Soluzione, Cliente ideale, Canali e Differenziazione. Includi headline, sottotitolo, 3 benefici, CTA, sezione problema, sezione prova/validazione e una domanda finale per raccogliere interesse.",
  },
  {
    label: "Confronta con il mercato",
    icon: LineChart,
    prompt:
      "Confronta questa idea con il mercato usando la sezione Competitor e mercato, Differenziazione, Prove raccolte, Monetizzazione, Rischi e radar. Cita competitor, alternativa attuale, prezzo/posizionamento, punti forti/deboli e opportunita inserite. Evidenzia gap di mercato, rischi competitivi e cosa verificare prima.",
  },
  {
    label: "Suggerisci prossimo esperimento",
    icon: FlaskConical,
    prompt:
      "Suggerisci il prossimo esperimento piu utile per questa idea. Considera radar, Rischi, Prove raccolte ed esperimenti gia presenti. Proponi obiettivo, ipotesi, cosa misurare, risultato atteso, data limite consigliata ed esito da cercare.",
  },
] as const;

function createCompetitor(overrides: Partial<CompetitorEntry> = {}): CompetitorEntry {
  const now = new Date().toISOString();
  return {
    id:
      overrides.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `competitor-${Date.now()}`),
    name: "Nuovo competitor",
    url: "",
    positioning: "",
    price: "",
    strengths: "",
    weaknesses: "",
    opportunity: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createExperimentFromTemplate(
  template = EXPERIMENT_TEMPLATES[0],
  overrides: Partial<GuidedExperiment> = {},
): GuidedExperiment {
  const now = new Date().toISOString();
  return {
    id:
      overrides.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `experiment-${Date.now()}`),
    template: template.template,
    title: template.title,
    objective: template.objective,
    hypothesis: template.hypothesis,
    metric: template.metric,
    expectedResult: template.expectedResult,
    deadline: "",
    outcome: "",
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createTimelineEvent(
  type: TimelineEventType,
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
  createdAt = new Date().toISOString(),
): TimelineEvent {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `timeline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    description,
    createdAt,
    metadata,
  };
}

function normalizeTimeline(value?: TimelineEvent[] | null) {
  if (!Array.isArray(value)) return [];
  return [...value]
    .filter((event) => event?.id && event?.type && event?.title && event?.createdAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function normalizeDecisionSuggestion(value: unknown): DecisionSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Partial<DecisionSuggestion>;
  if (!data.state || !(data.state in DECISION_LABELS) || !data.reason || !data.generatedAt) {
    return null;
  }
  return {
    state: data.state,
    reason: String(data.reason),
    confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : 0,
    nextActions: Array.isArray(data.nextActions) ? data.nextActions.map(String) : [],
    generatedAt: String(data.generatedAt),
    model: String(data.model ?? ""),
  };
}

function suggestGuidedStep(data: IdeaValidationData, fallbackStatus?: IdeaStatus): GuidedStep {
  if (data.decisionState || fallbackStatus === "validated" || fallbackStatus === "discarded") {
    return "decide";
  }
  if (Array.isArray(data.experiments) && data.experiments.length > 0) return "test";
  if (
    data.scoreGeneratedAt ||
    Object.keys(data.scores ?? {}).length > 0 ||
    Array.isArray(data.competitors) && data.competitors.length > 0 ||
    Boolean(data.market?.currentAlternative || data.market?.opportunities)
  ) {
    return "sense";
  }
  return "describe";
}

function normalizeExperiments(data: IdeaValidationData) {
  if (Array.isArray(data.experiments) && data.experiments.length > 0) {
    return data.experiments;
  }
  if (data.experiment?.trim()) {
    return [
      createExperimentFromTemplate(EXPERIMENT_TEMPLATES[0], {
        id: "legacy-experiment",
        template: "legacy",
        title: "Esperimento legacy",
        objective: data.experiment.trim(),
      }),
    ];
  }
  return [];
}

function formatDate(value?: string) {
  if (!value) return "mai";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoHint({
  title,
  meaning,
  example,
  write,
}: {
  title: string;
  meaning: string;
  example: string;
  write: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Spiega ${title}`}
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] rounded-2xl">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{meaning}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Esempio
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{example}</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{write}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function ValidatoreIdea() {
  usePageModule({ pageId: "validatore-idea" });
  const wendy = useWendy();
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasTimelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreTimelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wendyAdviceTimelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
  const [activeIdeaId, setActiveIdeaId] = useState<number | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [activeStep, setActiveStep] = useState<GuidedStep>("describe");

  const [ideaName, setIdeaName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [canvas, setCanvas] = useState(DEFAULT_CANVAS);
  const [scores, setScores] = useState<Record<ScoreKey, number>>(DEFAULT_SCORES);
  const [scoreReasons, setScoreReasons] =
    useState<Partial<Record<ScoreKey, string>>>(EMPTY_SCORE_TEXT);
  const [scoreSuggestions, setScoreSuggestions] =
    useState<Partial<Record<ScoreKey, string>>>(EMPTY_SCORE_TEXT);
  const [scoreGeneratedAt, setScoreGeneratedAt] = useState("");
  const [scoreModel, setScoreModel] = useState("");
  const [proposedScores, setProposedScores] =
    useState<Partial<Record<ScoreKey, number>>>({});
  const [radarState, setRadarState] = useState<RadarState>("idle");
  const [radarError, setRadarError] = useState("");
  const [status, setStatus] = useState<IdeaStatus>("draft");
  const [assumption, setAssumption] = useState("");
  const [experiment, setExperiment] = useState("");
  const [experiments, setExperiments] = useState<GuidedExperiment[]>([]);
  const [activeExperimentId, setActiveExperimentId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(EXPERIMENT_TEMPLATES[0].template);
  const [experimentActionLoading, setExperimentActionLoading] =
    useState<ExperimentAction | null>(null);
  const [experimentActionError, setExperimentActionError] = useState("");
  const [market, setMarket] = useState<MarketInsight>(DEFAULT_MARKET);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [activeCompetitorId, setActiveCompetitorId] = useState("");
  const [lastWendyAdvice, setLastWendyAdvice] = useState("");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [decisionState, setDecisionState] = useState<DecisionState | "">("");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionUpdatedAt, setDecisionUpdatedAt] = useState("");
  const [decisionSuggested, setDecisionSuggested] = useState<DecisionSuggestion | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState("");

  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId) ?? null;
  const activeExperiment =
    experiments.find((item) => item.id === activeExperimentId) ?? experiments[0] ?? null;
  const activeCompetitor =
    competitors.find((item) => item.id === activeCompetitorId) ?? competitors[0] ?? null;
  const activeExperimentSummary = activeExperiment
    ? [
        activeExperiment.title,
        activeExperiment.objective,
        activeExperiment.hypothesis,
        activeExperiment.metric,
      ]
        .filter(Boolean)
        .join(" - ")
    : experiment;
  const activeStepMeta =
    GUIDED_STEPS.find((step) => step.id === activeStep) ?? GUIDED_STEPS[0];
  const visibleCanvasKeys: CanvasKey[] =
    activeStep === "describe"
      ? ["problem", "customer", "solution"]
      : activeStep === "sense"
        ? ["differentiation", "channels", "monetization", "evidence", "risks"]
        : [];
  const guidedProgress = Math.round(
    ([
      Boolean(oneLiner.trim() && canvas.problem.trim() && canvas.customer.trim() && canvas.solution.trim()),
      Boolean(scoreGeneratedAt || canvas.evidence.trim() || canvas.risks.trim() || competitors.length > 0),
      experiments.length > 0,
      Boolean(decisionState),
    ].filter(Boolean).length /
      GUIDED_STEPS.length) *
      100,
  );

  const derivedTimeline = useMemo(() => {
    if (!activeIdea || timeline.length > 0) return [];
    const events: TimelineEvent[] = [];
    if (activeIdea.createdAt) {
      events.push(
        createTimelineEvent(
          "idea_created",
          "Idea creata",
          "Questa idea e stata salvata nel laboratorio.",
          { source: "derived" },
          activeIdea.createdAt,
        ),
      );
    }
    if (scoreGeneratedAt) {
      events.push(
        createTimelineEvent(
          "score_updated",
          "Radar valutato",
          scoreModel ? `Wendy ha proposto una valutazione con ${scoreModel}.` : "Wendy ha proposto una valutazione del radar.",
          { source: "derived", model: scoreModel },
          scoreGeneratedAt,
        ),
      );
    }
    experiments.forEach((item) => {
      if (item.createdAt) {
        events.push(
          createTimelineEvent(
            "experiment_created",
            "Esperimento creato",
            item.title || "Esperimento aggiunto all'idea.",
            { source: "derived", experimentId: item.id },
            item.createdAt,
          ),
        );
      }
      if (item.completedAt) {
        events.push(
          createTimelineEvent(
            "experiment_completed",
            "Esperimento completato",
            item.title || "Esperimento segnato come completato.",
            { source: "derived", experimentId: item.id },
            item.completedAt,
          ),
        );
      }
    });
    if ((status === "validated" || status === "discarded") && activeIdea.updatedAt) {
      events.push(
        createTimelineEvent(
          "status_changed",
          status === "validated" ? "Idea validata" : "Idea scartata",
          `Stato attuale: ${STATUS_LABELS[status]}.`,
          { source: "derived", status },
          activeIdea.updatedAt,
        ),
      );
    }
    return events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [activeIdea, timeline.length, scoreGeneratedAt, scoreModel, experiments, status]);

  const displayTimeline = timeline.length > 0 ? timeline : derivedTimeline;
  const visibleTimeline = showAllTimeline ? displayTimeline : displayTimeline.slice(0, 8);

  const averageScore = useMemo(() => {
    const values = Object.values(scores);
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 20);
  }, [scores]);

  const validationData = useMemo<IdeaValidationData>(
    () => ({
      canvas,
      scores,
      scoreReasons,
      scoreSuggestions,
      scoreGeneratedAt,
      scoreModel,
      assumption,
      experiment: activeExperimentSummary,
      experiments,
      activeExperimentId,
      market,
      competitors,
      activeCompetitorId,
      lastWendyAdvice,
      timeline,
      decisionState: decisionState || undefined,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested: decisionSuggested ?? undefined,
      oneLiner,
      uiVersion: "idea-lab-v1",
    }),
    [
      canvas,
      scores,
      scoreReasons,
      scoreSuggestions,
      scoreGeneratedAt,
      scoreModel,
      assumption,
      activeExperimentSummary,
      experiments,
      activeExperimentId,
      market,
      competitors,
      activeCompetitorId,
      lastWendyAdvice,
      timeline,
      decisionState,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested,
      oneLiner,
    ],
  );

  const ideaContext = useMemo(
    () => ({
      ideaId: activeIdeaId,
      status,
      updatedAt: activeIdea?.updatedAt,
      ideaName,
      oneLiner,
      canvas,
      scores,
      scoreReasons,
      scoreSuggestions,
      scoreGeneratedAt,
      scoreModel,
      averageScore,
      assumption,
      experiment: activeExperimentSummary,
      experiments,
      activeExperimentId,
      activeExperiment,
      market,
      competitors,
      activeCompetitorId,
      activeCompetitor,
      lastWendyAdvice,
      timeline: displayTimeline,
      decisionState,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested,
    }),
    [
      activeIdeaId,
      activeIdea?.updatedAt,
      status,
      ideaName,
      oneLiner,
      canvas,
      scores,
      scoreReasons,
      scoreSuggestions,
      scoreGeneratedAt,
      scoreModel,
      averageScore,
      assumption,
      activeExperimentSummary,
      experiments,
      activeExperimentId,
      activeExperiment,
      market,
      competitors,
      activeCompetitorId,
      activeCompetitor,
      lastWendyAdvice,
      displayTimeline,
      decisionState,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested,
    ],
  );

  const loadIdeaIntoForm = (idea: BusinessIdea) => {
    const data = idea.validationData ?? {};
    setActiveIdeaId(idea.id);
    setIdeaName(idea.title ?? "");
    setOneLiner(data.oneLiner ?? idea.ideaText ?? "");
    setCanvas(normalizeCanvas(data.canvas));
    setScores({ ...DEFAULT_SCORES, ...(data.scores ?? {}) });
    setScoreReasons({ ...EMPTY_SCORE_TEXT, ...(data.scoreReasons ?? {}) });
    setScoreSuggestions({ ...EMPTY_SCORE_TEXT, ...(data.scoreSuggestions ?? {}) });
    setScoreGeneratedAt(data.scoreGeneratedAt ?? "");
    setScoreModel(data.scoreModel ?? "");
    setProposedScores({});
    setRadarError("");
    setRadarState("idle");
    const nextExperiments = normalizeExperiments(data);
    setExperiments(nextExperiments);
    setActiveExperimentId(data.activeExperimentId ?? nextExperiments[0]?.id ?? "");
    setExperimentActionLoading(null);
    setExperimentActionError("");
    setMarket({ ...DEFAULT_MARKET, ...(data.market ?? {}) });
    const nextCompetitors = Array.isArray(data.competitors) ? data.competitors : [];
    setCompetitors(nextCompetitors);
    setActiveCompetitorId(data.activeCompetitorId ?? nextCompetitors[0]?.id ?? "");
    setAssumption(data.assumption ?? "");
    setExperiment(data.experiment ?? "");
    setLastWendyAdvice(data.lastWendyAdvice ?? "");
    setTimeline(normalizeTimeline(data.timeline));
    setShowAllTimeline(false);
    setDecisionState(data.decisionState ?? "");
    setDecisionReason(data.decisionReason ?? "");
    setDecisionUpdatedAt(data.decisionUpdatedAt ?? "");
    setDecisionSuggested(normalizeDecisionSuggestion(data.decisionSuggested));
    setDecisionError("");
    setDecisionLoading(false);
    setStatus(idea.status ?? "draft");
    setActiveStep(suggestGuidedStep(data, idea.status));
    setDirty(false);
    setArchiveConfirm(false);
    setSaveState("idle");
  };

  const markDirty = () => {
    setDirty(true);
    if (saveState === "saved") setSaveState("idle");
  };

  const addTimelineEvent = (
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) => {
    const event = createTimelineEvent(type, title, description, metadata);
    setTimeline((current) => {
      const recentDuplicate = current.find(
        (item) =>
          item.type === type &&
          item.title === title &&
          Date.now() - new Date(item.createdAt).getTime() < 120000,
      );
      if (recentDuplicate) return current;
      return [event, ...current].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
    markDirty();
  };

  const addDebouncedTimelineEvent = (
    timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
    delay = 1200,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      addTimelineEvent(type, title, description, metadata);
      timerRef.current = null;
    }, delay);
  };

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    setError(null);
    try {
      const res = await apiFetch(`${BASE}api/business-ideas`);
      if (!res.ok) throw new Error("Errore nel caricamento delle idee");
      const json = (await res.json()) as { ideas: BusinessIdea[] };
      const nextIdeas = json.ideas ?? [];
      setIdeas(nextIdeas);
      if (nextIdeas.length > 0) {
        const current = activeIdeaId
          ? nextIdeas.find((idea) => idea.id === activeIdeaId)
          : nextIdeas[0];
        if (current) loadIdeaIntoForm(current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento");
    } finally {
      setLoadingIdeas(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (canvasTimelineTimerRef.current) clearTimeout(canvasTimelineTimerRef.current);
      if (scoreTimelineTimerRef.current) clearTimeout(scoreTimelineTimerRef.current);
      if (wendyAdviceTimelineTimerRef.current) clearTimeout(wendyAdviceTimelineTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    wendy.setPageContext({
      page: "validatore-idea",
      title: "Laboratorio Idee",
      data: ideaContext,
    });
  }, [ideaContext, wendy]);

  const persistIdea = async (mode: "create" | "update" = activeIdeaId ? "update" : "create") => {
    setSaveState("saving");
    setError(null);

    const payload = {
      title: ideaName.trim() || "Nuova idea",
      ideaText: oneLiner.trim(),
      status,
      validationScore: averageScore,
      validationData,
    };

    try {
      const res = await apiFetch(
        mode === "update" && activeIdeaId
          ? `${BASE}api/business-ideas/${activeIdeaId}`
          : `${BASE}api/business-ideas`,
        {
          method: mode === "update" && activeIdeaId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Errore salvataggio");
      }

      const json = (await res.json()) as { idea: BusinessIdea };
      setIdeas((current) => {
        const exists = current.some((idea) => idea.id === json.idea.id);
        const next = exists
          ? current.map((idea) => (idea.id === json.idea.id ? json.idea : idea))
          : [json.idea, ...current];
        return next.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });
      setActiveIdeaId(json.idea.id);
      setDirty(false);
      setSaveState("saved");
      setTimeout(() => setSaveState((state) => (state === "saved" ? "idle" : state)), 1800);
      return json.idea;
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Errore salvataggio");
      return null;
    }
  };

  useEffect(() => {
    if (!activeIdeaId || !dirty) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistIdea("update");
    }, 900);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdeaId, dirty, ideaName, oneLiner, status, averageScore, validationData]);

  const createNewIdea = async () => {
    setIdeaName("Nuova idea");
    setOneLiner("");
    setCanvas(DEFAULT_CANVAS);
    setScores(DEFAULT_SCORES);
    setScoreReasons(EMPTY_SCORE_TEXT);
    setScoreSuggestions(EMPTY_SCORE_TEXT);
    setScoreGeneratedAt("");
    setScoreModel("");
    setProposedScores({});
    setRadarError("");
    setRadarState("idle");
    setAssumption("");
    setExperiment("");
    setExperiments([]);
    setActiveExperimentId("");
    setSelectedTemplate(EXPERIMENT_TEMPLATES[0].template);
    setExperimentActionLoading(null);
    setExperimentActionError("");
    setMarket(DEFAULT_MARKET);
    setCompetitors([]);
    setActiveCompetitorId("");
    setLastWendyAdvice("");
    setTimeline([]);
    setShowAllTimeline(false);
    setDecisionState("");
    setDecisionReason("");
    setDecisionUpdatedAt("");
    setDecisionSuggested(null);
    setDecisionError("");
    setDecisionLoading(false);
    setStatus("draft");
    setActiveStep("describe");
    setActiveIdeaId(null);
    setDirty(false);
    setArchiveConfirm(false);
    const created = await persistIdea("create");
    if (created) {
      addTimelineEvent("idea_created", "Idea creata", "Hai creato una nuova idea nel laboratorio.", {
        ideaId: created.id,
      });
    }
  };

  const archiveIdea = async () => {
    if (!activeIdeaId) return;
    if (!archiveConfirm) {
      setArchiveConfirm(true);
      return;
    }
    setSaveState("saving");
    setError(null);
    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${activeIdeaId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error("Errore archiviazione");
      const remaining = ideas.filter((idea) => idea.id !== activeIdeaId);
      setIdeas(remaining);
      if (remaining[0]) loadIdeaIntoForm(remaining[0]);
      else {
        setActiveIdeaId(null);
        setIdeaName("");
        setOneLiner("");
        setCanvas(DEFAULT_CANVAS);
        setScores(DEFAULT_SCORES);
        setScoreReasons(EMPTY_SCORE_TEXT);
        setScoreSuggestions(EMPTY_SCORE_TEXT);
        setScoreGeneratedAt("");
        setScoreModel("");
        setProposedScores({});
        setRadarError("");
        setRadarState("idle");
        setAssumption("");
        setExperiment("");
        setExperiments([]);
        setActiveExperimentId("");
        setSelectedTemplate(EXPERIMENT_TEMPLATES[0].template);
        setExperimentActionLoading(null);
        setExperimentActionError("");
        setMarket(DEFAULT_MARKET);
        setCompetitors([]);
        setActiveCompetitorId("");
        setLastWendyAdvice("");
        setTimeline([]);
        setShowAllTimeline(false);
        setDecisionState("");
        setDecisionReason("");
        setDecisionUpdatedAt("");
        setDecisionSuggested(null);
        setDecisionError("");
        setDecisionLoading(false);
        setStatus("draft");
        setActiveStep("describe");
        setDirty(false);
      }
      setArchiveConfirm(false);
      setSaveState("idle");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Errore archiviazione");
    }
  };

  const askWendy = (focus: string) => {
    wendy.setPageContext({
      page: "validatore-idea",
      title: "Laboratorio Idee",
      data: { ...ideaContext, focus },
    });
    wendy.ask(focus);
    addTimelineEvent("wendy_feedback", "Feedback Wendy richiesto", focus, {
      ideaId: activeIdeaId,
      focus,
    });
  };

  const updateCanvas = (key: CanvasKey, value: string) => {
    setCanvas((current) => ({ ...current, [key]: value }));
    markDirty();
    addDebouncedTimelineEvent(
      canvasTimelineTimerRef,
      "canvas_updated",
      "Canvas aggiornato",
      `Hai modificato il blocco ${CANVAS_FIELDS.find((field) => field.key === key)?.title ?? "canvas"}.`,
      { key },
    );
  };

  const requestRadarSuggestion = async () => {
    setRadarState("loading");
    setRadarError("");

    let ideaId = activeIdeaId;
    if (!ideaId) {
      const created = await persistIdea("create");
      ideaId = created?.id ?? null;
    }

    if (!ideaId) {
      setRadarState("error");
      setRadarError("Salva una bozza prima di chiedere la valutazione a Wendy.");
      return;
    }

    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${ideaId}/radar-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ideaName,
          ideaText: oneLiner,
          canvas,
          assumption,
          experiment: activeExperimentSummary,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Valutazione Wendy non disponibile");
      }

      const suggestion = (await res.json()) as RadarSuggestion;
      setProposedScores(suggestion.scores);
      setScoreReasons(suggestion.reasons);
      setScoreSuggestions(suggestion.suggestions);
      setScoreGeneratedAt(suggestion.generatedAt);
      setScoreModel(suggestion.model);
      setRadarState("idle");
      addTimelineEvent(
        "score_updated",
        "Radar valutato da Wendy",
        "Wendy ha proposto score, motivazioni e suggerimenti per il radar.",
        { model: suggestion.model, generatedAt: suggestion.generatedAt },
      );
      markDirty();
    } catch (err) {
      setRadarState("error");
      setRadarError(err instanceof Error ? err.message : "Valutazione Wendy non disponibile");
    }
  };

  const applyProposedScore = (key: ScoreKey) => {
    const proposed = proposedScores[key];
    if (!proposed) return;
    setScores((current) => ({ ...current, [key]: proposed }));
    setProposedScores((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    addTimelineEvent(
      "score_updated",
      "Score applicato",
      `${SCORE_LABELS[key].label}: applicato ${proposed}/5 dal suggerimento Wendy.`,
      { key, score: proposed },
    );
    markDirty();
  };

  const applyDecision = (
    nextState: DecisionState,
    reason: string,
    source: "manual" | "wendy",
    suggestion?: DecisionSuggestion,
  ) => {
    const now = new Date().toISOString();
    setDecisionState(nextState);
    setDecisionReason(reason);
    setDecisionUpdatedAt(now);
    if (suggestion) setDecisionSuggested(suggestion);
    addTimelineEvent(
      "decision_changed",
      source === "wendy" ? "Decisione approvata" : "Decisione aggiornata",
      `${DECISION_LABELS[nextState]}${reason ? ` - ${reason}` : ""}`,
      { state: nextState, source },
    );
    markDirty();
  };

  const requestDecisionSuggestion = async () => {
    setDecisionLoading(true);
    setDecisionError("");

    let ideaId = activeIdeaId;
    if (!ideaId) {
      const created = await persistIdea("create");
      ideaId = created?.id ?? null;
    }

    if (!ideaId) {
      setDecisionLoading(false);
      setDecisionError("Salva una bozza prima di chiedere una decisione a Wendy.");
      return;
    }

    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${ideaId}/decision-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ideaName,
          ideaText: oneLiner,
          data: ideaContext,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Suggerimento decisione non disponibile");
      }

      const suggestion = (await res.json()) as DecisionSuggestion;
      setDecisionSuggested(suggestion);
      addTimelineEvent(
        "wendy_feedback",
        "Decisione consigliata da Wendy",
        `${DECISION_LABELS[suggestion.state]} - ${suggestion.reason}`,
        { state: suggestion.state, confidence: suggestion.confidence, model: suggestion.model },
      );
      markDirty();
    } catch (err) {
      setDecisionError(
        err instanceof Error ? err.message : "Suggerimento decisione non disponibile",
      );
    } finally {
      setDecisionLoading(false);
    }
  };

  const createExperiment = (templateId = selectedTemplate) => {
    const template =
      EXPERIMENT_TEMPLATES.find((item) => item.template === templateId) ?? EXPERIMENT_TEMPLATES[0];
    const next = createExperimentFromTemplate(template);
    setExperiments((current) => [next, ...current]);
    setActiveExperimentId(next.id);
    setSelectedTemplate(template.template);
    addTimelineEvent("experiment_created", "Esperimento creato", next.title, {
      experimentId: next.id,
      template: next.template,
    });
    markDirty();
  };

  const duplicateActiveExperiment = () => {
    if (!activeExperiment) return;
    const next = createExperimentFromTemplate(EXPERIMENT_TEMPLATES[0], {
      ...activeExperiment,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `experiment-${Date.now()}`,
      title: `${activeExperiment.title} - copia`,
      status: "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setExperiments((current) => [next, ...current]);
    setActiveExperimentId(next.id);
    addTimelineEvent("experiment_created", "Esperimento duplicato", next.title, {
      experimentId: next.id,
      sourceExperimentId: activeExperiment.id,
    });
    markDirty();
  };

  const updateActiveExperiment = <K extends keyof GuidedExperiment>(
    key: K,
    value: GuidedExperiment[K],
  ) => {
    if (!activeExperiment) return;
    const now = new Date().toISOString();
    setExperiments((current) =>
      current.map((item) =>
        item.id === activeExperiment.id ? { ...item, [key]: value, updatedAt: now } : item,
      ),
    );
    if (key === "status" && value === "completed" && activeExperiment.status !== "completed") {
      addTimelineEvent("experiment_completed", "Esperimento completato", activeExperiment.title, {
        experimentId: activeExperiment.id,
      });
    }
    markDirty();
  };

  const patchActiveExperiment = (patch: Partial<GuidedExperiment>) => {
    if (!activeExperiment) return;
    const now = new Date().toISOString();
    setExperiments((current) =>
      current.map((item) =>
        item.id === activeExperiment.id ? { ...item, ...patch, updatedAt: now } : item,
      ),
    );
    markDirty();
  };

  const discardActiveExperiment = () => {
    if (!activeExperiment) return;
    updateActiveExperiment("status", "discarded");
  };

  const experimentDueDate = () => {
    if (activeExperiment?.deadline) return activeExperiment.deadline;
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 7);
    return fallback.toISOString().slice(0, 10);
  };

  const experimentDescription = () => {
    if (!activeExperiment) return "";
    return [
      activeExperiment.objective && `Obiettivo: ${activeExperiment.objective}`,
      activeExperiment.hypothesis && `Ipotesi: ${activeExperiment.hypothesis}`,
      activeExperiment.metric && `Misura: ${activeExperiment.metric}`,
      activeExperiment.expectedResult && `Risultato atteso: ${activeExperiment.expectedResult}`,
      ideaName && `Idea: ${ideaName}`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const createExperimentObjective = async () => {
    if (!activeExperiment || activeExperiment.objectiveId) return;
    setExperimentActionLoading("objective");
    setExperimentActionError("");
    try {
      const res = await apiFetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: activeExperiment.title || "Esperimento idea",
          category: "business",
          dueDate: experimentDueDate(),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Errore nella creazione del task");
      }
      const objective = (await res.json()) as { id: number };
      patchActiveExperiment({ objectiveId: objective.id });
    } catch (err) {
      setExperimentActionError(err instanceof Error ? err.message : "Errore nella creazione del task");
    } finally {
      setExperimentActionLoading(null);
    }
  };

  const createExperimentCalendarEvent = async (
    type: "calendar" | "reminder",
  ) => {
    if (!activeExperiment) return;
    if (type === "calendar" && activeExperiment.calendarEventId) return;
    if (type === "reminder" && activeExperiment.reminderEventId) return;
    setExperimentActionLoading(type);
    setExperimentActionError("");
    try {
      const start = new Date();
      if (type === "reminder") start.setDate(start.getDate() + 7);
      else if (activeExperiment.deadline) {
        const [year, month, day] = activeExperiment.deadline.split("-").map(Number);
        if (year && month && day) start.setFullYear(year, month - 1, day);
      }
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(type === "reminder" ? 9 : 10, type === "reminder" ? 30 : 0, 0, 0);

      const res = await apiFetch(`${BASE}api/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            type === "reminder"
              ? `Promemoria: ${activeExperiment.title || "esperimento idea"}`
              : activeExperiment.title || "Esperimento idea",
          description: experimentDescription(),
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          allDay: false,
          category: "task",
          priority: "medium",
          status: "todo",
          tags: ["idea", "esperimento"],
          linkedContentIds: [],
          isRecurring: false,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Errore nella creazione dell'evento");
      }
      const event = (await res.json()) as { id: number };
      patchActiveExperiment(
        type === "reminder" ? { reminderEventId: event.id } : { calendarEventId: event.id },
      );
    } catch (err) {
      setExperimentActionError(
        err instanceof Error ? err.message : "Errore nella creazione dell'evento",
      );
    } finally {
      setExperimentActionLoading(null);
    }
  };

  const completeActiveExperiment = async () => {
    if (!activeExperiment) return;
    setExperimentActionLoading("complete");
    setExperimentActionError("");
    try {
      if (activeExperiment.objectiveId) {
        const res = await apiFetch(`${BASE}api/objectives/${activeExperiment.objectiveId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!res.ok && res.status !== 404) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Errore nel completamento del task");
        }
      }
      patchActiveExperiment({
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      addTimelineEvent("experiment_completed", "Esperimento completato", activeExperiment.title, {
        experimentId: activeExperiment.id,
        objectiveId: activeExperiment.objectiveId,
      });
    } catch (err) {
      setExperimentActionError(
        err instanceof Error ? err.message : "Errore nel completamento dell'esperimento",
      );
    } finally {
      setExperimentActionLoading(null);
    }
  };

  const updateMarket = (key: keyof MarketInsight, value: string) => {
    setMarket((current) => ({ ...current, [key]: value }));
    markDirty();
  };

  const addCompetitor = () => {
    const next = createCompetitor();
    setCompetitors((current) => [next, ...current]);
    setActiveCompetitorId(next.id);
    markDirty();
  };

  const duplicateActiveCompetitor = () => {
    if (!activeCompetitor) return;
    const next = createCompetitor({
      ...activeCompetitor,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `competitor-${Date.now()}`,
      name: `${activeCompetitor.name || "Competitor"} - copia`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCompetitors((current) => [next, ...current]);
    setActiveCompetitorId(next.id);
    markDirty();
  };

  const updateActiveCompetitor = <K extends keyof CompetitorEntry>(
    key: K,
    value: CompetitorEntry[K],
  ) => {
    if (!activeCompetitor) return;
    const now = new Date().toISOString();
    setCompetitors((current) =>
      current.map((item) =>
        item.id === activeCompetitor.id ? { ...item, [key]: value, updatedAt: now } : item,
      ),
    );
    markDirty();
  };

  const removeActiveCompetitor = () => {
    if (!activeCompetitor) return;
    const remaining = competitors.filter((item) => item.id !== activeCompetitor.id);
    setCompetitors(remaining);
    setActiveCompetitorId(remaining[0]?.id ?? "");
    markDirty();
  };

  const saveLabel =
    saveState === "saving"
      ? "Salvataggio..."
      : saveState === "saved"
        ? "Salvato"
        : saveState === "error"
          ? "Errore salvataggio"
          : dirty
            ? "Modifiche non salvate"
            : "Pronto";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:pt-12">
      <section className="mb-6 grid gap-4 lg:grid-cols-[320px_1fr]">
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
                  {STEP_ACTIONS[activeStep].map((action) => (
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

          <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr_180px]">
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nome idea
                <InfoHint title="Nome idea" {...FIELD_HELP.ideaName} />
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
                <InfoHint title="Pitch in una frase" {...FIELD_HELP.pitch} />
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
                <InfoHint title="Stato" {...FIELD_HELP.status} />
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
      </section>

      {activeStep === "decide" && (
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
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Target className="h-4 w-4 text-primary" />
              Problema principale
            </div>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {canvas.problem.trim() || "Problema da chiarire"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" />
              Target
            </div>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {canvas.customer.trim() || "Target da definire"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Prossimo esperimento
            </div>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {experiment.trim() || "Nessun esperimento impostato"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageSquareText className="h-4 w-4 text-primary" />
              Ultimo consiglio Wendy
            </div>
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
              {lastWendyAdvice.trim() || "Aggiungi o chiedi a Wendy un consiglio"}
            </p>
          </div>
        </div>
      </section>
      )}

      {activeStep === "decide" && (
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
              Appena salvi, modifichi il canvas, chiedi feedback a Wendy o completi un esperimento, qui apparira la storia dell'idea.
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
      )}

      {activeStep === "decide" && (
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
              Wendy puo consigliarti lo stato, ma la decisione viene salvata solo quando la approvi o la scegli manualmente.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-full gap-2"
            onClick={requestDecisionSuggestion}
            disabled={decisionLoading || saveState === "saving"}
          >
            {decisionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrainCircuit className="h-4 w-4" />
            )}
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
              placeholder="Perche questa e la decisione giusta ora?"
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
      )}

      {activeStep === "decide" && (
      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Azioni Wendy</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Wendy legge canvas, radar ed esperimenti: non sostituisce la pagina, lavora sopra i dati che hai gia inserito.
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
      )}

      {(activeStep === "describe" || activeStep === "sense") && (
      <section className="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3 md:grid-cols-2">
          {CANVAS_FIELDS.filter(({ key }) => visibleCanvasKeys.includes(key)).map(({ key, title, icon: Icon, placeholder, questions }) => (
            <div key={key} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                {FIELD_HELP[key] ? <InfoHint title={title} {...FIELD_HELP[key]} /> : null}
              </div>
              <ul className="mb-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                {(questions ?? []).map((question) => (
                  <li key={question} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
              <Textarea
                value={canvas[key]}
                onChange={(event) => updateCanvas(key, event.target.value)}
                placeholder={placeholder}
                className="min-h-32 resize-none"
              />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prontezza idea
              </p>
              <p className="mt-1 text-3xl font-bold text-foreground">{averageScore}%</p>
            </div>
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <Compass className="h-8 w-8 text-primary" />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Wendy userà questi dati come riferimento quando le chiedi di analizzare l'idea.
          </p>
          <Button
            className="mt-4 min-h-11 w-full rounded-full gap-2"
            onClick={() => askWendy("Analizza l'idea e dimmi i prossimi 3 passi")}
          >
            <BrainCircuit className="h-4 w-4" />
            Chiedi analisi a Wendy
          </Button>
        </div>
      </section>
      )}

      {activeStep === "sense" && (
      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Competitor e mercato</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Raccogli alternative reali, posizionamento, prezzi e opportunita prima di investire sull'idea.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-full gap-2"
            onClick={() =>
              askWendy(
                "Interpreta la sezione Competitor e mercato. Usa alternativa attuale, prezzo/posizionamento, punti forti/deboli, opportunita e competitor inseriti. Dimmi quali segnali sono forti, quali mancano e quale verifica fare dopo.",
              )
            }
          >
            <BrainCircuit className="h-4 w-4" />
            Interpreta mercato
          </Button>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Alternativa attuale
            </label>
            <Textarea
              value={market.currentAlternative}
              onChange={(event) => updateMarket("currentAlternative", event.target.value)}
              placeholder="Cosa usano oggi gli utenti al posto della tua soluzione?"
              className="min-h-28 resize-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prezzo e posizionamento
            </label>
            <Textarea
              value={market.pricingPositioning}
              onChange={(event) => updateMarket("pricingPositioning", event.target.value)}
              placeholder="Che prezzo, modello o fascia di mercato sembrano realistici?"
              className="min-h-28 resize-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Punti forti/deboli
            </label>
            <Textarea
              value={market.strengthsWeaknesses}
              onChange={(event) => updateMarket("strengthsWeaknesses", event.target.value)}
              placeholder="Dove il mercato e forte? Dove lascia scoperti gli utenti?"
              className="min-h-28 resize-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Opportunita
            </label>
            <Textarea
              value={market.opportunities}
              onChange={(event) => updateMarket("opportunities", event.target.value)}
              placeholder="Quale spazio specifico puoi occupare meglio degli altri?"
              className="min-h-28 resize-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_1fr]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Competitor
                </p>
                <p className="text-sm text-muted-foreground">
                  {competitors.length} {competitors.length === 1 ? "competitor" : "competitor"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="min-h-11 rounded-full gap-2"
                onClick={addCompetitor}
              >
                <Plus className="h-4 w-4" />
                Aggiungi
              </Button>
            </div>

            {competitors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-background/40 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Aggiungi il primo competitor o alternativa
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Anche un foglio Excel, un consulente o un processo manuale possono essere competitor reali.
                </p>
                <Button
                  type="button"
                  className="mt-4 min-h-11 rounded-full gap-2"
                  onClick={addCompetitor}
                >
                  <Plus className="h-4 w-4" />
                  Primo competitor
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {competitors.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveCompetitorId(item.id)}
                    className={`min-h-16 w-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      item.id === activeCompetitor?.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background/40 hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {item.name || "Competitor senza nome"}
                      </span>
                      {item.price ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                          {item.price}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.positioning || item.opportunity || "Posizionamento da definire"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeCompetitor ? (
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    Competitor selezionato
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">
                    {activeCompetitor.name || "Competitor senza nome"}
                  </h3>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-full gap-2"
                    onClick={duplicateActiveCompetitor}
                  >
                    <Copy className="h-4 w-4" />
                    Duplica
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-full gap-2"
                    onClick={removeActiveCompetitor}
                  >
                    <Archive className="h-4 w-4" />
                    Rimuovi
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nome
                  </label>
                  <Input
                    value={activeCompetitor.name}
                    onChange={(event) => updateActiveCompetitor("name", event.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    URL opzionale
                  </label>
                  <Input
                    value={activeCompetitor.url}
                    onChange={(event) => updateActiveCompetitor("url", event.target.value)}
                    placeholder="https://..."
                    className="min-h-11"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Posizionamento
                  </label>
                  <Textarea
                    value={activeCompetitor.positioning}
                    onChange={(event) => updateActiveCompetitor("positioning", event.target.value)}
                    placeholder="A chi parla, quale promessa fa, come si presenta?"
                    className="min-h-28 resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Prezzo
                  </label>
                  <Textarea
                    value={activeCompetitor.price}
                    onChange={(event) => updateActiveCompetitor("price", event.target.value)}
                    placeholder="Gratis, abbonamento, setup fee, consulenza, fascia prezzo..."
                    className="min-h-28 resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Punti forti
                  </label>
                  <Textarea
                    value={activeCompetitor.strengths}
                    onChange={(event) => updateActiveCompetitor("strengths", event.target.value)}
                    placeholder="Cosa fa bene questo competitor?"
                    className="min-h-28 resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Punti deboli
                  </label>
                  <Textarea
                    value={activeCompetitor.weaknesses}
                    onChange={(event) => updateActiveCompetitor("weaknesses", event.target.value)}
                    placeholder="Dove lascia frizione, costi, lacune o insoddisfazione?"
                    className="min-h-28 resize-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Opportunita per NorthStar
                  </label>
                  <Textarea
                    value={activeCompetitor.opportunity}
                    onChange={(event) => updateActiveCompetitor("opportunity", event.target.value)}
                    placeholder="Quale spazio puoi occupare meglio rispetto a questo competitor?"
                    className="min-h-28 resize-none"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      )}

      {activeStep === "sense" && (
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
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-11 rounded-full text-xs"
                        onClick={() => applyProposedScore(key)}
                      >
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
                  onChange={(event) => {
                    const nextScore = Number(event.target.value);
                    setScores((current) => ({ ...current, [key]: nextScore }));
                    addDebouncedTimelineEvent(
                      scoreTimelineTimerRef,
                      "score_updated",
                      "Score aggiornato",
                      `${SCORE_LABELS[key].label}: impostato a ${nextScore}/5.`,
                      { key, score: nextScore },
                    );
                    markDirty();
                  }}
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
              <Textarea
                value={assumption}
                onChange={(event) => {
                  setAssumption(event.target.value);
                  markDirty();
                }}
                placeholder="La cosa che deve essere vera perché l'idea funzioni..."
                className="min-h-32 resize-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ultimo consiglio Wendy
              </label>
              <Textarea
                value={lastWendyAdvice}
                onChange={(event) => {
                  setLastWendyAdvice(event.target.value);
                  addDebouncedTimelineEvent(
                    wendyAdviceTimelineTimerRef,
                    "wendy_feedback",
                    "Consiglio Wendy aggiornato",
                    "Hai aggiornato la sintesi dell'ultimo consiglio Wendy.",
                    { field: "lastWendyAdvice" },
                  );
                  markDirty();
                }}
                placeholder="Sintesi del consiglio ricevuto da Wendy..."
                className="min-h-32 resize-none"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="min-h-11 flex-1 rounded-full gap-2"
              onClick={() => askWendy("Trova i rischi principali e come ridurli")}
            >
              Trova rischi
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="min-h-11 flex-1 rounded-full gap-2"
              onClick={() => askWendy("Trasforma questa idea in un piano di test di 7 giorni")}
            >
              Piano test 7 giorni
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
      )}

      {activeStep === "test" && (
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
            <select
              value={selectedTemplate}
              onChange={(event) => setSelectedTemplate(event.target.value)}
              className="min-h-11 rounded-full border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Template esperimento"
            >
              {EXPERIMENT_TEMPLATES.map((template) => (
                <option key={template.template} value={template.template}>
                  {template.title}
                </option>
              ))}
            </select>
            <Button
              type="button"
              className="min-h-11 rounded-full gap-2"
              onClick={() => createExperiment()}
            >
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
            <Button
              type="button"
              className="mt-4 min-h-11 rounded-full gap-2"
              onClick={() => createExperiment()}
            >
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
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Esperimento attivo
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">
                      {activeExperiment.title}
                    </h3>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 rounded-full gap-2"
                      onClick={duplicateActiveExperiment}
                    >
                      <Copy className="h-4 w-4" />
                      Duplica
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 rounded-full gap-2"
                      onClick={discardActiveExperiment}
                      disabled={activeExperiment.status === "discarded"}
                    >
                      <Archive className="h-4 w-4" />
                      Archivia
                    </Button>
                  </div>
                </div>

                <div className="mb-4 rounded-2xl border border-border bg-card p-4">
                  <div className="mb-3 flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Trasforma in azione
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Collega l'esperimento a obiettivi e calendario NorthStar.
                    </p>
                  </div>
                  {experimentActionError ? (
                    <div className="mb-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {experimentActionError}
                    </div>
                  ) : null}
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Button
                      type="button"
                      variant={activeExperiment.objectiveId ? "secondary" : "outline"}
                      className="min-h-11 rounded-full gap-2"
                      onClick={createExperimentObjective}
                      disabled={!!activeExperiment.objectiveId || experimentActionLoading !== null}
                    >
                      {experimentActionLoading === "objective" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ClipboardCheck className="h-4 w-4" />
                      )}
                      {activeExperiment.objectiveId ? "Task creato" : "Crea task"}
                    </Button>
                    <Button
                      type="button"
                      variant={activeExperiment.calendarEventId ? "secondary" : "outline"}
                      className="min-h-11 rounded-full gap-2"
                      onClick={() => createExperimentCalendarEvent("calendar")}
                      disabled={!!activeExperiment.calendarEventId || experimentActionLoading !== null}
                    >
                      {experimentActionLoading === "calendar" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarDays className="h-4 w-4" />
                      )}
                      {activeExperiment.calendarEventId ? "Evento creato" : "Aggiungi evento"}
                    </Button>
                    <Button
                      type="button"
                      variant={activeExperiment.reminderEventId ? "secondary" : "outline"}
                      className="min-h-11 rounded-full gap-2"
                      onClick={() => createExperimentCalendarEvent("reminder")}
                      disabled={!!activeExperiment.reminderEventId || experimentActionLoading !== null}
                    >
                      {experimentActionLoading === "reminder" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarDays className="h-4 w-4" />
                      )}
                      {activeExperiment.reminderEventId ? "Promemoria creato" : "Ricordamelo tra 7 giorni"}
                    </Button>
                    <Button
                      type="button"
                      variant={activeExperiment.status === "completed" ? "secondary" : "outline"}
                      className="min-h-11 rounded-full gap-2"
                      onClick={completeActiveExperiment}
                      disabled={activeExperiment.status === "completed" || experimentActionLoading !== null}
                    >
                      {experimentActionLoading === "complete" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {activeExperiment.status === "completed" ? "Completato" : "Segna completato"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Titolo
                    </label>
                    <Input
                      value={activeExperiment.title}
                      onChange={(event) => updateActiveExperiment("title", event.target.value)}
                      className="min-h-11"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Stato
                    </label>
                    <select
                      value={activeExperiment.status}
                      onChange={(event) =>
                        updateActiveExperiment("status", event.target.value as ExperimentStatus)
                      }
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {Object.entries(EXPERIMENT_STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Obiettivo
                    </label>
                    <Textarea
                      value={activeExperiment.objective}
                      onChange={(event) => updateActiveExperiment("objective", event.target.value)}
                      className="min-h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Ipotesi
                    </label>
                    <Textarea
                      value={activeExperiment.hypothesis}
                      onChange={(event) => updateActiveExperiment("hypothesis", event.target.value)}
                      className="min-h-28 resize-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cosa misurare
                    </label>
                    <Textarea
                      value={activeExperiment.metric}
                      onChange={(event) => updateActiveExperiment("metric", event.target.value)}
                      className="min-h-28 resize-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Risultato atteso
                    </label>
                    <Textarea
                      value={activeExperiment.expectedResult}
                      onChange={(event) =>
                        updateActiveExperiment("expectedResult", event.target.value)
                      }
                      className="min-h-28 resize-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Data limite
                    </label>
                    <Input
                      type="date"
                      value={activeExperiment.deadline}
                      onChange={(event) => updateActiveExperiment("deadline", event.target.value)}
                      className="min-h-11"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Esito
                    </label>
                    <Textarea
                      value={activeExperiment.outcome}
                      onChange={(event) => updateActiveExperiment("outcome", event.target.value)}
                      placeholder="Cosa e successo? Quale dato hai raccolto? Cosa cambia nella prossima iterazione?"
                      className="min-h-28 resize-none"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="min-h-11 flex-1 rounded-full gap-2"
                    onClick={() =>
                      askWendy("Migliora l'esperimento attivo e rendilo piu misurabile")
                    }
                  >
                    Migliora esperimento
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 flex-1 rounded-full gap-2"
                    onClick={() => askWendy("Interpreta l'esito dell'esperimento attivo")}
                  >
                    Interpreta esito
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
