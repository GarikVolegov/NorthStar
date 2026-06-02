import { useProactiveInsights, type ProactiveInsight } from "@/hooks/useProactiveInsights";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { Compass, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface StarterPrompt {
  label: string;
  icon?: string;
}

interface WendyPromptSuggestionsProps {
  fallbackPrompts: StarterPrompt[];
  onPromptSelect: (prompt: string) => void;
  compact?: boolean;
  className?: string;
}

type InsightWithPrompt = ProactiveInsight & { prompt?: string | null };

function insightToPrompt(insight: InsightWithPrompt): string {
  if (insight.prompt?.trim()) return insight.prompt.trim();
  if (insight.ctaLabel?.trim()) return insight.ctaLabel.trim();
  return `Aiutami a capire questo segnale: ${insight.title}`;
}

export function WendyPromptSuggestions({
  fallbackPrompts,
  onPromptSelect,
  compact = false,
  className,
}: WendyPromptSuggestionsProps) {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const { insights } = useProactiveInsights();
  const ariaLabel = useDynamicTranslation({
    locale,
    key: "wendy.promptSuggestions.ariaLabel",
    source: "Suggerimenti Wendy",
    context: "ARIA label for Wendy proactive and starter prompt suggestions",
  });
  const heading = useDynamicTranslation({
    locale,
    key: "wendy.promptSuggestions.heading",
    source: "Wendy ti suggerisce",
    context: "Small heading above Wendy proactive and starter prompt suggestions",
  });

  const prompts = useMemo(() => {
    const proactive = (insights as InsightWithPrompt[])
      .filter((insight) => !insight.readAt && !insight.dismissedAt)
      .slice(0, 3)
      .map((insight) => ({
        label: insight.title,
        prompt: insightToPrompt(insight),
        source: "insight" as const,
      }));

    if (proactive.length > 0) return proactive;

    return fallbackPrompts.slice(0, compact ? 3 : 5).map((prompt) => ({
      label: prompt.label,
      prompt: prompt.label,
      source: "starter" as const,
    }));
  }, [compact, fallbackPrompts, insights]);

  if (prompts.length === 0) return null;

  return (
    <section className={cn("space-y-2", className)} aria-label={ariaLabel}>
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {heading}
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {prompts.map((item) => (
          <button
            key={`${item.source}-${item.label}`}
            type="button"
            onClick={() => onPromptSelect(item.prompt)}
            className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <Compass className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="max-w-[220px] truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
