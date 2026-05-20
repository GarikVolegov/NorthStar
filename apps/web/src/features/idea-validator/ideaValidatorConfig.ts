import {
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  Lightbulb,
  LineChart,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  CanvasKey,
  DecisionState,
  ExperimentStatus,
  GuidedExperiment,
  GuidedStep,
  IdeaStatus,
  MarketInsight,
  ScoreKey,
  TimelineEventType,
} from "./ideaValidatorTypes";

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: "Bozza",
  in_validation: "In validazione",
  validated: "Validata",
  discarded: "Scartata",
};

export const DECISION_LABELS: Record<DecisionState, string> = {
  unclear: "Da chiarire",
  needs_test: "Da testare",
  promising: "Promettente",
  validated: "Validata",
  discard: "Da scartare",
  ready_for_ops: "Pronta per piano operativo",
};

export const DECISION_HINTS: Record<DecisionState, string> = {
  unclear: "Mancano dati chiave su problema, target o soluzione.",
  needs_test: "L'idea ha una direzione, ma servono esperimenti concreti.",
  promising: "I segnali sono buoni, ma serve ancora validazione.",
  validated: "Le prove raccolte sono sufficienti per considerarla validata.",
  discard: "I segnali indicano che non conviene continuare ora.",
  ready_for_ops: "L'idea puo diventare piano operativo con task e calendario.",
};

export const GUIDED_STEPS: Array<{
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

export const STEP_ACTIONS: Record<GuidedStep, string[]> = {
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

export const FIELD_HELP: Record<string, { meaning: string; example: string; write: string }> = {
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

export const TIMELINE_META: Record<
  TimelineEventType,
  { label: string; icon: LucideIcon; tone: string }
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

export const SCORE_LABELS: Record<ScoreKey, { label: string; hint: string }> = {
  problem: { label: "Problema", hint: "Quanto è reale e urgente?" },
  audience: { label: "Pubblico", hint: "Quanto è chiaro il target?" },
  solution: { label: "Soluzione", hint: "Quanto è concreta l'offerta?" },
  market: { label: "Mercato", hint: "Quanto è visibile la domanda?" },
  execution: { label: "Esecuzione", hint: "Quanto è fattibile partire?" },
};

export const CANVAS_FIELDS = [
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

export const DEFAULT_CANVAS = CANVAS_FIELDS.reduce(
  (acc, field) => ({ ...acc, [field.key]: "" }),
  {} as Record<CanvasKey, string>,
);

export const DEFAULT_SCORES: Record<ScoreKey, number> = {
  problem: 2,
  audience: 2,
  solution: 2,
  market: 2,
  execution: 2,
};

export const EMPTY_SCORE_TEXT: Record<ScoreKey, string> = {
  problem: "",
  audience: "",
  solution: "",
  market: "",
  execution: "",
};

export const DEFAULT_MARKET: MarketInsight = {
  currentAlternative: "",
  pricingPositioning: "",
  strengthsWeaknesses: "",
  opportunities: "",
};

export const EXPERIMENT_STATUS_LABELS: Record<ExperimentStatus, string> = {
  planned: "Pianificato",
  running: "In corso",
  completed: "Completato",
  discarded: "Scartato",
};

export const EXPERIMENT_TEMPLATES: Array<
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

export const WENDY_IDEA_ACTIONS = [
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
