/**
 * GrowthChatPanel v2 — integrates ParallelStatusPanel + statusMessage.
 *
 * CHANGES v2
 * ──────────
 * - Imports `statusMessage` from useGrowthChat (added in v4 of the hook).
 * - Maintains a `statusHistory` ref that accumulates every status event
 *   received during the current streaming turn. It is reset when a new
 *   user message is sent (isStreaming flips from false → true).
 * - When statusMessage contains a "[domain]" prefix, renders
 *   `<ParallelStatusPanel>` ABOVE the input area (inside the message list).
 * - For non-parallel status (single specialist / fallback), renders a
 *   compact pill below the last message.
 * - ParallelStatusPanel is hidden as soon as isStreaming = false.
 *
 * LAYOUT (updated)
 * ────────────────
 *  ┌──────────────────────────────────────┐
 *  │  Header: "Coach NorthStar"  [Reset]  │
 *  ├──────────────────────────────────────┤
 *  │                                      │
 *  │   Message list (scrollable)          │
 *  │   · Empty state / messages           │
 *  │                                      │
 *  │   [ParallelStatusPanel] ← if parallel│
 *  │   [status pill]         ← if single  │
 *  │                                      │
 *  ├──────────────────────────────────────┤
 *  │  GrowthChatInput                     │
 *  └──────────────────────────────────────┘
 */
import React, { useEffect, useRef, useState } from "react";
import { useGrowthChat, type UseGrowthChatOptions } from "./useGrowthChat";
import { GrowthChatMessage } from "./GrowthChatMessage";
import { GrowthChatInput } from "./GrowthChatInput";
import { ParallelStatusPanel } from "./ParallelStatusPanel";

const SUGGESTED_PROMPTS = [
  "Sono bloccato su una decisione importante — come inizio a chiarirmi?",
  "Voglio capire cosa mi impedisce di avanzare verso il mio obiettivo",
  "Ho paura di sbagliare. Come smetto di procrastinare?",
];

interface GrowthChatPanelProps extends UseGrowthChatOptions {
  /** Additional Tailwind classes for the outer container */
  className?: string;
}

export function GrowthChatPanel({ className = "", ...hookOpts }: GrowthChatPanelProps) {
  const { messages, isStreaming, error, statusMessage, sendMessage, abort, resetSession } =
    useGrowthChat(hookOpts);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const scrollRef  = useRef<HTMLDivElement>(null);
  const prevStreaming = useRef(false);

  // Accumulate ALL status values for the current streaming turn.
  // Reset each time a new turn starts (isStreaming flips false → true).
  const [statusHistory, setStatusHistory] = useState<string[]>([]);

  useEffect(() => {
    // New turn starting — clear history
    if (isStreaming && !prevStreaming.current) {
      setStatusHistory([]);
    }
    prevStreaming.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    if (statusMessage) {
      setStatusHistory((prev) => [...prev, statusMessage]);
    }
  }, [statusMessage]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusMessage]);

  const isEmpty = messages.length === 0;

  const lastAssistantIdx = messages.reduce(
    (last, m, i) => (m.role === "assistant" ? i : last),
    -1,
  );

  // Is the current status from a parallel handoff?
  const isParallelStatus = statusMessage
    ? /^\[[a-z]+\]/.test(statusMessage) || statusMessage.includes("parallelo") || statusMessage.includes("Fusione")
    : statusHistory.some((s) => /^\[[a-z]+\]/.test(s));

  // Non-parallel single-line status
  const showSingleStatus = isStreaming && statusMessage && !isParallelStatus;
  const showParallelPanel = isStreaming && isParallelStatus && statusHistory.some((s) => /^\[[a-z]+\]/.test(s));

  return (
    <div
      className={`flex flex-col h-full bg-gray-50 rounded-2xl overflow-hidden shadow-sm border border-gray-200 ${
        className
      }`}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">N</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Coach NorthStar</p>
            <p className="text-xs text-gray-400">
              {isStreaming ? (
                <span className="text-indigo-500 animate-pulse">
                  {isParallelStatus ? "⚡ Multi-agente attivo" : "Sta elaborando…"}
                </span>
              ) : (
                "Crescita personale"
              )}
            </p>
          </div>
        </div>

        {!isEmpty && (
          <button
            onClick={resetSession}
            disabled={isStreaming}
            className="text-xs text-gray-400 hover:text-red-400 disabled:opacity-40 transition-colors"
            title="Nuova conversazione"
          >
            Nuova sessione
          </button>
        )}
      </div>

      {/* ── Message list ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <span className="text-2xl">🧭</span>
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              Il tuo coach è pronto
            </h3>
            <p className="text-sm text-gray-400 mb-6 max-w-xs">
              Condividi dove sei bloccato o cosa vuoi esplorare. Il coach ricorda
              le sessioni precedenti.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  className="text-left text-sm px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-sm transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <GrowthChatMessage
              key={msg.id}
              message={msg}
              isLastAssistant={i === lastAssistantIdx}
            />
          ))
        )}

        {/* ── Single-specialist status pill ──────────────────────── */}
        {showSingleStatus && (
          <div className="flex items-center gap-2 px-4 py-2.5 mx-2 rounded-xl bg-white border border-gray-100 shadow-sm">
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 animate-pulse">{statusMessage}</p>
          </div>
        )}

        {/* ── Parallel split panel ───────────────────────────────── */}
        {showParallelPanel && (
          <ParallelStatusPanel
            statusMessage={statusMessage}
            statusHistory={statusHistory}
          />
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2">
            <span className="mt-0.5">⚠️</span>
            <div>
              <p className="font-medium">Qualcosa è andato storto</p>
              <p className="text-red-500 text-xs mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────── */}
      <GrowthChatInput
        onSend={sendMessage}
        onAbort={abort}
        isStreaming={isStreaming}
      />
    </div>
  );
}
