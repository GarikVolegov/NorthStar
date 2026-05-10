/**
 * WendyToast — renders the toast queue from useWendyToast.
 *
 * Mount once inside GrowthChatPanel (which must have `position: relative`):
 *   <WendyToast toasts={toasts} onRemove={removeToast} />
 *
 * Toasts stack bottom-right, inside the panel bounds — no React portal needed.
 */
import React from "react";
import type { WendyToastItem } from "./useWendyToast";

const TYPE_STYLES: Record<WendyToastItem["type"], string> = {
  error:   "bg-red-600    text-white border-red-700",
  warning: "bg-yellow-500 text-white border-yellow-600",
  info:    "bg-blue-600   text-white border-blue-700",
  success: "bg-green-600  text-white border-green-700",
};

const TYPE_ICONS: Record<WendyToastItem["type"], string> = {
  error:   "⚠️",
  warning: "🔔",
  info:    "ℹ️",
  success: "✅",
};

export interface WendyToastProps {
  toasts: WendyToastItem[];
  onRemove: (id: string) => void;
}

export function WendyToast({ toasts, onRemove }: WendyToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-atomic="false"
      className="pointer-events-none absolute bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={[
            "pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg",
            TYPE_STYLES[t.type],
          ].join(" ")}
        >
          <span aria-hidden>{TYPE_ICONS[t.type]}</span>
          <span className="flex-1 max-w-[260px] break-words">{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            className="ml-2 shrink-0 text-white/80 hover:text-white transition-colors"
            aria-label="Chiudi notifica"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
