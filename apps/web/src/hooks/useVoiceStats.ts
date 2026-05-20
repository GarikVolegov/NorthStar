import { getJson } from "@/lib/apiClient";
import { useCallback, useEffect, useState } from "react";

export interface RecentSession {
  id: number;
  status: "ongoing" | "completed" | "abandoned";
  durationSeconds: number | null;
  xpAwarded: number;
  agentType: string | null;
  summary: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface VoiceStats {
  voiceStreak: number;
  totalXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  lastVoiceSessionAt: string | null;
  recentSessions: RecentSession[];
}

const POLL_INTERVAL_MS = 30_000;

export function useVoiceStats() {
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getJson<VoiceStats>("/api/voice/stats", {
        credentials: "include",
      });
      setStats(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
    const interval = setInterval(() => {
      void fetchStats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
