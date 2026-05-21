import type { AgentStatus } from "@workspace/api-zod/agent-registry";

export const STATUS_DOT_CLASS: Record<AgentStatus, string> = {
  idle: "bg-success",
  thinking: "bg-warning animate-pulse",
  executing: "bg-info animate-pulse",
  error: "bg-danger",
  offline: "bg-muted-foreground",
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Inattivo",
  thinking: "Sta pensando",
  executing: "In esecuzione",
  error: "Errore",
  offline: "Offline",
};
