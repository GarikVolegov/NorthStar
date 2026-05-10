/**
 * useAgentStatus — tracks AI agent run status in real-time via WebSocket.
 *
 * Useful for showing a global spinner/toast when background agents
 * (news fetcher, embedding generator, etc.) are running.
 *
 * Usage:
 *
 *   const { runningAgents, lastError } = useAgentStatus({ jwt });
 */

import { useState, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerWsEvent } from "@workspace/api-zod/ws-events";

export interface AgentRunStatus {
  runId: number;
  agentName: string;
  startedAt: string;
}

export interface UseAgentStatusOptions {
  jwt: string | null;
  wsBaseUrl?: string;
}

export function useAgentStatus({ jwt, wsBaseUrl }: UseAgentStatusOptions) {
  const [runningAgents, setRunningAgents] = useState<AgentRunStatus[]>([]);
  const [lastError, setLastError] = useState<{
    agentName: string;
    error: string;
  } | null>(null);

  const wsUrl = jwt
    ? (() => {
        const base =
          wsBaseUrl ??
          (typeof window !== "undefined"
            ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
            : "");
        return `${base}/ws?token=${encodeURIComponent(jwt)}`;
      })()
    : null;

  const handleMessage = useCallback((event: ServerWsEvent) => {
    switch (event.type) {
      case "agent:run_started":
        setRunningAgents((prev) => [
          ...prev,
          {
            runId: event.payload.runId,
            agentName: event.payload.agentName,
            startedAt: new Date().toISOString(),
          },
        ]);
        break;

      case "agent:run_completed":
        setRunningAgents((prev) =>
          prev.filter((r) => r.runId !== event.payload.runId),
        );
        break;

      case "agent:run_error":
        setRunningAgents((prev) =>
          prev.filter((r) => r.runId !== event.payload.runId),
        );
        setLastError({
          agentName: event.payload.agentName,
          error: event.payload.error,
        });
        break;

      default:
        break;
    }
  }, []);

  useWebSocket<ServerWsEvent>({ url: wsUrl, onMessage: handleMessage });

  return { runningAgents, lastError };
}
