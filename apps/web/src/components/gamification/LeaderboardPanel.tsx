"use client";
import React from "react";
import { useLeaderboard, type LeaderboardEntry } from "@/hooks/useLeaderboard";

const XP_PER_LEVEL = 200;

function levelColor(level: number): string {
  if (level >= 10) return "text-purple-500";
  if (level >= 5)  return "text-blue-500";
  if (level >= 3)  return "text-emerald-500";
  return "text-muted-foreground";
}

function rankEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0" />;
  }
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

function EntryRow({ entry, showStreak }: { entry: LeaderboardEntry; showStreak: boolean }) {
  const xpIntoLevel = entry.totalXp % XP_PER_LEVEL;
  const progressPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);

  return (
    <div className={[
      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
      entry.isSelf ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50",
    ].join(" ")}>
      <span className="w-8 text-center text-base shrink-0 font-mono">{rankEmoji(entry.rank)}</span>
      <Avatar name={entry.name} avatarUrl={entry.avatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-medium truncate">
            {entry.name}
            {entry.isSelf && <span className="ml-1 text-xs text-primary font-normal">(tu)</span>}
          </span>
          <span className={`text-xs font-semibold shrink-0 ${levelColor(entry.level)}`}>Lv.{entry.level}</span>
        </div>
        {!showStreak && (
          <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        {showStreak ? (
          <span className="text-sm font-bold text-orange-500">🔥 {entry.voiceStreak}g</span>
        ) : (
          <span className="text-sm font-bold text-yellow-500">⚡ {entry.totalXp}</span>
        )}
      </div>
    </div>
  );
}

interface Props {
  limit?: number;
  className?: string;
}

export function LeaderboardPanel({ limit = 20, className = "" }: Props) {
  const { data, loading, error, mode, setMode, refetch } = useLeaderboard("xp", limit);

  return (
    <div className={`rounded-2xl border border-border bg-card flex flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-base font-semibold">🏆 Classifica</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setMode("xp")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${mode === "xp" ? "bg-yellow-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>⚡ XP</button>
          <button onClick={() => setMode("streak")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${mode === "streak" ? "bg-orange-500 text-white" : "text-muted-foreground hover:text-foreground"}`}>🔥 Streak</button>
          <button onClick={() => void refetch()} title="Aggiorna" className="ml-1 text-muted-foreground hover:text-foreground transition-colors text-xs">↻</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="flex flex-col gap-2 px-1 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 px-3 py-2.5">
                <div className="h-5 w-6 rounded bg-muted" />
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-muted" />
                  <div className="h-1.5 w-full rounded-full bg-muted" />
                </div>
                <div className="h-4 w-10 rounded bg-muted" />
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-center text-sm text-red-500 py-8">⚠️ {error}</p>}
        {!loading && !error && data && (
          <div className="flex flex-col gap-0.5">
            {data.entries.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nessun dato disponibile.</p>
            ) : (
              data.entries.map((entry) => <EntryRow key={entry.userId} entry={entry} showStreak={mode === "streak"} />)
            )}
          </div>
        )}
        {!loading && data && data.selfRank && !data.entries.some((e) => e.isSelf) && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-center text-sm">
            La tua posizione: <strong>#{data.selfRank}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
