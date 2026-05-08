/**
 * GrowthChatPanel v3 — Visual Feedback & Error Handling (Phase 4).
 *
 * CHANGES vs v2:
 * - WendyTypingIndicator: shown while isStreaming and no statusMessage active
 * - WendyThinkingStatus:  shown when statusMessage is set (long-running request)
 * - useWendyToast + WendyToast: toast queue for network/API errors
 * - Error banner: now includes a "🔄 Riprova" button when lastInput is available
 * - lastInput ref: tracks last sent text to enable retry without resetting session
 * - prevErrorRef: deduplicates toast pushes when same error persists across renders
 * - All other behaviour (voice, gamification, text chat) unchanged
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
import { XpStreakBadge }         from "@/components/gamification/XpStreakBadge";
import { XpRewardToast }         from "@/components/gamification/XpRewardToast";

export interface GrowthChatPanelProps {
  token: string;
  userContext?: {
    name?: string; journeyType?: string; userMode?: string;
    objectives?: string[]; sectorName?: string;
  };
  className?: string;
  workletPath?: string;
}

export function GrowthChatPanel({
  token,
  userContext,
  className = "",
  workletPath = "/audio-playback-worklet.js",
}: GrowthChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  /** Last text sent by user — kept for retry */
  const [lastInput, setLastInput] = useState<string | null>(null);

  // ── Toast system ──────────────────────────────────────────────────────
  const { toasts, addToast, removeToast } = useWendyToast(5000);

  // ── Wendy voice session (chat + gamification bridge) ──────────────────
  const wendy = useWendyVoiceSession({ token, userContext, workletPath });

  // ── Voice stream (TTS/STT pipeline) ───────────────────────────────────
  const { streamVoiceResponse } = useVoiceStream(wendy.voiceStreamCallbacks);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wendy.messages]);

  // ── Surface new errors as toasts (dedup via prevErrorRef) ─────────────
  const prevErrorRef = useRef<string | null>(null);
  useEffect(() => {
    const current = wendy.error ?? wendy.sessionError ?? null;
    if (current && current !== prevErrorRef.current) {
      addToast(current, "error");
    }
    prevErrorRef.current = current;
  }, [wendy.error, wendy.sessionError, addToast]);

  // ── Text message send ──────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || wendy.isStreaming) return;
    setLastInput(text);
    setInputValue("");
    void wendy.sendMessage(text);
  }, [inputValue, wendy]);

  // ── Retry last message ────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    if (!lastInput || wendy.isStreaming) return;
    void wendy.sendMessage(lastInput);
  }, [lastInput, wendy]);

  // ── Voice toggle ──────────────────────────────────────────────────────
  const handleVoiceToggle = useCallback(async () => {
    if (wendy.voiceActive) {
      await wendy.stopVoiceSession();
    } else {
      await wendy.startVoiceSession();
    }
  }, [wendy]);

  const hasError = Boolean(wendy.error ?? wendy.sessionError);
  /** Show bounce dots only while streaming AND no status text is active */
  const showTypingDots = wendy.isStreaming && !wendy.statusMessage;

  return (
    <>
      {/* ── Panel wrapper (relative for WendyToast positioning) ── */}
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
              <p>Scrivi o parla con Wendy</p>
            </div>
          )}

          {wendy.messages.map((msg) => (
            <GrowthChatMessage key={msg.id} message={msg} />
          ))}

          {/* Thinking pill — visible during long-running status events */}
          <WendyThinkingStatus message={wendy.statusMessage ?? null} />

          {/* Typing indicator — visible while streaming, no status text */}
          {showTypingDots && <WendyTypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Error banner + Retry button ── */}
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

            {/* Mic button */}
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

        {/* ── Toast notifications (absolute inside panel) ── */}
        <WendyToast toasts={toasts} onRemove={removeToast} />
      </div>

      {/* ── XP Reward Toast ── */}
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
