import { useEffect, useState } from "react";
import { X } from "lucide-react";

const ONBOARDING_KEY = "wendy:empty-state-dismissed:v1";

interface WendyEmptyStateProps {
  starterPrompts: { label: string; icon?: string }[];
  onPromptSelect: (prompt: string) => void;
  compact?: boolean;
}

const CAPABILITIES = [
  { emoji: "🧠", title: "Ti conosco", description: "Obiettivi, preferenze e storia." },
  { emoji: "📈", title: "Mercato live", description: "Settori, ruoli, skill richieste oggi." },
  { emoji: "⚡", title: "Agisco per te", description: "Navigo, creo obiettivi, apro pagine." },
];

export function WendyEmptyState({
  starterPrompts,
  onPromptSelect,
  compact = false,
}: WendyEmptyStateProps) {
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(ONBOARDING_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function handleDismiss() {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Cosa puoi chiedere a Wendy"
      className={compact ? "space-y-3 py-2" : "space-y-5 py-4"}
    >
      {!dismissed && (
        <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/8 to-transparent px-4 py-4">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Nascondi la presentazione"
            className="absolute right-2.5 top-2.5 rounded-full p-1 text-muted-foreground/50 transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Wendy avatar + intro */}
          <div className="mb-4 flex items-center gap-3 pr-6">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-md">
              <span className="text-sm font-bold text-white">✦</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Ciao, sono Wendy</p>
              <p className="text-xs text-muted-foreground">La tua AI coach per la carriera</p>
            </div>
          </div>

          <div className={compact ? "flex flex-col gap-2" : "grid grid-cols-3 gap-2"}>
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.title}
                className="flex items-start gap-2 rounded-xl bg-card/50 px-2.5 py-2 border border-white/5"
              >
                <span className="text-base leading-none mt-0.5">{cap.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{cap.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {starterPrompts.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Inizia con
          </p>
          <div className="flex flex-wrap gap-1.5">
            {starterPrompts.map((prompt) => (
              <button
                key={`starter-${prompt.label}`}
                type="button"
                onClick={() => onPromptSelect(prompt.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-amber-500/30 hover:bg-amber-500/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                {prompt.icon ? <span>{prompt.icon}</span> : null}
                <span>{prompt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function _resetWendyEmptyStateForTest(): void {
  try {
    window.localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore
  }
}
