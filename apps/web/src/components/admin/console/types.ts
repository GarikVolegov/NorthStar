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

export type PromptValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  placeholders: string[];
  unknownPlaceholders: string[];
  missingPlaceholders: string[];
  missingRequiredPlaceholders: string[];
};

export type AgentPrompt = {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  requiredPlaceholders: string[];
  defaultValue: string;
  currentValue: string;
  draftValue: string;
  isOverridden: boolean;
  hasDraft: boolean;
  activeVersionId: number | null;
  activeVersionNumber: number | null;
  draftVersionId: number | null;
  draftVersionNumber: number | null;
  updatedAt: string | null;
  updatedBy: string | null;
  validation?: PromptValidation;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type PromptVersion = {
  id: number;
  versionNumber: number;
  status: "draft" | "active" | "archived" | "rolled_back";
  value: string;
  notes: string | null;
  createdBy: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  validation?: PromptValidation;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type PromptPreview = {
  rendered: string;
  variables: Record<string, string>;
  validation: PromptValidation;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
};

export type PromptEditorTab = "editor" | "preview" | "versions";

export type AiModelPolicy = {
  activeProvider: string;
  allowPaidModels: boolean;
  openRouterFreeRouter: string;
  roles: Array<{
    role: string;
    tier: string;
    temperature: number;
    maxTokens: number;
    route: {
      model: string;
      provider: string;
      reason: string;
      temperature: number;
      maxTokens: number;
    };
  }>;
};

export type WendyQualityOverview = {
  generatedAt: string;
  days: number;
  persistenceUnavailable?: boolean;
  reason?: string | null;
  setupAction?: string | null;
  summary: {
    total: number;
    avgEvalScore: number | null;
    avgSupervisorScore: number | null;
    rewriteRate: number;
    clarificationRate: number;
    toolUsageRate: number;
    rewrites: number;
    clarifications: number;
    uiTools: number;
    avgResponseTimeMs: number | null;
    supervisorRewriteCount: number;
    avgScoreBeforeRewrite: number | null;
    avgScoreAfterRewrite: number | null;
    feedbackTotal: number;
    negativeFeedback: number;
    positiveFeedback: number;
    negativeFeedbackRate: number;
  };
  trends: Array<{
    day: string;
    total: number;
    avgEvalScore: number | null;
    avgSupervisorScore: number | null;
    rewriteRate: number;
    clarificationRate: number;
    toolUsageRate: number;
    avgLatencyMs: number | null;
    aiRequests: number;
    aiErrors: number;
    toolCalls: number;
  }>;
  domains: Array<{
    domain: string;
    total: number;
    avgEvalScore: number | null;
    avgSupervisorScore: number | null;
    rewriteRate: number;
    clarificationRate: number;
    toolUsageRate: number;
    avgResponseTimeMs: number | null;
    status: "healthy" | "attention" | "critical";
  }>;
  problemConversations: Array<{
    id: string;
    source: "supervisor" | "feedback";
    createdAt: string;
    sessionId: number | null;
    domain: string;
    intent: string;
    score: number | null;
    scoreAfter: number | null;
    reason: string;
    snippet: string;
  }>;
  rewriteReasons: Array<{ reason: string; count: number }>;
  alerts: Array<{
    level: "attention" | "critical";
    title: string;
    message: string;
    domain: string | null;
  }>;
};
