/**
 * GrowthChatMessage — renders a single message bubble.
 *
 * USER    → right-aligned, indigo bg, white text
 * COACH   → left-aligned, white card, dark text
 *           + blinking cursor while streaming
 *           + source pills below (knowledge sources used)
 *
 * Designed for Tailwind CSS — no external dependencies.
 */
import React from "react";
import type { ChatMessage } from "./useGrowthChat";

interface Props {
  message: ChatMessage;
  isLastAssistant: boolean;
}

export function GrowthChatMessage({ message, isLastAssistant }: Props) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming && isLastAssistant;

  return (
    <div
      role="article"
      aria-label={`Messaggio di ${isUser ? "utente" : "coach"}`}
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      } mb-4`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-3 mt-1">
          <span className="text-white text-xs font-bold">N</span>
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${
        isUser ? "items-end" : "items-start"
      }`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
          }`}
        >
          {message.content || (isStreaming ? "" : "…")}
          {/* Blinking cursor while streaming */}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 align-middle animate-pulse" />
          )}
        </div>

        {/* Source pills — only for assistant messages with sources */}
        {!isUser &&
          !isStreaming &&
          message.sources &&
          message.sources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
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

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-3 mt-1">
          <span className="text-gray-600 text-xs font-bold">Tu</span>
        </div>
      )}
    </div>
  );
}
