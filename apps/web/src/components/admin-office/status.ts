import type { AgentStatus } from "@workspace/api-zod/agent-registry";

export const STATUS_DOT_CLASS: Record<AgentStatus, string> = {
  idle: "bg-emerald-500",
  thinking: "bg-amber-400 animate-pulse",
  executing: "bg-sky-500 animate-pulse",
  error: "bg-red-500",
  offline: "bg-zinc-500",
};

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Inattivo",
  thinking: "Sta pensando",
  executing: "In esecuzione",
  error: "Errore",
  offline: "Offline",
};
