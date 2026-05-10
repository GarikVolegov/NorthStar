/**
 * GrowthChatInput — textarea + send/stop button.
 *
 * BEHAVIOUR
 * ─────────
 *  · Auto-resizes from 1 to 6 rows
 *  · Enter → send message
 *  · Shift+Enter → newline
 *  · Disabled while streaming (shows spinner)
 *  · Stop button (×) appears while streaming to abort mid-generation
 *  · Character count warning at 500+ chars
 */
import React, { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  onSend: (text: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function GrowthChatInput({
  onSend,
  onAbort,
  isStreaming,
  disabled = false,
  placeholder = "Scrivi qualcosa al tuo coach…",
}: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`; // max 6 rows ≈ 144px
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue("");
  }, [value, isStreaming, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isDisabled = disabled || (isStreaming && value.trim().length === 0);
  const charCount = value.length;
  const charWarning = charCount >= 500;

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-300 transition-all">
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "Il coach sta scrivendo…" : placeholder}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none leading-relaxed disabled:opacity-50"
          aria-label="Messaggio per il coach"
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            onClick={onAbort}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
            aria-label="Interrompi risposta"
            title="Interrompi"
          >
            {/* Stop icon */}
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="4" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={isDisabled || !value.trim()}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Invia messaggio"
            title="Invia (Enter)"
          >
            {/* Send icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Character count warning */}
      {charWarning && (
        <p className="text-right text-xs text-amber-500 mt-1">
          {charCount} / 1000 caratteri
        </p>
      )}
    </div>
  );
}
