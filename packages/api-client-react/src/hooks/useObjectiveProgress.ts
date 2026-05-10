/**
 * useObjectiveProgress — syncs objective progress in real-time.
 *
 * When an AI agent or another tab updates an objective,
 * the progress bar and completion state update instantly.
 *
 * Usage:
 *
 *   const { objectives, updateProgress } =
 *     useObjectiveProgress({ jwt, initialObjectives });
 */

import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerWsEvent } from "@workspace/api-zod/ws-events";

export interface ObjectiveItem {
  id: number;
  userId: number;
  text: string;
  category: string;
  progress: number;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface UseObjectiveProgressOptions {
  jwt: string | null;
  wsBaseUrl?: string;
  initialObjectives?: ObjectiveItem[];
}

export function useObjectiveProgress({
  jwt,
  wsBaseUrl,
  initialObjectives = [],
}: UseObjectiveProgressOptions) {
  const [objectives, setObjectives] =
    useState<ObjectiveItem[]>(initialObjectives);

  useEffect(() => {
    setObjectives(initialObjectives);
  }, [initialObjectives]);

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
    if (event.type !== "objective:progress") return;
    const { objectiveId, progress, completed } = event.payload;
    setObjectives((prev) =>
      prev.map((o) =>
        o.id === objectiveId
          ? {
              ...o,
              progress,
              completed,
              completedAt: completed ? new Date().toISOString() : o.completedAt,
            }
          : o,
      ),
    );
  }, []);

  useWebSocket<ServerWsEvent>({ url: wsUrl, onMessage: handleMessage });

  return { objectives };
}
