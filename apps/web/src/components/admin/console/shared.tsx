import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, RefreshCw, ShieldAlert } from "lucide-react";
import { ENTITY_CONFIG, STATUS_CONFIG } from "./config";
import type { PersistenceMeta, SuggestionStatus } from "./types";

export function PersistenceWarningBanner({
  title = "Setup persistenza da controllare",
  meta,
  onRetry,
  onOpenStatus,
}: {
  title?: string;
  meta: PersistenceMeta;
  onRetry?: () => void;
  onOpenStatus: () => void;
}) {
  if (!meta.persistenceUnavailable) return null;

  const reason = meta.reason || "persistence_unavailable";
  const setupLabel =
    meta.setupAction === "check_database"
      ? "Verifica database"
      : meta.setupAction === "check_schema"
        ? "Verifica schema"
        : "Risolvi setup/migration";

  return (
    <div
      className="rounded-xl border border-danger-muted bg-danger-surface p-4 text-danger"
      role="alert"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm">
              Dati non disponibili per problema di persistenza, non per assenza
              di contenuti.
            </p>
            <p className="mt-1 break-words text-xs text-danger/80">
              Motivo tecnico: <code>{reason}</code>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11 border-danger-muted bg-background/70 text-danger hover:bg-background"
            onClick={onOpenStatus}
          >
            {setupLabel}
          </Button>
          {onRetry && (
            <Button
              variant="outline"
              className="min-h-11 border-danger-muted bg-background/70 text-danger hover:bg-background"
              onClick={onRetry}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Riprova
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

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
