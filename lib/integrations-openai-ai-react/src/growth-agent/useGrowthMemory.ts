/**
 * useGrowthMemory — fetches the user's persistent memory from the API.
 *
 * STATE
 *   facts      CoachMemoryFact[]    — biographical key/value pairs
 *   patterns   CoachMemoryPattern[] — behavioral patterns with confidence
 *   isLoading  boolean
 *   error      string | null
 *
 * USAGE
 *   const { facts, patterns, isLoading, error, refresh } = useGrowthMemory({ token });
 */
import { useState, useEffect, useCallback } from "react";

export interface MemoryFact {
  id: number;
  userId: number;
  key: string;
  value: string;
  confirmedCount: number;
  sourceSessionId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryPattern {
  id: number;
  userId: number;
  patternType: string;
  description: string;
  confidence: number;
  observedCount: number;
  sessionIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface UseGrowthMemoryOptions {
  apiBase?: string;
  token: string;
}

export function useGrowthMemory({ apiBase = "/api", token }: UseGrowthMemoryOptions) {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [patterns, setPatterns] = useState<MemoryPattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/growth-agent/memory`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { facts: MemoryFact[]; patterns: MemoryPattern[] };
      setFacts(data.facts ?? []);
      setPatterns(data.patterns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => { fetchMemory(); }, [fetchMemory]);

  return { facts, patterns, isLoading, error, refresh: fetchMemory };
}
