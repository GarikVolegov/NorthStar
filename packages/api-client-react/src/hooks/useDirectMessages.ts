/**
 * useDirectMessages.ts
 *
 * Hook React Query per la chat DM.
 *
 * Esporta:
 *   useConversations()          — lista conversazioni con unreadCount
 *   useMessages(userId)         — messaggi con un utente (paginati)
 *   useSendMessage()            — mutation per inviare messaggio
 *   useDeleteMessage()          — mutation per eliminare messaggio
 *   useDMStream(userId, onMsg)  — SSE stream per nuovi messaggi in tempo reale
 */
import { useQuery, useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { apiClient } from '../lib/api-client';

// ── Tipi ──────────────────────────────────────────────────────────────────────

export type DMMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
};

export type DMConversation = {
  conversationId: number;
  participant: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string | null;
};

// ── Query Keys ────────────────────────────────────────────────────────────────

export const dmKeys = {
  all: ['dm'] as const,
  conversations: () => [...dmKeys.all, 'conversations'] as const,
  messages: (userId: number) => [...dmKeys.all, 'messages', userId] as const,
};

// ── useConversations ──────────────────────────────────────────────────────────

export function useConversations() {
  return useQuery({
    queryKey: dmKeys.conversations(),
    queryFn: async () => {
      const res = await apiClient.get<{ conversations: DMConversation[] }>('/dm/conversations');
      return res.conversations;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

// ── useMessages ───────────────────────────────────────────────────────────────

export function useMessages(userId: number) {
  return useInfiniteQuery({
    queryKey: dmKeys.messages(userId),
    queryFn: async ({ pageParam }: { pageParam: number | null }) => {
      const params = new URLSearchParams({ limit: '30' });
      if (pageParam) params.set('before', String(pageParam));
      const res = await apiClient.get<{
        conversationId: number;
        messages: DMMessage[];
        hasMore: boolean;
        oldestId: number | null;
      }>(`/dm/conversations/${userId}?${params.toString()}`);
      return res;
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.oldestId : undefined,
    staleTime: 1000 * 10,
    enabled: userId > 0,
  });
}

// ── useSendMessage ────────────────────────────────────────────────────────────

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, content }: { userId: number; content: string }) => {
      const res = await apiClient.post<{ message: DMMessage }>(
        `/dm/conversations/${userId}`,
        { content },
      );
      return res.message;
    },
    onSuccess: (newMsg, { userId }) => {
      // Aggiorna optimisticamente la cache dei messaggi
      queryClient.setQueryData(
        dmKeys.messages(userId),
        (old: ReturnType<typeof useMessages>['data']) => {
          if (!old) return old;
          const pages = old.pages.map((page, i) =>
            i === old.pages.length - 1
              ? { ...page, messages: [...page.messages, newMsg] }
              : page,
          );
          return { ...old, pages };
        },
      );
      queryClient.invalidateQueries({ queryKey: dmKeys.conversations() });
    },
  });
}

// ── useDeleteMessage ──────────────────────────────────────────────────────────

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId }: { messageId: number }) => {
      await apiClient.delete(`/dm/messages/${messageId}`);
      return messageId;
    },
    onSuccess: (messageId) => {
      queryClient.setQueriesData(
        { queryKey: dmKeys.all },
        (old: ReturnType<typeof useMessages>['data']) => {
          if (!old || typeof old !== 'object' || !('pages' in old)) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((m: DMMessage) =>
              m.id === messageId
                ? { ...m, isDeleted: true, content: '' }
                : m,
            ),
          }));
          return { ...old, pages };
        },
      );
    },
  });
}

// ── useDMStream — SSE in tempo reale ─────────────────────────────────────────
//
// Si connette all'endpoint SSE e aggiorna la cache React Query
// quando arriva un nuovo messaggio.

export function useDMStream(
  userId: number,
  onNewMessage?: (msg: DMMessage) => void,
) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId || userId <= 0) return;

    const cached = queryClient.getQueryData<ReturnType<typeof useMessages>['data']>(
      dmKeys.messages(userId),
    );
    const allMessages = cached?.pages.flatMap((p) => p.messages) ?? [];
    const lastId = allMessages.length > 0
      ? Math.max(...allMessages.map((m) => m.id))
      : 0;

    const url = `/api/dm/conversations/${userId}/stream?after=${lastId}`;
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; message?: DMMessage };
        if (data.type === 'message' && data.message) {
          const msg = data.message;

          queryClient.setQueryData(
            dmKeys.messages(userId),
            (old: ReturnType<typeof useMessages>['data']) => {
              if (!old) return old;
              const pages = old.pages.map((page, i) =>
                i === old.pages.length - 1
                  ? { ...page, messages: [...page.messages, msg] }
                  : page,
              );
              return { ...old, pages };
            },
          );

          queryClient.invalidateQueries({ queryKey: dmKeys.conversations() });
          onNewMessage?.(msg);
        }
      } catch {
        // JSON parse error — ignora
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [userId, queryClient, onNewMessage]);
}
