/**
 * useGrowthAnalytics — fetches session analytics from the API.
 *
 * STATE
 *   data       AnalyticsData | null
 *   isLoading  boolean
 *   error      string | null
 *   refresh()  manual refetch
 */
import { useState, useEffect, useCallback } from "react";

export interface TopicEntry {
  topic: string;
  count: number;
}

export interface TrendEntry {
  date: string;   // ISO date string 'YYYY-MM-DD'
  avg: number;    // 0-1
}

export interface LevelBreakdown {
  high: number;
  medium: number;
  low: number;
}

export interface AnalyticsData {
  totalSessions:   number;
  totalMessages:   number;
  avgConfidence:   number | null;
  topTopics:       TopicEntry[];
  confidenceTrend: TrendEntry[];
  levelBreakdown:  LevelBreakdown;
  streakDays:      number;
}

export interface UseGrowthAnalyticsOptions {
  apiBase?: string;
  token: string;
}

export function useGrowthAnalytics({ apiBase = "/api", token }: UseGrowthAnalyticsOptions) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/growth-agent/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as AnalyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, isLoading, error, refresh: fetchData };
}
