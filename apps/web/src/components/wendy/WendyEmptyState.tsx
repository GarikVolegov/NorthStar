import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { useTranslation } from "react-i18next";

const ONBOARDING_KEY = "wendy:empty-state-dismissed:v1";

interface WendyEmptyStateProps {
  starterPrompts: { label: string; icon?: string }[];
  onPromptSelect: (prompt: string) => void;
  compact?: boolean;
}

const CAPABILITIES = [
  {
    id: "knowsYou",
    emoji: "🧠",
    title: "Ti conosco",
    description: "Obiettivi, preferenze e storia.",
  },
  {
    id: "marketLive",
    emoji: "📈",
    title: "Mercato live",
    description: "Settori, ruoli, skill richieste oggi.",
  },
  {
    id: "actsForYou",
    emoji: "⚡",
    title: "Agisco per te",
    description: "Navigo, creo obiettivi, apro pagine.",
  },
] as const;

function CapabilityCard({
  capability,
  locale,
}: {
  capability: (typeof CAPABILITIES)[number];
  locale: string;
}) {
  const title = useDynamicTranslation({
    locale,
    key: `wendy.empty.capabilities.${capability.id}.title`,
    source: capability.title,
    context: "Wendy empty state capability title",
  });
  const description = useDynamicTranslation({
    locale,
    key: `wendy.empty.capabilities.${capability.id}.description`,
    source: capability.description,
    context: "Wendy empty state capability description",
  });

  return (
    <div className="flex items-start gap-2 rounded-xl bg-card/50 px-2.5 py-2 border border-white/5">
      <span className="text-base leading-none mt-0.5">{capability.emoji}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function WendyEmptyState({
  starterPrompts,
  onPromptSelect,
  compact = false,
}: WendyEmptyStateProps) {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const [dismissed, setDismissed] = useState<boolean>(true);
  const regionLabel = useDynamicTranslation({
    locale,
    key: "wendy.empty.regionLabel",
    source: "Cosa puoi chiedere a Wendy",
    context: "Accessible region label for Wendy empty state suggestions",
  });
  const dismissLabel = useDynamicTranslation({
    locale,
    key: "wendy.empty.dismiss",
    source: "Nascondi la presentazione",
    context: "Dismiss button label for Wendy empty onboarding presentation",
  });
  const title = useDynamicTranslation({
    locale,
    key: "wendy.empty.title",
    source: "Ciao, sono Wendy",
    context: "Wendy empty state intro title",
  });
  const subtitle = useDynamicTranslation({
    locale,
    key: "wendy.empty.subtitle",
    source: "La tua AI coach per la carriera",
    context: "Wendy empty state intro subtitle",
  });
  const startWithLabel = useDynamicTranslation({
    locale,
    key: "wendy.empty.startWith",
    source: "Inizia con",
    context: "Wendy empty state starter prompts heading",
  });

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
      aria-label={regionLabel}
      className={compact ? "space-y-3 py-2" : "space-y-5 py-4"}
    >
      {!dismissed && (
        <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/8 to-transparent px-4 py-4">
          <button
            type="button"
            onClick={handleDismiss}
            aria-label={dismissLabel}
            className="absolute right-2.5 top-2.5 rounded-full p-1 text-muted-foreground/50 transition-colors hover:bg-white/8 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="mb-4 flex items-center gap-3 pr-6">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-md">
              <span className="text-sm font-bold text-white">✦</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          <div className={compact ? "flex flex-col gap-2" : "grid grid-cols-3 gap-2"}>
            {CAPABILITIES.map((capability) => (
              <CapabilityCard key={capability.id} capability={capability} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {starterPrompts.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            {startWithLabel}
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
