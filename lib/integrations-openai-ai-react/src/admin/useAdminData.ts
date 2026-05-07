/**
 * useAdminData — hook centralizzato per tutti i dati dell'admin dashboard.
 *
 * Espone:
 *   - agentHealth:     stato degli agenti (collector, enricher, personalizer, feed)
 *   - collectorStats:  risultato dell'ultimo run collector (bySource, totalInserted, errors)
 *   - recentItems:     ultimi 20 item raccolti (con stato enriched/raw)
 *   - triggerCollect:  lancia manualmente il collector
 *   - isRunning:       true se il collector è in esecuzione
 */
import { useState, useEffect, useCallback } from "react";

export interface AgentStatus {
  name:        string;
  status:      "ok" | "warning" | "error" | "unknown";
  lastRunAt?:  string | null;
  message?:    string | null;
  itemsCount?: number | null;
}

export interface CollectorStats {
  totalCollected: number;
  totalInserted:  number;
  bySource:       Record<string, number>;
  errors:         string[];
  durationMs:     number;
  ranAt?:         string;
}

export interface AdminItem {
  id:              number;
  type:            string;
  title:           string;
  url:             string;
  source:          string;
  collectorSource: string;
  isEnriched:      boolean;
  relevanceScore:  number;
  publishedAt?:    string | null;
  createdAt:       string;
}

export interface AdminStats {
  totalItems:    number;
  enrichedItems: number;
  totalSources:  number;
  enabledSources:number;
  lastCollectAt?:string | null;
}

export function useAdminData() {
  const [agents,         setAgents]         = useState<AgentStatus[]>([]);
  const [collectorStats, setCollectorStats] = useState<CollectorStats | null>(null);
  const [recentItems,    setRecentItems]    = useState<AdminItem[]>([]);
  const [adminStats,     setAdminStats]     = useState<AdminStats | null>(null);
  const [isRunning,      setIsRunning]      = useState(false);
  const [isLoading,      setIsLoading]      = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [healthRes, itemsRes] = await Promise.allSettled([
        fetch("/api/admin/agent-health", { credentials: "include" }),
        fetch("/api/admin/discovery/items?limit=20", { credentials: "include" }),
      ]);

      if (healthRes.status === "fulfilled" && healthRes.value.ok) {
        const data = await healthRes.value.json() as { agents?: AgentStatus[]; stats?: AdminStats };
        setAgents(data.agents ?? []);
        if (data.stats) setAdminStats(data.stats);
      }

      if (itemsRes.status === "fulfilled" && itemsRes.value.ok) {
        const data = await itemsRes.value.json() as { items?: AdminItem[]; stats?: AdminStats };
        setRecentItems(data.items ?? []);
        if (data.stats) setAdminStats((prev) => ({ ...(prev ?? {} as AdminStats), ...data.stats }));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const triggerCollect = useCallback(async () => {
    setIsRunning(true);
    setCollectorStats(null);
    try {
      const res = await fetch("/api/admin/discovery/collect", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as CollectorStats;
      setCollectorStats({ ...data, ranAt: new Date().toISOString() });
      await fetchAll(); // refresh dopo il run
    } catch (err) {
      setError(`Collector error: ${String(err)}`);
    } finally {
      setIsRunning(false);
    }
  }, [fetchAll]);

  return {
    agents,
    collectorStats,
    recentItems,
    adminStats,
    isRunning,
    isLoading,
    error,
    refetch: fetchAll,
    triggerCollect,
  };
}
