import { cn } from "@/lib/utils";
import { Mic, Send, Square } from "lucide-react";
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

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-center gap-2 border-t border-white/10 bg-card/80 backdrop-blur-xl",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      {sttSupported && (
        <button
          type="button"
          onClick={() => sttIsListening ? commitSTT() : startSTT()}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
            sttIsListening ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
          aria-label={sttIsListening ? "Invia dettatura" : "Detta a Wendy"}
        >
          <Mic className="h-4 w-4" />
        </button>
      )}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Chiedi a Wendy..."
        className="min-h-10 flex-1 rounded-full border border-white/10 bg-background/70 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={stopStream}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label="Interrompi Wendy"
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={query.trim().length < 2}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label="Invia a Wendy"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
