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
