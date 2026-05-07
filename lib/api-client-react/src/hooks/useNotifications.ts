/**
 * useNotifications — real-time in-app notifications via WebSocket.
 *
 * Replaces polling of GET /notifications with a persistent WS connection.
 * New notifications arrive instantly; read status is synced in real-time.
 *
 * Usage:
 *
 *   const { notifications, unreadCount, markRead, markAllRead } =
 *     useNotifications({ jwt });
 */

import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import type { ServerWsEvent } from "@workspace/api-zod/ws-events";

export interface NotificationItem {
  id: number;
  userId: number;
  eventId: number | null;
  channel: string;
  title: string;
  body: string | null;
  isRead: boolean;
  sentAt: string;
  openedAt: string | null;
}

export interface UseNotificationsOptions {
  /** JWT bearer token for WS authentication. */
  jwt: string | null;
  /** WebSocket base URL. Defaults to same-origin /ws */
  wsBaseUrl?: string;
  /** Initial notifications loaded from the REST API (optional). */
  initialNotifications?: NotificationItem[];
  /** REST API base (used by markRead / markAllRead helpers). */
  apiBase?: string;
}

export function useNotifications({
  jwt,
  wsBaseUrl,
  initialNotifications = [],
  apiBase = "/api",
}: UseNotificationsOptions) {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Build the WS URL — use native WebSocket protocol switching
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
      case "notification:new":
        setNotifications((prev) =>
          // Prevent duplicates
          prev.some((n) => n.id === event.payload.id)
            ? prev
            : [event.payload, ...prev],
        );
        break;

      case "notification:read":
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === event.payload.id ? { ...n, isRead: true } : n,
          ),
        );
        break;

      case "notification:read_all":
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        break;

      default:
        break;
    }
  }, []);

  useWebSocket<ServerWsEvent>({ url: wsUrl, onMessage: handleMessage });

  // Sync initial list when it changes externally (e.g. after first REST fetch)
  useEffect(() => {
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  // ── REST helpers (optimistic update + server sync) ─────────────────────

  const markRead = useCallback(
    async (id: number) => {
      // Optimistic
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      await fetch(`${apiBase}/notifications/${id}/read`, { method: "POST" }).catch(
        console.error,
      );
    },
    [apiBase],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch(`${apiBase}/notifications/read-all`, { method: "POST" }).catch(
      console.error,
    );
  }, [apiBase]);

  return { notifications, unreadCount, markRead, markAllRead };
}
