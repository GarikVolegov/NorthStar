import type { ChatMessage as WendyMessage } from "@/hooks/useWendyChat";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { useTranslation } from "react-i18next";

interface WendySourceLabel {
  key: string;
  source: string;
}

const SOURCE_LABELS: Record<string, WendySourceLabel> = {
  "app-data":       { key: "wendy.sources.context.appData", source: "Il tuo profilo" },
  rag:              { key: "wendy.sources.context.rag", source: "Knowledge base" },
  openhuman:        { key: "wendy.sources.context.openhuman", source: "Database mercato" },
  graphify:         { key: "wendy.sources.context.graphify", source: "Analisi codice" },
  "wendy-brain":    { key: "wendy.sources.context.wendyBrain", source: "Memoria Wendy" },
  "semantic-memory":{ key: "wendy.sources.context.semanticMemory", source: "Storico conversazioni" },
  admin:            { key: "wendy.sources.context.admin", source: "Contenuti NorthStar" },
  "printing-press": { key: "wendy.sources.context.printingPress", source: "Strumenti AI" },
  "growth-library": { key: "wendy.sources.context.growthLibrary", source: "Biblioteca crescita" },
  "search-index":   { key: "wendy.sources.context.searchIndex", source: "Indice NorthStar" },
  "keyword-fallback": { key: "wendy.sources.context.keywordFallback", source: "Ricerca keyword" },
};

const ANSWER_MODE_LABELS: Record<string, WendySourceLabel> = {
  "local-fast-path":    { key: "wendy.sources.answerMode.localFastPath", source: "Risposta rapida" },
  "local-quick-action": { key: "wendy.sources.answerMode.localQuickAction", source: "Azione rapida" },
  "llm-fast-path":      { key: "wendy.sources.answerMode.llmFastPath", source: "Modello AI" },
  "llm-full-path":      { key: "wendy.sources.answerMode.llmFullPath", source: "Analisi completa" },
  "recovery-fallback":  { key: "wendy.sources.answerMode.recoveryFallback", source: "Recupero sicuro" },
  unconfigured:         { key: "wendy.sources.answerMode.unconfigured", source: "Modello non configurato" },
};

const REASONING_DEPTH_LABELS: Record<string, WendySourceLabel> = {
  instant:    { key: "wendy.sources.reasoningDepth.instant", source: "Ragionamento immediato" },
  grounded:   { key: "wendy.sources.reasoningDepth.grounded", source: "Ragionamento guidato" },
  deliberate: { key: "wendy.sources.reasoningDepth.deliberate", source: "Ragionamento profondo" },
};

const DATA_STRATEGY_LABELS: Record<string, WendySourceLabel> = {
  none:           { key: "wendy.sources.dataStrategy.none", source: "Risposta diretta" },
  profile:        { key: "wendy.sources.dataStrategy.profile", source: "Profilo" },
  market:         { key: "wendy.sources.dataStrategy.market", source: "Mercato" },
  profile_market: { key: "wendy.sources.dataStrategy.profileMarket", source: "Profilo + mercato" },
  app_action:     { key: "wendy.sources.dataStrategy.appAction", source: "Azione app" },
  memory:         { key: "wendy.sources.dataStrategy.memory", source: "Memoria" },
};

function citationLabel(title: string, url?: string | null): string {
  if (title && title.length > 0 && !/^chunk/i.test(title)) return title;
  if (url) {
    try { return new URL(url).hostname.replace("www.", ""); } catch { /* ignore */ }
  }
  return "Fonte";
}

function DynamicSourceLabel({ label, locale }: { label: WendySourceLabel; locale: string }) {
  return <>{useDynamicTranslation({ locale, source: label.source, key: label.key, context: "Wendy source/reasoning badge" })}</>;
}

function unknownLabel(prefix: string, value: string): WendySourceLabel {
  return {
    key: `${prefix}.unknown`,
    source: value,
  };
}

function resolveLabel(map: Record<string, WendySourceLabel>, prefix: string, value: string): WendySourceLabel {
  return map[value] ?? unknownLabel(prefix, value);
}

export function WendySources({ message }: { message: WendyMessage }) {
  const { i18n } = useTranslation();
  const activeLanguage = i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
  const contextSources = message.contextSources ?? [];
  const adaptiveReasoning = message.adaptiveReasoning;
  const usedByWendyLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Fonti usate da Wendy",
    key: "wendy.sources.usedByWendy",
    context: "Accessible label for Wendy source chips",
  });
  const recoveryTitle = useDynamicTranslation({
    locale: activeLanguage,
    source: "Wendy ha usato una risposta di recupero per evitare un'interruzione.",
    key: "wendy.sources.recoveryTitle",
    context: "Wendy source badge title for recovery fallback",
  });
  const fallbackReasoningLabel = useDynamicTranslation({
    locale: activeLanguage,
    source: "Ragionamento Wendy",
    key: "wendy.sources.reasoningDepth.fallback",
    context: "Fallback label for unknown Wendy reasoning depth",
  });
  const modeTitle = useDynamicTranslation({
    locale: activeLanguage,
    source: adaptiveReasoning
      ? `Modalita: ${adaptiveReasoning.mode}; esecuzione: ${adaptiveReasoning.executionMode}`
      : "Modalita Wendy",
    key: "wendy.sources.reasoningTitle",
    context: "Wendy reasoning badge title; keep mode and execution values unchanged",
  });
  const dataStrategyTitle = useDynamicTranslation({
    locale: activeLanguage,
    source: adaptiveReasoning ? `Strategia dati: ${adaptiveReasoning.dataStrategy}` : "Strategia dati Wendy",
    key: "wendy.sources.dataStrategyTitle",
    context: "Wendy data strategy badge title; keep strategy value unchanged",
  });
  if (!message.citations?.length && contextSources.length === 0 && !message.answerMode && !adaptiveReasoning) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label={usedByWendyLabel}>
      {message.answerMode && (
        <span
          className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary"
          title={message.recovery ? recoveryTitle : undefined}
        >
          <DynamicSourceLabel
            label={resolveLabel(ANSWER_MODE_LABELS, "wendy.sources.answerMode", message.answerMode)}
            locale={activeLanguage}
          />
        </span>
      )}
      {adaptiveReasoning && (
        <>
          <span
            className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200"
            title={modeTitle}
          >
            {REASONING_DEPTH_LABELS[adaptiveReasoning.reasoningDepth]
              ? (
                  <DynamicSourceLabel
                    label={resolveLabel(REASONING_DEPTH_LABELS, "wendy.sources.reasoningDepth", adaptiveReasoning.reasoningDepth)}
                    locale={activeLanguage}
                  />
                )
              : fallbackReasoningLabel}
          </span>
          {adaptiveReasoning.dataStrategy !== "none" && (
            <span
              className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary"
              title={dataStrategyTitle}
            >
              {DATA_STRATEGY_LABELS[adaptiveReasoning.dataStrategy]
                ? (
                    <DynamicSourceLabel
                      label={resolveLabel(DATA_STRATEGY_LABELS, "wendy.sources.dataStrategy", adaptiveReasoning.dataStrategy)}
                      locale={activeLanguage}
                    />
                  )
                : adaptiveReasoning.dataStrategy}
            </span>
          )}
        </>
      )}
      {contextSources.map((source) => (
        <span
          key={`${message.id}-${source}`}
          className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
        >
          <DynamicSourceLabel
            label={resolveLabel(SOURCE_LABELS, "wendy.sources.context", source)}
            locale={activeLanguage}
          />
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
