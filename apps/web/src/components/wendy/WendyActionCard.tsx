import type { WendyAction } from "@/hooks/useWendyActionExecutor";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  Loader2,
  Map,
  SlidersHorizontal,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";

interface WendyActionCardProps {
  action: WendyAction;
  onConfirm: () => void;
  onCancel: () => void;
}

function actionIcon(type: string) {
  if (type === "navigate") return Map;
  if (type === "set_filters") return SlidersHorizontal;
  return Sparkles;
}

function statusCopy(action: WendyAction) {
  if (action.status === "executed" || action.status === "done") return "Completata";
  if (action.status === "running") return "Eseguo...";
  if (action.status === "failed") return "Non riuscita";
  if (action.status === "cancelled") return "Annullata";
  if (action.requiresConfirmation) return "Da confermare";
  return "Pronta";
}

export function WendyActionCard({ action, onConfirm, onCancel }: WendyActionCardProps) {
  const Icon = action.status === "executed" || action.status === "done"
    ? CheckCircle2
    : action.status === "failed" || action.status === "cancelled"
      ? XCircle
      : action.status === "running"
        ? Loader2
        : actionIcon(action.type);

  const canConfirm = action.requiresConfirmation && action.status === "needs_confirmation";
  const canCancel = action.requiresConfirmation && action.status === "needs_confirmation";

  return (
    <div
      className={cn(
        "mt-2 w-full rounded-2xl border bg-background/75 p-3 text-left shadow-sm backdrop-blur",
        action.status === "failed"
          ? "border-destructive/30"
          : action.status === "executed" || action.status === "done"
            ? "border-emerald-500/25"
            : "border-primary/20",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            action.status === "failed" || action.status === "cancelled"
              ? "bg-destructive/10 text-destructive"
              : action.status === "executed" || action.status === "done"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-primary/10 text-primary",
          )}
        >
          <Icon className={cn("h-4 w-4", action.status === "running" && "animate-spin")} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{action.label}</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {statusCopy(action)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.description}</p>

          {action.preview && action.preview.length > 0 && (
            <dl className="mt-3 grid gap-1.5 text-xs">
              {action.preview.slice(0, 4).map((item) => (
                <div key={`${action.id}-${item.label}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="truncate font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {action.error && (
            <p className="mt-2 rounded-xl border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
              {action.error}
            </p>
          )}
        </div>
      </div>

      {(canConfirm || canCancel) && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <X className="h-3.5 w-3.5" />
              Annulla
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <Check className="h-3.5 w-3.5" />
              Conferma
            </button>
          )}
        </div>
      )}
    </div>
  );
}
