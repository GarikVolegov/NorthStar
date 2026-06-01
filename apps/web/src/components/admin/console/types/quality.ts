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
