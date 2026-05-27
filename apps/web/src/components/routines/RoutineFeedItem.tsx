import { Button } from "@/components/ui/button";
import type { RoutineExecution } from "@/hooks/useRoutines";
import { useState } from "react";
import { Link } from "wouter";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(diff / 3_600_000);
  const days    = Math.floor(diff / 86_400_000);

  if (minutes < 1)   return "Adesso";
  if (minutes < 60)  return `${minutes} min fa`;
  if (hours < 24)    return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
  if (days < 7)      return `${days} ${days === 1 ? "giorno" : "giorni"} fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(dateStr));
}

const MAX_BODY = 200;

interface RoutineFeedItemProps {
  execution: RoutineExecution;
  onRead:    (id: number) => void;
}

export function RoutineFeedItem({ execution, onRead }: RoutineFeedItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isUnread = execution.readAt === null;
  const bodyTruncated = execution.body.length > MAX_BODY && !expanded;
  const displayBody = bodyTruncated
    ? execution.body.slice(0, MAX_BODY) + "…"
    : execution.body;

  function handleExpand() {
    setExpanded(true);
    if (isUnread) onRead(execution.id);
  }

  return (
    <div className="flex gap-3 py-3 border-b border-border/50 last:border-0">
      {/* Unread dot */}
      <div className="mt-1.5 shrink-0">
        {isUnread ? (
          <span className="block h-2 w-2 rounded-full bg-primary" aria-label="Non letto" />
        ) : (
          <span className="block h-2 w-2 rounded-full bg-transparent" />
        )}
      </div>

      <div className="flex flex-col gap-1 min-w-0 flex-1">
        {/* Title */}
        <p className={isUnread ? "font-semibold text-sm leading-snug" : "font-medium text-sm leading-snug"}>
          {execution.title}
        </p>

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {displayBody}
        </p>

        {/* Expand / collapse */}
        {execution.body.length > MAX_BODY && (
          <button
            className="self-start text-xs text-primary hover:underline"
            onClick={expanded ? () => setExpanded(false) : handleExpand}
          >
            {expanded ? "Mostra meno" : "Mostra tutto"}
          </button>
        )}

        {/* CTA */}
        {execution.ctaLabel && execution.ctaTarget && (
          <div className="mt-1">
            <Link href={execution.ctaTarget}>
              <Button size="sm" variant="outline" className="text-xs h-7">
                {execution.ctaLabel}
              </Button>
            </Link>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground/60 mt-0.5">
          {timeAgo(execution.createdAt)}
        </span>
      </div>
    </div>
  );
}
