import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { ENTITY_CONFIG, STATUS_CONFIG } from "./types";
import type { SuggestionStatus } from "./types";

export function StatusBadge({ status }: { status: SuggestionStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
        cfg.color,
      )}
    >
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export function EntityBadge({ type }: { type: string }) {
  const cfg = ENTITY_CONFIG[type] || { label: type, icon: FileText };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger";
  return (
    <span className={cn("text-xs font-mono font-semibold", color)}>{pct}%</span>
  );
}
