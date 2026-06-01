import type { SidebarSection } from "./common";

export type AdminOverview = {
  generatedAt: string;
  health: {
    status: "healthy" | "attention" | "critical";
    label: string;
    reasons: string[];
    criticalCount: number;
    actionItems: number;
  };
  queues: {
    reviewPending: number;
    growthPending: number;
    totalOpen: number;
  };
  errors: {
    totalCaptured: number;
    unique: number;
    brokenComponents: string[];
    recent: Array<{
      file: string;
      function: string;
      message: string;
      code: string | null;
      capturedAt: string;
      occurrences: number;
    }>;
  };
  agents: {
    total: number;
    critical: number;
    degraded: number;
    failedRecent: Array<{
      id: number;
      agentName: string;
      taskType: string | null;
      startedAt: string;
      durationMs: number | null;
      errorMessage: string | null;
      status: string;
    }>;
    health: Array<{
      agentName: string;
      totalCalls30d: number;
      errorCount30d: number;
      errorRate30d: number;
      successRate30d: number;
      avgDurationMs: number | null;
      status: "healthy" | "degraded" | "critical";
    }>;
  };
  metrics: {
    users: { total: number; premium: number; new30d: number };
    tests: { total: number };
    calendar: { upcoming: number; next24h: number } | null;
  };
  inbox: {
    unreadMessages: number;
    pendingLeads: number;
    contactedLeads: number;
    totalMessages: number;
    totalLeads: number;
  };
};

export type BusinessStatusSnapshot = {
  generatedAt: string;
  days: number;
  business: {
    users: {
      total: number;
      new7d: number;
      new30d: number;
      premium: number;
      conversionRate: number;
    };
    tests: {
      total: number;
      recent: number;
      recent7d: number;
      recent30d: number;
      confirmed: number;
      completionRate: number;
    };
    topSectors: Array<{ sectorId: number | null; count: number }>;
  };
  funnels: {
    userToTestRate: number;
    userToPremiumRate: number;
    leadConversionRate: number;
  };
  technical: {
    status: "healthy" | "attention" | "critical";
    label: string;
    reasons: string[];
    uptimeSeconds: number;
    dbReady: boolean;
    services: Record<string, { status: string; label: string; uptimeSeconds?: number }>;
    errors: {
      totalCaptured: number;
      unique: number;
      brokenComponents: string[];
      recent: Array<{
        file: string;
        function: string;
        message: string;
        code: string | null;
        capturedAt: string;
        occurrences: number;
      }>;
    };
    agents: {
      totalRuns: number;
      failedRuns: number;
      runningRuns: number;
      errorRate: number;
      avgDurationMs: number | null;
      recentFailures: Array<{
        id: number;
        agentName: string;
        taskType: string | null;
        status: string;
        errorMessage: string | null;
        startedAt: string;
      }>;
    };
    ai: { requests: number; errors: number; errorRate: number };
  };
  env: {
    total: number;
    configured: number;
    missingCritical: string[];
    missingOptional: string[];
    items: Array<{ key: string; label: string; critical: boolean; configured: boolean }>;
  };
  inbox: {
    messages: { total: number; unread: number; open: number };
    leads: { total: number; pending: number; contacted: number; converted: number; unread: number };
  };
  actions: Array<{ label: string; section: SidebarSection; path: string; count: number | null }>;
};
