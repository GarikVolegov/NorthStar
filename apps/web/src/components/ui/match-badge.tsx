import { cn } from "@/lib/utils";

interface MatchBadgeProps {
  score: number;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function MatchBadge({ score, label = "Match", size = "md", className }: MatchBadgeProps) {
  const color =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : score >= 60
      ? "bg-primary/8 text-primary border-primary/20"
      : "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-0.5",
        color,
        className,
      )}
    >
      {label} {score}%
    </span>
  );
}
