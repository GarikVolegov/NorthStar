/**
 * GrowthChatPanel — main chat container.
 *
 * LAYOUT
 * ──────
 *  ┌─────────────────────────────────────┐
 *  │  Header: "Coach NorthStar"  [Reset] │
 *  ├─────────────────────────────────────┤
 *  │                                     │
 *  │   Message list (scrollable)         │
 *  │   · Empty state with suggestions    │
 *  │   · Error banner                    │
 *  │                                     │
 *  ├─────────────────────────────────────┤
 *  │  GrowthChatInput                    │
 *  └─────────────────────────────────────┘
 *
 * USAGE
 * ──────
 * import { GrowthChatPanel } from "@workspace/integrations-openai-ai-react";
 *
 * <GrowthChatPanel
 *   token={jwt}
 *   userContext={{ name: "Luca", journeyType: "autonomo" }}
 * />
 *
 * The panel manages its own state via useGrowthChat — no external state needed.
 * Drop it inside any layout: page, sidebar, modal, drawer.
 */
import React, { useEffect, useRef } from "react";
import { useGrowthChat, type UseGrowthChatOptions } from "./useGrowthChat";
import { GrowthChatMessage } from "./GrowthChatMessage";
import { GrowthChatInput } from "./GrowthChatInput";

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
  const { messages, isStreaming, error, sendMessage, abort, resetSession } =
    useGrowthChat(hookOpts);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEmpty = messages.length === 0;

  // Find last assistant message index for streaming cursor
  const lastAssistantIdx = messages.reduce(
    (last, m, i) => (m.role === "assistant" ? i : last),
    -1,
  );

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
                <span className="text-indigo-500 animate-pulse">Sta scrivendo…</span>
              ) : (
                "Crescita personale"
              )}
            </p>
          </div>
        </div>

        {/* Reset session button */}
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
          /* Empty state */
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

            {/* Suggested prompts */}
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
          /* Message list */
          messages.map((msg, i) => (
            <GrowthChatMessage
              key={msg.id}
              message={msg}
              isLastAssistant={i === lastAssistantIdx}
            />
          ))
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

        {/* Auto-scroll anchor */}
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
