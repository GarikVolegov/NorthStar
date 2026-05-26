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
} as const;

function citationLabel(title: string, url?: string | null): string {
  if (title && title.length > 0 && !/^chunk/i.test(title)) return title;
  if (url) {
    try { return new URL(url).hostname.replace("www.", ""); } catch { /* ignore */ }
  }
  return "Fonte";
}

export function WendySources({ message }: { message: WendyMessage }) {
  const contextSources = message.contextSources ?? [];
  if (!message.citations?.length && contextSources.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Fonti usate da Wendy">
      {contextSources.map((source) => (
        <span
          key={`${message.id}-${source}`}
          className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
        >
          {SOURCE_LABELS[source]}
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
