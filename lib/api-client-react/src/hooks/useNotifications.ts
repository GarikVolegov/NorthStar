/**
 * useNotifications
 *
 * Hook che mantiene una connessione SSE a /api/notifications/stream.
 * Aggiorna lo stato ogni volta che arriva un evento "update" dal server.
 *
 * Funzionalità:
 *  - Riconnessione automatica con exponential backoff (max 30s)
 *  - Fallback a polling ogni 30s se SSE non supportato
 *  - Azioni inline: acceptRequest / declineRequest aggiornano lo stato localmente
 *    senza attendere il prossimo ciclo SSE
 *
 * Usage:
 *   const { notifications, unreadCount, actions } = useNotifications();
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { AppNotification } from "../../../apps/server/src/notifications/notifications-router";

export type { AppNotification };

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount:   number;
}

const API_BASE = "/api/notifications";

export function useNotifications() {
  const [state,       setState]       = useState<NotificationsState>({ notifications: [], unreadCount: 0 });
  const [connected,   setConnected]   = useState(false);
  const [pendingIds,  setPendingIds]  = useState<Record<string, "accepting" | "declining">>({});

  const esRef        = useRef<EventSource | null>(null);
  const retryDelay   = useRef(2000);
  const retryTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted      = useRef(true);

  // ── Fetch snapshot (polling fallback + primo caricamento) ─────────────────
  const fetchSnapshot = useCallback(async () => {
    try {
      const res  = await fetch(API_BASE, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json() as NotificationsState;
      if (mounted.current) setState(data);
    } catch { /* ignora */ }
  }, []);

  // ── Connessione SSE ────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mounted.current) return;
    if (typeof EventSource === "undefined") {
      // Fallback: polling ogni 30s
      void fetchSnapshot();
      const id = setInterval(() => void fetchSnapshot(), 30_000);
      return () => clearInterval(id);
    }

    const es = new EventSource(`${API_BASE}/stream`, { withCredentials: true });
    esRef.current = es;

    es.addEventListener("update", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as NotificationsState;
        if (mounted.current) {
          setState(data);
          setConnected(true);
          retryDelay.current = 2000; // reset backoff
        }
      } catch { /* JSON malformato */ }
    });

    es.addEventListener("error", () => {
      es.close();
      esRef.current = null;
      if (!mounted.current) return;
      setConnected(false);
      // Exponential backoff
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
        connect();
      }, retryDelay.current);
    });

    es.addEventListener("open", () => {
      if (mounted.current) setConnected(true);
    });
  }, [fetchSnapshot]);

  useEffect(() => {
    mounted.current = true;
    void fetchSnapshot(); // carica subito senza aspettare SSE
    connect();
    return () => {
      mounted.current = false;
      esRef.current?.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [connect, fetchSnapshot]);

  // ── Azioni ─────────────────────────────────────────────────────────────────

  const acceptRequest = useCallback(async (friendshipId: number, notificationId: string) => {
    setPendingIds((p) => ({ ...p, [notificationId]: "accepting" }));
    try {
      const res = await fetch(`${API_BASE}/friend-request/${friendshipId}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      // Rimuovi localmente senza aspettare SSE
      setState((prev) => ({
        notifications: prev.notifications.filter((n) => n.id !== notificationId),
        unreadCount:   Math.max(0, prev.unreadCount - 1),
      }));
    } catch (err) {
      console.error("acceptRequest error", err);
    } finally {
      setPendingIds((p) => { const n = { ...p }; delete n[notificationId]; return n; });
    }
  }, []);

  const declineRequest = useCallback(async (friendshipId: number, notificationId: string) => {
    setPendingIds((p) => ({ ...p, [notificationId]: "declining" }));
    try {
      const res = await fetch(`${API_BASE}/friend-request/${friendshipId}/decline`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setState((prev) => ({
        notifications: prev.notifications.filter((n) => n.id !== notificationId),
        unreadCount:   Math.max(0, prev.unreadCount - 1),
      }));
    } catch (err) {
      console.error("declineRequest error", err);
    } finally {
      setPendingIds((p) => { const n = { ...p }; delete n[notificationId]; return n; });
    }
  }, []);

  return {
    ...state,
    connected,
    pendingIds,
    actions: { acceptRequest, declineRequest },
  };
}
