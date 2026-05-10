/**
 * useAdminStats
 *
 * Hook React che:
 * 1. Fetcha /api/admin/stats al mount
 * 2. Ripete il fetch ogni 30 secondi (polling)
 * 3. Restituisce loading:true finché il primo fetch non è completato
 * 4. Pulisce l'interval al dismount (no memory leak)
 *
 * Usage:
 *   const { stats, loading, error, refetch } = useAdminStats();
 */
import { useState, useEffect, useCallback } from "react";

export interface AdminStats {
  totalUsers:          number;
  newUsersToday:       number;
  activeUsersWeek:     number;
  totalSessions:       number;
  discoveryItems:      number;
  discoverySources:    number;
  stripeRevenue:       number | null;
  stripeOrders:        number | null;
  fetchedAt:           string;
}

const POLL_INTERVAL_MS = 30_000;

export function useAdminStats() {
  const [stats,   setStats]   = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminStats = await res.json() as AdminStats;
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
