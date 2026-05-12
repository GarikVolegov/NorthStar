/**
 * useCalendarSync — real-time calendar sync via WebSocket.
 *
 * Listens for calendar:created / calendar:updated / calendar:deleted events
 * and keeps a local event list in sync without polling.
 * Also surfaces calendar:reminder events so the UI can show toasts.
 *
 * Usage:
 *
 *   const { events, pendingReminder, clearReminder } =
 *     useCalendarSync({ jwt, initialEvents });
 */

import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerWsEvent } from "@workspace/api-zod/ws-events";

export interface CalendarEventItem {
  id: number;
  userId: number;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  category: string;
  priority: string;
  status: string;
  color: string | null;
  tags: string[];
  linkedSectorId: number | null;
  linkedGoal: string | null;
  linkedContentIds: number[];
  isRecurring: boolean;
  recurrenceRule: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingReminder {
  eventId: number;
  eventTitle: string;
  startAt: string;
  minutesBefore: number;
}

export interface UseCalendarSyncOptions {
  jwt: string | null;
  wsBaseUrl?: string;
  initialEvents?: CalendarEventItem[];
}

export function useCalendarSync({
  jwt,
  wsBaseUrl,
  initialEvents = [],
}: UseCalendarSyncOptions) {
  const [events, setEvents] = useState<CalendarEventItem[]>(initialEvents);
  const [pendingReminder, setPendingReminder] =
    useState<PendingReminder | null>(null);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  const wsUrl = (() => {
    const base =
      wsBaseUrl ??
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`
        : "");
    return base ? `${base}/ws` : null;
  })();

  const handleMessage = useCallback((event: ServerWsEvent) => {
    switch (event.type) {
      case "calendar:created":
        setEvents((prev) =>
          prev.some((e) => e.id === event.payload.id)
            ? prev
            : [...prev, event.payload],
        );
        break;

      case "calendar:updated":
        setEvents((prev) =>
          prev.map((e) =>
            e.id === event.payload.id ? { ...e, ...event.payload } : e,
          ),
        );
        break;

      case "calendar:deleted":
        setEvents((prev) => prev.filter((e) => e.id !== event.payload.id));
        break;

      case "calendar:reminder":
        setPendingReminder(event.payload);
        break;

      default:
        break;
    }
  }, []);

  useWebSocket<ServerWsEvent>({ url: jwt ? wsUrl : null, authToken: jwt, onMessage: handleMessage });

  const clearReminder = useCallback(() => setPendingReminder(null), []);

  return { events, pendingReminder, clearReminder };
}
