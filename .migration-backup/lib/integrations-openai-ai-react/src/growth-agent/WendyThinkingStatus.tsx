/**
 * WendyThinkingStatus — pulsing pill for long-running AI requests.
 *
 * Renders whenever `message` is a non-empty string; hides itself when null.
 *
 * Usage:
 *   <WendyThinkingStatus message={statusMessage} />
 */
import React from "react";

export interface WendyThinkingStatusProps {
  message: string | null;
  className?: string;
}

export function WendyThinkingStatus({
  message,
  className = "",
}: WendyThinkingStatusProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-center gap-2 self-start rounded-full border border-border",
        "bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm",
        className,
      ].join(" ")}
    >
      {/* Spinner */}
      <span
        className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      <span className="truncate max-w-[240px]">{message}</span>
    </div>
  );
}
