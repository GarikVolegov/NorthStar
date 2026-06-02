import { cn } from "@/lib/utils";

export type DiscoveryPersonalization = "profile" | "journey" | "generic" | "private";

const PERSONALIZATION_LABELS = {
  profile: "Personalizzato",
  journey: "Percorso",
  generic: "Generale",
  private: "Privato",
} satisfies Record<DiscoveryPersonalization, string>;

export interface DiscoveryMetaProps {
  sourceLabel?: string | undefined;
  personalization?: DiscoveryPersonalization | undefined;
  reasonLabels?: string[] | undefined;
  className?: string;
}

export function DiscoveryMeta({
  sourceLabel,
  personalization,
  reasonLabels = [],
  className,
}: DiscoveryMetaProps) {
  const source = sourceLabel?.trim();
  const visibleReasons = reasonLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!source && visibleReasons.length === 0) {
    return null;
  }

  const personalizationLabel = personalization
    ? PERSONALIZATION_LABELS[personalization]
    : undefined;

  return (
    <div
      className={cn("inline-flex flex-wrap items-center gap-1.5 text-[11px] leading-none", className)}
      aria-label="Metadati scoperta"
    >
      {source && <DiscoveryChip tone="source">{source}</DiscoveryChip>}
      {personalizationLabel && (
        <DiscoveryChip tone="personalization">{personalizationLabel}</DiscoveryChip>
      )}
      {visibleReasons.map((label, index) => (
        <DiscoveryChip key={`${label}-${index}`} tone="reason">
          {label}
        </DiscoveryChip>
      ))}
    </div>
  );
}

interface DiscoveryChipProps {
  tone: "source" | "personalization" | "reason";
  children: string;
}

function DiscoveryChip({ tone, children }: DiscoveryChipProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-md border px-2 py-1 font-medium",
        tone === "source" && "border-primary/20 bg-primary/10 text-primary",
        tone === "personalization" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
        tone === "reason" && "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
