/**
 * useLeaderboard
 *
 * Hook React che fetcha GET /api/leaderboard.
 * Supporta due modalità: "xp" (default) e "streak".
 *
 * Usage:
 *   const { entries, selfRank, loading, error, setMode, refetch } = useLeaderboard();
 */
import { useState, useEffect, useCallback } from "react";

export type LeaderboardMode = "xp" | "streak";

export interface LeaderboardEntry {
  rank:        number;
  userId:      number;
  name:        string;
  avatarUrl:   string | null;
  totalXp:     number;
  voiceStreak: number;
  level:       number;
  isSelf:      boolean;
}

export interface LeaderboardData {
  mode:     LeaderboardMode;
  entries:  LeaderboardEntry[];
  selfRank: number | undefined;
}

const POLL_INTERVAL_MS = 60_000; // 1 minuto — la classifica non deve sparare troppi refresh

export function useLeaderboard(initialMode: LeaderboardMode = "xp", limit = 20) {
  const [data,    setData]    = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [mode,    setMode]    = useState<LeaderboardMode>(initialMode);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leaderboard?mode=${mode}&limit=${limit}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as LeaderboardData;
      setData(json);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, limit]);

  useEffect(() => {
    void fetchLeaderboard();
    const interval = setInterval(() => { void fetchLeaderboard(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return { data, loading, error, mode, setMode, refetch: fetchLeaderboard };
}
