export interface Metrics {
  users: {
    total: number;
    premium: number;
    new30d: number;
    new7d: number;
    conversionRate: number;
  };
  tests: {
    total: number;
    withUser: number;
    last30d: number;
    completionRate: string;
  };
  topSectors: Array<{ sectorId: number; name: string; count: number }>;
  dailySignups: Array<{ day: string; count: number }>;
  revenue: { mrr: number; total: number; currency: string } | null;
  generatedAt: string;
}

export interface RagMetrics {
  totalRetrieves: number;
  fallbackRate: number;
  emptyResultRate: number;
  jsLimitHits: number;
  avgLatencyMsByBackend: Record<"pgvector" | "js" | "none", number>;
  scoreSamplesByBackend: Record<"pgvector" | "js", number>;
  alertThresholds: {
    fallbackRate: number;
    emptyResultRate: number;
    windowMinutes: number;
  };
}

export interface WendyMetrics {
  volumeByDomain: Record<string, number>;
  totalRequests: number;
  totalRewrites: number;
  rewriteRate: number;
  latencyByPhase: Record<string, { sum: number; count: number }>;
  rag?: RagMetrics;
  generatedAt: string;
}

export interface TechDebtSnapshot {
  sprint: string;
  date: string;
  metrics?: Record<string, number>;
  tracked?: Record<string, number>;
  gated?: Record<string, number>;
}

export interface TechDebtMetrics {
  latest: TechDebtSnapshot | null;
  previous: TechDebtSnapshot | null;
  history: TechDebtSnapshot[];
  gateStatus: "ok" | "warning";
  generatedAt: string;
}
