/**
 * useNotifications.ts
 *
 * Hook React Query per il sistema notifiche NorthStar.
 *
 * Tipi di notifica supportati:
 *   - friend_request  : richiesta di amicizia ricevuta
 *   - new_message     : messaggi DM non letti (raggruppati per mittente)
 *
 * Esporta:
 *   useNotificationsSnapshot()    — query REST (polling fallback)
 *   useNotificationsStream()      — SSE con EventSource (tempo reale, 15s)
 *   useAcceptFriendRequest()      — accetta richiesta da notifica
 *   useDeclineFriendRequest()     — rifiuta richiesta da notifica
 *
 * Nota: entrambi gli hook (snapshot e stream) scrivono sulla stessa cache key
 * `notificationKeys.all`, quindi si possono usare insieme senza conflitti.
 * In genere si usa solo useNotificationsStream() nella navbar/shell;
 * useNotificationsSnapshot() serve come fallback per browser che bloccano SSE.
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiClient } from '../lib/api-client';

// ── Tipi ──────────────────────────────────────────────────────────────────────

export interface FriendRequestNotification {
  id: string;
  type: 'friend_request';
  friendshipId: number;
  from: {
    id: number;
    name: string;
    avatarUrl: string | null;
    sectorName: string | null;
  };
  sentAt: string;
  read: boolean;
}

export interface DMNotification {
  id: string;
  type: 'new_message';
  from: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  unreadCount: number;
  lastMessageAt: string;
  read: boolean;
}

export type AppNotification = FriendRequestNotification | DMNotification;

export interface NotificationsPayload {
  notifications: AppNotification[];
  unreadCount: number;           // totale (friend_requests + unread DMs sender count)
  friendRequestCount: number;    // numero richieste pending
  unreadMessagesCount: number;   // somma messaggi non letti da tutti i mittenti
}

// ── Query Keys ────────────────────────────────────────────────────────────────

export const notificationKeys = {
  all: ['notifications'] as const,
};

// ── useNotificationsSnapshot — polling REST fallback ─────────────────────────────

export function useNotificationsSnapshot() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () => {
      return apiClient.get<NotificationsPayload>('/notifications');
    },
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 60,
  });
}

// ── useNotificationsStream — SSE in tempo reale ──────────────────────────────────
//
// Apre una connessione SSE a /api/notifications/stream.
// Ogni evento "update" sovrascrive la cache React Query.
// Si può passare un callback `onNewDM` per mostrare un toast quando
// arriva una nuova notifica DM.

export function useNotificationsStream(options?: {
  onNewDM?: (notif: DMNotification) => void;
  onFriendRequest?: (notif: FriendRequestNotification) => void;
}) {
  const queryClient = useQueryClient();
  const esRef       = useRef<EventSource | null>(null);
  const prevDMRef   = useRef<Set<string>>(new Set());
  const prevFRRef   = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource('/api/notifications/stream', { withCredentials: true });
    esRef.current = es;

    es.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data) as NotificationsPayload;

        // Aggiorna cache React Query — tutte le query su `notificationKeys.all`
        queryClient.setQueryData(notificationKeys.all, data);

        // Callback per nuovi DM (non presenti nel set precedente)
        if (options?.onNewDM) {
          data.notifications
            .filter((n): n is DMNotification => n.type === 'new_message')
            .forEach((n) => {
              if (!prevDMRef.current.has(n.id)) {
                options.onNewDM?.(n);
              }
            });
        }

        // Callback per nuove richieste amicizia
        if (options?.onFriendRequest) {
          data.notifications
            .filter((n): n is FriendRequestNotification => n.type === 'friend_request')
            .forEach((n) => {
              if (!prevFRRef.current.has(n.id)) {
                options.onFriendRequest?.(n);
              }
            });
        }

        // Aggiorna i set per il prossimo ciclo
        prevDMRef.current = new Set(
          data.notifications
            .filter((n) => n.type === 'new_message')
            .map((n) => n.id),
        );
        prevFRRef.current = new Set(
          data.notifications
            .filter((n) => n.type === 'friend_request')
            .map((n) => n.id),
        );
      } catch {
        // JSON parse error — ignora
      }
    });

    es.onerror = () => {
      // L'EventSource fa reconnect automatico; non servono azioni
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // Restituisce i dati dalla cache (aggiornati via SSE)
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: async () => apiClient.get<NotificationsPayload>('/notifications'),
    staleTime: Infinity, // gestito dall'SSE, non fare refetch automatico
    refetchOnWindowFocus: false,
  });
}

// ── useAcceptFriendRequest ────────────────────────────────────────────────────────

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: number) => {
      return apiClient.post(`/notifications/friend-request/${friendshipId}/accept`, {});
    },
    onSuccess: () => {
      // Invalida notifiche E lista amici
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
}

// ── useDeclineFriendRequest ─────────────────────────────────────────────────────

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (friendshipId: number) => {
      return apiClient.post(`/notifications/friend-request/${friendshipId}/decline`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// ── Utility: totalUnreadCount ────────────────────────────────────────────────────
//
// Usa questo valore per il badge rosso nella navbar.
// = friendRequestCount + (conversazioni DM con unread > 0)

export function useTotalUnreadCount(): number {
  const { data } = useNotificationsSnapshot();
  return data?.unreadCount ?? 0;
}
