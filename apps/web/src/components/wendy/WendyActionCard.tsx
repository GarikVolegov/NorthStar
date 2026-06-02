import type { WendyAction } from "@/hooks/useWendyActionExecutor";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
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
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface WendyActionCardProps {
  action: WendyAction;
  onConfirm: (confirmationText?: string) => void;
  onCancel: () => void;
}

function actionIcon(type: string) {
  if (type === "navigate") return Map;
  if (type === "set_filters") return SlidersHorizontal;
  return Sparkles;
}

function statusCopy(action: WendyAction): { key: string; source: string } {
  if (action.status === "executed" || action.status === "done") {
    return { key: "wendy.action.status.completed", source: "Completata" };
  }
  if (action.status === "running") {
    return { key: "wendy.action.status.running", source: "Eseguo..." };
  }
  if (action.status === "failed") {
    return { key: "wendy.action.status.failed", source: "Non riuscita" };
  }
  if (action.status === "cancelled") {
    return { key: "wendy.action.status.cancelled", source: "Annullata" };
  }
  if (action.requiresConfirmation) {
    return { key: "wendy.action.status.needsConfirmation", source: "Da confermare" };
  }
  return { key: "wendy.action.status.ready", source: "Pronta" };
}

export function WendyActionCard({ action, onConfirm, onCancel }: WendyActionCardProps) {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const [strongConfirmation, setStrongConfirmation] = useState("");
  const status = statusCopy(action);
  const statusLabel = useDynamicTranslation({
    locale,
    key: status.key,
    source: status.source,
    context: "Wendy action status badge",
  });
  const strongConfirmationLabel = useDynamicTranslation({
    locale,
    key: "wendy.action.strongConfirmation.label",
    source: "Testo di conferma",
    context: "Wendy high-risk action confirmation input label",
  });
  const cancelLabel = useDynamicTranslation({
    locale,
    key: "wendy.action.cancel",
    source: "Annulla",
    context: "Cancel a pending Wendy action",
  });
  const confirmLabel = useDynamicTranslation({
    locale,
    key: "wendy.action.confirm",
    source: "Conferma",
    context: "Confirm a pending Wendy action",
  });
  const retryLabel = useDynamicTranslation({
    locale,
    key: "wendy.action.retry",
    source: "Riprova",
    context: "Retry a failed Wendy action",
  });
  const Icon = action.status === "executed" || action.status === "done"
    ? CheckCircle2
    : action.status === "failed" || action.status === "cancelled"
      ? XCircle
      : action.status === "running"
        ? Loader2
        : actionIcon(action.type);

  const strongConfirmationRequired = Boolean(
    action.requiresStrongConfirmation && action.confirmationText,
  );
  const strongConfirmationMatches =
    !strongConfirmationRequired || strongConfirmation === action.confirmationText;
  const canRetry = action.requiresConfirmation && action.status === "failed";
  const canConfirm =
    action.requiresConfirmation &&
    (action.status === "needs_confirmation" || canRetry) &&
    strongConfirmationMatches;
  const canCancel = action.requiresConfirmation && (
    action.status === "needs_confirmation" ||
    action.status === "failed"
  );

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
              {statusLabel}
            </span>
          </div>
          {action.description && action.status !== "failed" && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.description}</p>
          )}

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

          {strongConfirmationRequired && (action.status === "needs_confirmation" || action.status === "failed") && (
            <label className="mt-3 block text-xs text-muted-foreground">
              <span className="mb-1 block font-medium text-foreground">
                {strongConfirmationLabel}
              </span>
              <input
                type="text"
                value={strongConfirmation}
                onChange={(event) => setStrongConfirmation(event.target.value)}
                placeholder={action.confirmationText}
                className="h-10 w-full rounded-md border border-white/10 bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/45 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={strongConfirmationLabel}
              />
            </label>
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
              {cancelLabel}
            </button>
          )}
          {action.requiresConfirmation && (action.status === "needs_confirmation" || canRetry) && (
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(strongConfirmationRequired ? strongConfirmation : undefined)}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                canConfirm
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {canRetry ? retryLabel : confirmLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
