/**
 * XpStreakBadge.tsx — Phase 3 Gamification Base
 *
 * Mostra streak vocale corrente + barra XP con livello.
 * Usabile ovunque nel frontend: navbar, dashboard, pagina voice.
 *
 * Props:
 *   compact?: boolean  — versione mini (solo icone + numeri, senza barra)
 */
"use client";

import React from "react";
import { useVoiceStats } from "@/lib/api-client-react/src/voice";

interface Props {
  compact?: boolean;
}

export function XpStreakBadge({ compact = false }: Props) {
  const { data, isLoading } = useVoiceStats();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-5 w-16 rounded-full bg-muted" />
        <div className="h-5 w-20 rounded-full bg-muted" />
      </div>
    );
  }

  if (!data) return null;

  const { voiceStreak, totalXp, currentLevel, xpToNextLevel } = data;
  const xpIntoLevel = (totalXp % 200);
  const progressPct = Math.round((xpIntoLevel / 200) * 100);

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm font-medium">
        {/* Streak */}
        <span
          className="flex items-center gap-1 text-orange-500"
          title={`${voiceStreak} giorni consecutivi`}
        >
          🔥 <span>{voiceStreak}</span>
        </span>

        {/* XP */}
        <span
          className="flex items-center gap-1 text-yellow-500"
          title={`${totalXp} XP totali — Livello ${currentLevel}`}
        >
          ⚡ <span>{totalXp} XP</span>
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 w-full max-w-xs">
      {/* Header row */}
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-1 text-orange-500">
          🔥 Streak
          <span className="ml-1 text-foreground">{voiceStreak}g</span>
        </span>
        <span className="flex items-center gap-1 text-yellow-500">
          ⚡ Lv.{currentLevel}
          <span className="ml-1 text-muted-foreground text-xs font-normal">
            ({totalXp} XP)
          </span>
        </span>
      </div>

      {/* XP progress bar */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {xpToNextLevel} XP al livello {currentLevel + 1}
        </p>
      </div>
    </div>
  );
}
