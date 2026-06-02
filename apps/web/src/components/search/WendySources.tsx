import type { ChatMessage as WendyMessage } from "@/hooks/useWendyChat";

const SOURCE_LABELS = {
  "app-data":       "Il tuo profilo",
  rag:              "Knowledge base",
  openhuman:        "Database mercato",
  graphify:         "Analisi codice",
  "wendy-brain":    "Memoria Wendy",
  "semantic-memory":"Storico conversazioni",
  admin:            "Contenuti NorthStar",
  "printing-press": "Strumenti AI",
  "growth-library": "Biblioteca crescita",
  "search-index":   "Indice NorthStar",
  "keyword-fallback": "Ricerca keyword",
} as const;

const ANSWER_MODE_LABELS = {
  "local-fast-path":    "Risposta rapida",
  "local-quick-action": "Azione rapida",
  "llm-fast-path":      "Modello AI",
  "llm-full-path":      "Analisi completa",
  "recovery-fallback":  "Recupero sicuro",
  unconfigured:         "Modello non configurato",
} as const;

const REASONING_DEPTH_LABELS: Record<string, string> = {
  instant:    "Ragionamento immediato",
  grounded:   "Ragionamento guidato",
  deliberate: "Ragionamento profondo",
};

const DATA_STRATEGY_LABELS: Record<string, string> = {
  none:           "Risposta diretta",
  profile:        "Profilo",
  market:         "Mercato",
  profile_market: "Profilo + mercato",
  app_action:     "Azione app",
  memory:         "Memoria",
};

function citationLabel(title: string, url?: string | null): string {
  if (title && title.length > 0 && !/^chunk/i.test(title)) return title;
  if (url) {
    try { return new URL(url).hostname.replace("www.", ""); } catch { /* ignore */ }
  }
  return "Fonte";
}

export function WendySources({ message }: { message: WendyMessage }) {
  const contextSources = message.contextSources ?? [];
  const adaptiveReasoning = message.adaptiveReasoning;
  if (!message.citations?.length && contextSources.length === 0 && !message.answerMode && !adaptiveReasoning) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Fonti usate da Wendy">
      {message.answerMode && (
        <span
          className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary"
          title={message.recovery ? "Wendy ha usato una risposta di recupero per evitare un'interruzione." : undefined}
        >
          {ANSWER_MODE_LABELS[message.answerMode as keyof typeof ANSWER_MODE_LABELS]}
        </span>
      )}
      {adaptiveReasoning && (
        <>
          <span
            className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200"
            title={`Modalita: ${adaptiveReasoning.mode}; esecuzione: ${adaptiveReasoning.executionMode}`}
          >
            {REASONING_DEPTH_LABELS[adaptiveReasoning.reasoningDepth] ?? "Ragionamento Wendy"}
          </span>
          {adaptiveReasoning.dataStrategy !== "none" && (
            <span
              className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary"
              title={`Strategia dati: ${adaptiveReasoning.dataStrategy}`}
            >
              {DATA_STRATEGY_LABELS[adaptiveReasoning.dataStrategy] ?? adaptiveReasoning.dataStrategy}
            </span>
          )}
        </>
      )}
      {contextSources.map((source) => (
        <span
          key={`${message.id}-${source}`}
          className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
        >
          {SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] ?? source}
        </span>
      ))}
      {message.citations?.slice(0, 4).map((source) => (
        <a
          key={`${message.id}-${source.nodeId}`}
          href={source.url ?? "#"}
          onClick={(event) => {
            if (!source.url) event.preventDefault();
          }}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {citationLabel(source.title, source.url)}
        </a>
      ))}
    </div>
  );
}
