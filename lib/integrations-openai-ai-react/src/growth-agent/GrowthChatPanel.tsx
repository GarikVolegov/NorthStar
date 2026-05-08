/**
 * GrowthChatPanel v2 — Phase 3 voice gamification integration.
 *
 * CHANGES vs v1:
 * - Importa useWendyVoiceSession invece di useGrowthChat direttamente
 * - Bottone microfono nel chat input per avviare/terminare la sessione vocale
 * - Mostra XpRewardToast quando una sessione vocale si completa
 * - Mostra XpStreakBadge compact in alto a destra nel pannello
 * - Tutto il resto (testo chat, analytics, memoria) invariato
 */
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useWendyVoiceSession } from "./useWendyVoiceSession";
import { useVoiceStream }       from "../audio/useVoiceStream";
import { GrowthChatMessage }    from "./GrowthChatMessage";
import { GrowthChatInput }      from "./GrowthChatInput";
import { XpStreakBadge }        from "@/components/gamification/XpStreakBadge";
import { XpRewardToast }        from "@/components/gamification/XpRewardToast";

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

  // ── Wendy voice session (chat + gamification bridge) ──────────────────
  const wendy = useWendyVoiceSession({ token, userContext, workletPath });

  // ── Voice stream (TTS/STT pipeline) ───────────────────────────────────
  const { streamVoiceResponse } = useVoiceStream(wendy.voiceStreamCallbacks);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wendy.messages]);

  // ── Text message send ──────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || wendy.isStreaming) return;
    setInputValue("");
    void wendy.sendMessage(text);    // text mode: voiceMode = false (default)
  }, [inputValue, wendy]);

  // ── Voice toggle ──────────────────────────────────────────────────────
  const handleVoiceToggle = useCallback(async () => {
    if (wendy.voiceActive) {
      await wendy.stopVoiceSession();
    } else {
      await wendy.startVoiceSession();
    }
  }, [wendy]);

  return (
    <>
      <div
        className={[
          "flex flex-col h-full min-h-0 rounded-2xl border border-border bg-card overflow-hidden",
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
          {/* Streak badge compact */}
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
          {wendy.statusMessage && (
            <div className="text-xs text-muted-foreground italic px-2">{wendy.statusMessage}</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Error ── */}
        {(wendy.error ?? wendy.sessionError) && (
          <div className="px-4 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800">
            ⚠️ {wendy.error ?? wendy.sessionError}
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
