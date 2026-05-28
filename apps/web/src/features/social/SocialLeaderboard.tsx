import { Avatar, EmptyState, ErrorState, LoadingList } from "@/features/social/SocialShared";
import { useLeaderboard, type LeaderboardEntry, type LeaderboardMode } from "@/hooks/useLeaderboard";
import { cn } from "@/lib/utils";
import { Flame, Sparkles, Trophy } from "lucide-react";
import { useState } from "react";

const MODES: Array<{ id: LeaderboardMode; label: string; icon: typeof Trophy }> = [
  { id: "xp", label: "XP totale", icon: Trophy },
  { id: "streak", label: "Streak", icon: Flame },
  { id: "weekly", label: "Settimana", icon: Sparkles },
];

function rankLabel(rank: number) {
  if (rank === 1) return "1";
  if (rank === 2) return "2";
  if (rank === 3) return "3";
  return String(rank || "-");
}

function metricFor(entry: LeaderboardEntry, mode: LeaderboardMode) {
  if (mode === "streak") return `${entry.voiceStreak ?? 0} giorni`;
  if (mode === "weekly") return `${entry.xpEarned ?? 0} XP`;
  return `${entry.totalXp ?? 0} XP`;
}

function progressFor(entry: LeaderboardEntry, mode: LeaderboardMode) {
  const value = mode === "weekly" ? entry.xpEarned ?? 0 : entry.totalXp ?? 0;
  return Math.max(8, Math.min(100, value % 100 || (value > 0 ? 100 : 8)));
}

function LeaderboardRow({ entry, mode }: { entry: LeaderboardEntry; mode: LeaderboardMode }) {
  return (
    <div
      className={cn(
        "grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl border bg-background p-3",
        entry.isSelf && "border-primary/30 bg-primary/5",
      )}
    >
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black", entry.rank <= 3 ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground")}>
        {rankLabel(entry.rank)}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar user={{ id: entry.userId, name: entry.name, avatarUrl: entry.avatarUrl ?? null }} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{entry.name}</p>
            <p className="text-xs text-muted-foreground">
              Livello {entry.level ?? Math.floor((entry.totalXp ?? 0) / 100)}
              {entry.isSelf ? <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Tu</span> : null}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progressFor(entry, mode)}%` }} />
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-black tabular-nums text-foreground">{metricFor(entry, mode)}</p>
        {mode === "weekly" && entry.sessionsCompleted !== undefined ? (
          <p className="text-[11px] text-muted-foreground">{entry.sessionsCompleted} sessioni</p>
        ) : null}
      </div>
    </div>
  );
}

export function SocialLeaderboard() {
  const [mode, setMode] = useState<LeaderboardMode>("xp");
  const query = useLeaderboard(mode);
  const entries = query.data?.entries ?? [];

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Confronta XP, streak e progressi della settimana.</p>
          </div>
          <div className="grid grid-cols-3 rounded-xl border bg-muted/40 p-1">
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
                  mode === id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <LoadingList rows={6} />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState title="Classifica vuota" description="Completa attivita e sessioni per comparire in classifica." />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <LeaderboardRow key={`${entry.userId}-${entry.rank}`} entry={entry} mode={mode} />
          ))}
        </div>
      )}
    </section>
  );
}
