/**
 * ProactiveInsightCard — mostra un insight proattivo di Wendy.
 *
 * Design: card compatta con icona tipo-insight, titolo, corpo breve,
 * CTA opzionale e pulsante di dismiss.
 *
 * Accessibility: focus-visible, role=article, aria-label con titolo.
 */
import { Button } from "@/components/ui/button";
import type { ProactiveInsight } from "@/hooks/useProactiveInsights";
import { cn } from "@/lib/utils";
import { BookOpen, Lightbulb, Newspaper, TrendingUp, X, Zap } from "lucide-react";
import { useRef } from "react";
import { Link } from "wouter";

const TYPE_META: Record<ProactiveInsight["insightType"], {
  icon:  React.ElementType;
  label: string;
  color: string;
  bg:    string;
}> = {
  weak_signal:     { icon: TrendingUp, label: "Ruolo emergente",    color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
  skill_gap:       { icon: Zap,        label: "Gap di skill",        color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" },
  plan_update:     { icon: BookOpen,   label: "Piano di studio",     color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" },
  news:            { icon: Newspaper,  label: "News rilevante",      color: "text-purple-600 dark:text-purple-400",bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800" },
  trend_alignment: { icon: Lightbulb, label: "Trend & idea",         color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800" },
};

interface ProactiveInsightCardProps {
  insight:    ProactiveInsight;
  onRead?:    (id: number) => void;
  onDismiss?: (id: number) => void;
  className?: string;
}

export function ProactiveInsightCard({ insight, onRead, onDismiss, className }: ProactiveInsightCardProps) {
  const meta     = TYPE_META[insight.insightType] ?? TYPE_META.weak_signal;
  const Icon     = meta.icon;
  const isUnread = !insight.readAt;
  const cardRef  = useRef<HTMLElement>(null);

  function handleRead() {
    if (isUnread) onRead?.(insight.id);
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    onDismiss?.(insight.id);
  }

  return (
    <article
      ref={cardRef}
      role="article"
      aria-label={insight.title}
      onClick={handleRead}
      className={cn(
        "relative rounded-xl border p-4 transition-all cursor-pointer",
        "hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2",
        meta.bg,
        isUnread && "shadow-sm",
        className,
      )}
    >
      {/* Badge "non letto" */}
      {isUnread && (
        <span className="absolute top-3 right-10 h-2 w-2 rounded-full bg-primary" aria-hidden />
      )}

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Chiudi insight"
        className={cn(
          "absolute top-2.5 right-2.5 rounded-md p-1 opacity-60 hover:opacity-100",
          "text-muted-foreground hover:text-foreground transition-opacity",
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn("rounded-lg p-1.5", meta.bg)}>
          <Icon className={cn("h-4 w-4", meta.color)} />
        </span>
        <span className={cn("text-xs font-medium uppercase tracking-wide", meta.color)}>
          {meta.label}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-sm font-semibold text-foreground mb-1 pr-4 leading-snug">
        {insight.title}
      </h3>
      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
        {insight.body}
      </p>

      {/* CTA */}
      {insight.ctaLabel && insight.ctaTarget && (
        <div className="mt-3">
          <Link href={insight.ctaTarget} onClick={handleRead}>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              {insight.ctaLabel}
            </Button>
          </Link>
        </div>
      )}
    </article>
  );
}
