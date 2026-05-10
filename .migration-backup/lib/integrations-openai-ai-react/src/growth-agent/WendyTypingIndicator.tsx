/**
 * WendyTypingIndicator — animated bounce dots shown while Wendy is composing.
 *
 * Usage:
 *   {isStreaming && !statusMessage && <WendyTypingIndicator />}
 */
import React from "react";

export interface WendyTypingIndicatorProps {
  /** Avatar label (default: "W") */
  label?: string;
  className?: string;
}

export function WendyTypingIndicator({
  label = "W",
  className = "",
}: WendyTypingIndicatorProps) {
  return (
    <div
      className={["flex items-end gap-2", className].join(" ")}
      aria-label="Wendy sta scrivendo"
      role="status"
    >
      {/* Avatar */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none">
        {label}
      </div>

      {/* Bubble */}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-muted-foreground opacity-60"
            style={{
              animation: `wendyBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Inline keyframe — no Tailwind plugin required */}
      <style>{`
        @keyframes wendyBounce {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.6; }
          30%            { transform: translateY(-5px); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
