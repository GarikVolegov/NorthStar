/**
 * GrowthChatMessage v2 — adds confidence badge for assistant messages.
 *
 * BADGE LOGIC
 * ───────────
 *  high   → no badge (coach is confident)
 *  medium → 🔶 amber badge "Risposta parziale" with tooltip listing reasons
 *  low    → ⚠️  red  badge "Contesto insufficiente" with tooltip
 *
 * Tooltip shows the specific reasons (from EvalResult.reasons).
 * Badge only appears after streaming is complete.
 */
import React, { useState } from "react";
import type { ChatMessage, ConfidenceLevel } from "./useGrowthChat";

interface Props {
  message: ChatMessage;
  isLastAssistant: boolean;
}

function ConfidenceBadge({
  level,
  score,
}: {
  level: ConfidenceLevel;
  score: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (level === "high") return null;

  const config = {
    medium: {
      icon: "🔶",
      label: "Risposta parziale",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      dot: "bg-amber-400",
    },
    low: {
      icon: "⚠️",
      label: "Contesto insufficiente",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      dot: "bg-red-400",
    },
  }[level];

  return (
    <div className="relative mt-2">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
          config.bg
        } ${config.border} ${config.text} cursor-help`}
        aria-label={`Livello di confidenza: ${level}`}
      >
        <span>{config.icon}</span>
        <span className="font-medium">{config.label}</span>
        <span className="opacity-60">({Math.round(score * 100)}%)</span>
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg z-10">
          <p className="font-semibold mb-1">Perché questa risposta è {level === "low" ? "incerta" : "parziale"}:</p>
          <ul className="space-y-1 list-disc list-inside text-gray-300">
            {level === "medium" && (
              <li>Contesto parziale — il coach ha risposto con assunzioni esplicite</li>
            )}
            {level === "low" && (
              <>
                <li>Documentazione insufficiente nella knowledge base</li>
                <li>La domanda potrebbe essere troppo vaga</li>
                <li>Condividi più dettagli per una risposta precisa</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function GrowthChatMessage({ message, isLastAssistant }: Props) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming && isLastAssistant;

  return (
    <div
      role="article"
      aria-label={`Messaggio di ${isUser ? "utente" : "coach"}`}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-3 mt-1">
          <span className="text-white text-xs font-bold">N</span>
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
          }`}
        >
          {message.content || (isStreaming ? "" : "…")}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 align-middle animate-pulse" />
          )}
        </div>

        {/* Confidence badge — only after stream completes */}
        {!isUser && !isStreaming && message.evalLevel && message.evalScore !== undefined && (
          <ConfidenceBadge level={message.evalLevel} score={message.evalScore} />
        )}

        {/* Source pills */}
        {!isUser && !isStreaming && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.sources.slice(0, 4).map((s, i) => (
              <span
                key={i}
                title={s.source}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 border border-gray-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1" />
                {s.source.length > 24 ? s.source.slice(0, 24) + "…" : s.source}
              </span>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-3 mt-1">
          <span className="text-gray-600 text-xs font-bold">Tu</span>
        </div>
      )}
    </div>
  );
}
