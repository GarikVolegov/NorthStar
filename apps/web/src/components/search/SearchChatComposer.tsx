import { cn } from "@/lib/utils";
import { ArrowUp, Mic, Square } from "lucide-react";
import type { FormEvent, RefObject } from "react";

interface SearchChatComposerProps {
  compact?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (value: string) => void;
  isStreaming: boolean;
  sttSupported: boolean;
  sttIsListening: boolean;
  commitSTT: () => void;
  startSTT: () => void;
  stopStream: () => void;
  askCurrentQuery: () => void;
}

export function SearchChatComposer({
  compact = false,
  inputRef,
  query,
  setQuery,
  isStreaming,
  sttSupported,
  sttIsListening,
  commitSTT,
  startSTT,
  stopStream,
  askCurrentQuery,
}: SearchChatComposerProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    askCurrentQuery();
  }

  const hasQuery = query.trim().length >= 2;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "border-t border-white/8 bg-card/70 backdrop-blur-xl",
        compact ? "px-3 py-2" : "px-3 py-3",
      )}
    >
      <div className={cn(
        "flex items-center gap-2 rounded-2xl border border-white/10 bg-background/60 transition-colors focus-within:border-amber-500/40 focus-within:bg-background/80",
        compact ? "px-3 py-1.5" : "px-3.5 py-2",
      )}>
        {sttSupported && (
          <button
            type="button"
            onClick={() => sttIsListening ? commitSTT() : startSTT()}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              sttIsListening
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "text-muted-foreground/60 hover:text-muted-foreground",
            )}
            aria-label={sttIsListening ? "Invia dettatura" : "Detta a Wendy"}
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
        )}

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chiedi a Wendy..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 min-h-8"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={stopStream}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
            aria-label="Interrompi Wendy"
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!hasQuery}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              hasQuery
                ? "bg-amber-500 text-white shadow-sm hover:bg-amber-400"
                : "bg-muted text-muted-foreground/40",
            )}
            aria-label="Invia a Wendy"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}
