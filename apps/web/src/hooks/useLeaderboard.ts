import { getJson } from "@/lib/apiClient";
import { useCallback, useEffect, useState } from "react";

export type LeaderboardMode = "xp" | "streak";

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  avatarUrl: string | null;
  totalXp: number;
  voiceStreak: number;
  level: number;
  isSelf: boolean;
}

export interface LeaderboardData {
  mode: LeaderboardMode;
  entries: LeaderboardEntry[];
  selfRank: number | undefined;
}

const POLL_INTERVAL_MS = 60_000;

export function useLeaderboard(
  initialMode: LeaderboardMode = "xp",
  limit = 20,
) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LeaderboardMode>(initialMode);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const json = await getJson<LeaderboardData>(
        `/api/leaderboard?mode=${mode}&limit=${limit}`,
        { credentials: "include" },
      );
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
    const interval = setInterval(() => {
      void fetchLeaderboard();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return { data, loading, error, mode, setMode, refetch: fetchLeaderboard };
}
