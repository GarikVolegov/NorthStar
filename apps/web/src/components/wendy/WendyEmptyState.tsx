import { useEffect, useState } from "react";
import { Brain, MapPin, Sparkles, X } from "lucide-react";

const ONBOARDING_KEY = "wendy:empty-state-dismissed:v1";

interface WendyEmptyStateProps {
  /** Quick actions contestuali alla pagina corrente (popolano la chat su click) */
  starterPrompts: { label: string; icon?: string }[];
  /** Callback quando l'utente clicca un prompt — popola input e invia */
  onPromptSelect: (prompt: string) => void;
  /** Variante compatta per bottom-sheet mobile */
  compact?: boolean;
}

interface CapabilityCard {
  title: string;
  description: string;
  icon: typeof Brain;
}

const CAPABILITIES: CapabilityCard[] = [
  {
    title: "Conosco te",
    description: "Ricordo i tuoi obiettivi, le preferenze e ciò che abbiamo già detto.",
    icon: Brain,
  },
  {
    title: "Conosco il mercato",
    description: "Settori in crescita, ruoli emergenti, skill richieste oggi.",
    icon: Sparkles,
  },
  {
    title: "Agisco per te",
    description: "Apro pagine, creo obiettivi, fisso eventi nel calendario.",
    icon: MapPin,
  },
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
      // localStorage non disponibile: dismiss solo per la sessione corrente
    }
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label="Cosa puoi chiedere a Wendy"
      className={compact ? "space-y-3 py-3" : "space-y-4 py-4"}
    >
      {!dismissed && (
        <div className="relative rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Nascondi la presentazione"
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <p className="mb-3 pr-6 text-xs font-medium uppercase tracking-wide text-primary/80">
            Ciao, sono Wendy
          </p>
          <div className={compact ? "flex flex-col gap-2" : "grid gap-3 sm:grid-cols-3"}>
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="flex items-start gap-2 rounded-xl bg-card/60 p-2.5"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">{cap.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {cap.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {starterPrompts.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Prova a chiedermi
          </p>
          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={`starter-${prompt.label}`}
                type="button"
                onClick={() => onPromptSelect(prompt.label)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
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
