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

