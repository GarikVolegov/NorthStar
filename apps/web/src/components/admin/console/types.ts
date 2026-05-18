export type SuggestionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "applied"
  | "archived";

export type PersistenceMeta = {
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type AgentHealthStatus = "healthy" | "degraded" | "critical";

export type AgentRun = {
  id: number;
  agentName: string;
  userId: number | null;
  taskType?: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
};

export type AgentsOverview = {
  generatedAt: string;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
  summary: {
    totalRuns: number;
    totalAgents: number;
    successRate30d: number;
    avgDurationMs: number | null;
    failedRuns: number;
    runningRuns: number;
    degradedAgents: number;
    criticalAgents: number;
    costUsd30d: number;
    totalTokens30d: number;
    aiRequests30d: number;
    aiErrors30d: number;
  };
  agents: Array<{
    agentName: string;
    totalCalls30d: number;
    completed30d: number;
    running30d: number;
    errorCount30d: number;
    errorRate30d: number;
    successRate30d: number;
    avgDurationMs: number | null;
    lastRunAt: string | null;
    lastErrorAt: string | null;
    status: AgentHealthStatus;
  }>;
  recentRuns: AgentRun[];
  recentErrors: Array<{
    id: number;
    agentName: string;
    taskType: string | null;
    startedAt: string;
    durationMs: number | null;
    errorMessage: string | null;
    status: string;
  }>;
  costs: {
    days: number;
    estimatedCostUsd: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    requestCount: number;
    aiRequestCostUsd: number;
    aiRequestTokens: number;
    aiRequestCount: number;
    aiErrorCount: number;
    byProvider: Array<{
      provider: string;
      costUsd: number;
      tokens: number;
      requests: number;
    }>;
  };
  runnableAgents: Array<{
    key: string;
    label: string;
    description: string;
    endpoint: string;
    method: "POST";
    risk: "low" | "medium" | "high";
    requiresInput?: boolean;
  }>;
};

export type AgentsTab = "overview" | "history" | "errors" | "launch";
