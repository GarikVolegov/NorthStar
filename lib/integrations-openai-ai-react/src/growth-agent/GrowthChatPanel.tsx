/**
 * GrowthChatPanel v4 — Contextual Copilot integration (Points 4 & 5).
 *
 * CHANGES vs v3:
 * - Accepts optional `initialMessage` prop: when set the panel sends it
 *   automatically on mount (used by WendyContextButton to pre-fill + auto-send)
 * - Accepts optional `pageContext` prop: JSON blob forwarded to sendMessage
 *   so runGrowthAgent can inject it into the prompt
 * - useWendyPageContext: reads global page context set by WendyContextButton
 *   and merges it into every outbound message's userContext
 * - All v3 behaviour (typing indicator, thinking status, toasts, retry,
 *   voice, gamification) unchanged
 */
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useWendyVoiceSession }  from "./useWendyVoiceSession";
import { useVoiceStream }        from "../audio/useVoiceStream";
import { GrowthChatMessage }     from "./GrowthChatMessage";
import { GrowthChatInput }       from "./GrowthChatInput";
import { WendyTypingIndicator }  from "./WendyTypingIndicator";
import { WendyThinkingStatus }   from "./WendyThinkingStatus";
import { useWendyToast }         from "./useWendyToast";
import { WendyToast }            from "./WendyToast";
import { useWendyPageContext }   from "./WendyPageContext";
import { XpStreakBadge }         from "@/components/gamification/XpStreakBadge";
import { XpRewardToast }         from "@/components/gamification/XpRewardToast";

export interface GrowthChatPanelProps {
  token: string;
  userContext?: {
    name?: string; journeyType?: string; userMode?: string;
    objectives?: string[]; sectorName?: string;
    /** Arbitrary page context forwarded to the AI */
    pageContext?: Record<string, unknown>;
  };
  className?: string;
  workletPath?: string;
  /**
   * Optional pre-filled message.
   * When provided the panel sends it automatically after mount.
   * Used by WendyContextButton to trigger a contextual question.
   */
  initialMessage?: string;
}

export function GrowthChatPanel({
  token,
  userContext: userContextProp,
  className = "",
  workletPath = "/audio-playback-worklet.js",
  initialMessage,
}: GrowthChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [lastInput, setLastInput]   = useState<string | null>(null);
  const didAutoSend = useRef(false);

  // ── Global page context (set by WendyContextButton on any page) ────────────
  const { context: pageCtx } = useWendyPageContext();

  // ── Merge prop-level + global page context ─────────────────────────────
  const userContext = {
    ...userContextProp,
    pageContext: pageCtx
      ? { pageId: pageCtx.pageId, pageLabel: pageCtx.pageLabel, ...pageCtx.data }
      : userContextProp?.pageContext,
  };

  // ── Toast system ──────────────────────────────────────────────────────
  const { toasts, addToast, removeToast } = useWendyToast(5000);

  // ── Wendy voice session ───────────────────────────────────────────────
  const wendy = useWendyVoiceSession({ token, userContext, workletPath });

  // ── Voice stream ───────────────────────────────────────────────────────
  const { streamVoiceResponse } = useVoiceStream(wendy.voiceStreamCallbacks);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wendy.messages]);

  // ── Surface new errors as toasts ─────────────────────────────────────────
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    const current = wendy.error ?? wendy.sessionError ?? null;
    if (current && current !== prevErrorRef.current) addToast(current, "error");
    prevErrorRef.current = current;
  }, [wendy.error, wendy.sessionError, addToast]);

  // ── Auto-send initialMessage on first mount ──────────────────────────────
  useEffect(() => {
    if (initialMessage && !didAutoSend.current && !wendy.isStreaming) {
      didAutoSend.current = true;
      setLastInput(initialMessage);
      void wendy.sendMessage(initialMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — fires once on mount

  // ── Text message send ──────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || wendy.isStreaming) return;
    setLastInput(text);
    setInputValue("");
    void wendy.sendMessage(text);
  }, [inputValue, wendy]);

  // ── Retry ─────────────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (!lastInput || wendy.isStreaming) return;
    void wendy.sendMessage(lastInput);
  }, [lastInput, wendy]);

  // ── Voice toggle ──────────────────────────────────────────────────────
  const handleVoiceToggle = useCallback(async () => {
    if (wendy.voiceActive) await wendy.stopVoiceSession();
    else await wendy.startVoiceSession();
  }, [wendy]);

  const hasError = Boolean(wendy.error ?? wendy.sessionError);
  const showTypingDots = wendy.isStreaming && !wendy.statusMessage;

  return (
    <>
      <div
        className={[
          "relative flex flex-col h-full min-h-0 rounded-2xl border border-border bg-card overflow-hidden",
          className,
        ].join(" ")}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">Wendy</span>
            {/* Show page context badge when active */}
            {pageCtx && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-medium text-primary">
                📌 {pageCtx.pageLabel}
              </span>
            )}
            {wendy.voiceActive && (
              <span className="flex items-center gap-1 text-xs text-red-500 font-medium animate-pulse">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                In ascolto
              </span>
            )}
          </div>
          <XpStreakBadge compact />
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {wendy.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2 py-12">
              <span className="text-3xl">🎙️</span>
              <p>
                {pageCtx
                  ? `Ciao! Sono pronta a parlare di ${pageCtx.pageLabel} — cosa vuoi sapere?`
                  : "Scrivi o parla con Wendy"}
              </p>
            </div>
          )}

          {wendy.messages.map((msg) => (
            <GrowthChatMessage key={msg.id} message={msg} />
          ))}

          <WendyThinkingStatus message={wendy.statusMessage ?? null} />
          {showTypingDots && <WendyTypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Error banner + Retry ── */}
        {hasError && (
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800 shrink-0">
            <span className="flex-1">⚠️ {wendy.error ?? wendy.sessionError}</span>
            {lastInput && (
              <button
                onClick={handleRetry}
                disabled={wendy.isStreaming}
                className="shrink-0 rounded-lg border border-red-300 dark:border-red-700 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
              >
                🔄 Riprova
              </button>
            )}
          </div>
        )}

        {/* ── Input ── */}
        <div className="shrink-0 border-t border-border px-3 py-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <GrowthChatInput
                value={inputValue}
                onChange={setInputValue}
                onSend={handleSend}
                disabled={wendy.isStreaming || wendy.voiceActive}
                placeholder={wendy.voiceActive ? "Sessione vocale attiva…" : "Scrivi a Wendy…"}
              />
            </div>
            <button
              onClick={handleVoiceToggle}
              disabled={wendy.isStreaming}
              title={wendy.voiceActive ? "Termina sessione vocale" : "Avvia sessione vocale"}
              className={[
                "mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                wendy.voiceActive
                  ? "border-red-400 bg-red-500 text-white hover:bg-red-600"
                  : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                wendy.isStreaming ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {wendy.voiceActive ? "⏹" : "🎙️"}
            </button>
          </div>
        </div>

        <WendyToast toasts={toasts} onRemove={removeToast} />
      </div>

      {wendy.reward && (
        <XpRewardToast
          xpAwarded={wendy.reward.xpAwarded}
          newStreak={wendy.reward.newStreak}
          streakBumped={wendy.reward.streakBumped}
          onClose={wendy.clearReward}
        />
      )}
    </>
  );
}
