import type { AgentHealthStatus } from "./common";

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
  controlRoom?: {
    ai: {
      activeProvider: string;
      openRouterConfigured: boolean;
      openAiFallbackConfigured: boolean;
      model: string;
      status: string;
    };
    configBlockers: Array<{
      key: string;
      label: string;
      status: "configured" | "missing";
      severity: "critical" | "warning";
      message: string;
    }>;
    readyOutputs: {
      realNews: {
        count: number;
        status: string;
        latest?: Array<{ id: number; title: string; source: string; createdAt: string }>;
      };
      pendingDiscovery: { count: number; status: string };
      growthArticles: {
        count: number;
        status: string;
        latest?: Array<{ id: number; title: string; status: string; createdAt: string }>;
      };
      jobSnapshots: { count: number; status: string };
    };
    latestRuns: Array<{
      id: number;
      agentName: string;
      status: string;
      startedAt: string;
      errorMessage: string | null;
    }>;
  };
  runnablePipelines?: Array<{
    key: string;
    label: string;
    description: string;
    endpoint: string;
    method: "POST";
    risk: "low" | "medium" | "high";
    steps: string[];
    outputs: string[];
    requiredConfigKeys: string[];
    reviewPolicy: "auto_publish" | "requires_review" | "data_refresh";
  }>;
  advancedRunnableAgents?: Array<{
    key: string;
    label: string;
    description: string;
    endpoint: string;
    method: "POST";
    risk: "low" | "medium" | "high";
    requiresInput?: boolean;
  }>;
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
