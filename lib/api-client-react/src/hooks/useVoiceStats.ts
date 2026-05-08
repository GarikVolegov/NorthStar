/**
 * useVoiceStats
 *
 * Hook React che:
 * 1. Fetcha GET /api/voice/stats al mount
 * 2. Ripete il fetch ogni 30 secondi (polling)
 * 3. Espone refetch() per aggiornamento manuale post-sessione
 * 4. Pulisce l'interval al dismount (no memory leak)
 *
 * Usage:
 *   const { stats, loading, error, refetch } = useVoiceStats();
 */
import { useState, useEffect, useCallback } from "react";

export interface RecentSession {
  id:              number;
  status:          "ongoing" | "completed" | "abandoned";
  durationSeconds: number | null;
  xpAwarded:       number;
  agentType:       string | null;
  summary:         string | null;
  startedAt:       string;
  completedAt:     string | null;
}

export interface VoiceStats {
  voiceStreak:        number;
  totalXp:            number;
  currentLevel:       number;
  xpToNextLevel:      number;
  lastVoiceSessionAt: string | null;
  recentSessions:     RecentSession[];
}

const POLL_INTERVAL_MS = 30_000;

export function useVoiceStats() {
  const [stats,   setStats]   = useState<VoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/voice/stats", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as VoiceStats;
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
    const interval = setInterval(() => { void fetchStats(); }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
