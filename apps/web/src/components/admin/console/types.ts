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

export type SidebarSection =
  | "queue"
  | "suggestions"
  | "runs"
  | "logs"
  | "settings"
  | "agents"
  | "prompts"
  | "qualita"
  | "cataloghi"
  | "agenti-salute"
  | "metriche"
  | "abbonamenti"
  | "home"
  | "status"
  | "messaggi"
  | "crescita"
  | "affiliazione"
  | "memory";

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

export type NewsProviderDiagnostics = {
  status?: "ready" | "degraded" | "never_run" | "stale" | "not_configured" | "unavailable" | string;
  providerStatus: "ready" | "degraded" | "never_run" | "stale" | "not_configured" | "unavailable" | string;
  lastAttemptAt: string | null;
  lastFetchAt?: string | null;
  enabledSources: number;
  sourcesWithErrors: number;
  totalFetched?: number | null;
  stalenessMs?: number | null;
  refreshAction:
    | "wait_for_next_refresh"
    | "wait_for_startup_pipeline"
    | "check_provider_keys"
    | "configure_sources"
    | "retry_later"
    | string;
  nextAction?: string;
  actionLabel?: string;
  message: string;
  lastRefreshError?: string | null;
  lastError?: string | null;
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
    newsDiagnostics?: NewsProviderDiagnostics | null;
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

export type AdminOpsStatus = {
  generatedAt: string;
  enabled: boolean;
  confirmationRequired: boolean;
  compose: {
    file: string;
    exists: boolean;
    dockerError: string | null;
    allowedServices: string[];
  };
  capabilities: {
    serverStart: boolean;
    serverStop: boolean;
    serverRestart: boolean;
    databaseMaintenance: boolean;
    databaseRestart: boolean;
  };
  server: {
    status: string;
    uptimeSeconds: number;
    pid: number;
    nodeVersion: string;
    platform: string;
    env: string;
    memory: { rss: number; heapUsed: number; heapTotal: number };
    docker: { status: string; label: string };
  };
  database: {
    status: string;
    ready: boolean;
    maintenance: {
      enabled: boolean;
      reason: string | null;
      updatedAt: string;
      updatedBy: number | null;
    };
    pool: { totalCount: number; idleCount: number; waitingCount: number };
    docker: { status: string; label: string };
  };
  redis: {
    docker: { status: string; label: string };
  };
  lastOperation: {
    id: string;
    action: string;
    service: string;
    status: "accepted" | "running" | "done" | "failed";
    message: string;
    requestedAt: string;
    finishedAt: string | null;
    requestedBy: number | null;
  } | null;
};

export type AdminOpsAction =
  | "server-start"
  | "server-stop"
  | "server-restart"
  | "database-restart";

export type AdminSubscriptionPlan = "free" | "pro" | "team";
export type AdminSubscriptionStatus = "free" | "active" | "expired" | "cancelled";
export type AdminSubscriptionSource = "free" | "internal" | "stripe";

export type AdminSubscriptionCurrent = {
  id: number | null;
  plan: AdminSubscriptionPlan;
  rawPlan: AdminSubscriptionPlan | null;
  status: AdminSubscriptionStatus;
  source: AdminSubscriptionSource;
  validUntil: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  hasStripeSubscription: boolean;
  stripeSubscriptionId: string | null;
};

export type AdminSubscriptionItem = {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    createdAt: string | null;
  };
  current: AdminSubscriptionCurrent;
};

export type AdminSubscriptionHistoryItem = {
  id: number;
  plan: AdminSubscriptionPlan;
  effectivePlan: AdminSubscriptionPlan;
  status: AdminSubscriptionStatus;
  source: Exclude<AdminSubscriptionSource, "free">;
  validUntil: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasStripeSubscription: boolean;
  stripeSubscriptionId: string | null;
};

export type AdminSubscriptionsResponse = {
  generatedAt: string;
  items: AdminSubscriptionItem[];
  total: number;
  limit: number;
  offset: number;
  stats: Record<AdminSubscriptionPlan | "total", number>;
};

export type AdminSubscriptionDetail = AdminSubscriptionItem & {
  history: AdminSubscriptionHistoryItem[];
};

export type AdminAssignee = {
  id: number;
  name: string;
  email: string;
};

export type ContactMessageItem = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  read: boolean;
  readAt: string | null;
  status: "new" | "in_progress" | "resolved" | "archived";
  internalNotes: string | null;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactInboxResponse = {
  items: ContactMessageItem[];
  stats: Record<string, number>;
  assignees: AdminAssignee[];
  generatedAt: string;
};

export type AffiliationLeadItem = {
  id: number;
  institutionName: string;
  contactName: string;
  email: string;
  partnerType: string;
  message: string | null;
  status: "pending" | "contacted" | "converted" | "rejected";
  read: boolean;
  readAt: string | null;
  internalNotes: string | null;
  assignedTo: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AffiliationInboxResponse = {
  items: AffiliationLeadItem[];
  stats: Record<string, number>;
  sources: Array<{ source: string; count: number }>;
  assignees: AdminAssignee[];
  generatedAt: string;
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
