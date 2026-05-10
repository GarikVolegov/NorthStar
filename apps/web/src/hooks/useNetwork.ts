/**
 * useNetwork.ts
 *
 * Tutti gli hook React Query per network (amicizie) e DM.
 * La cache è condivisa tra Navbar, BottomNav e pagina /amici.
 */
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ───────────────────────────────────────────────────────────
export interface DmParticipant {
  id: number;
  name: string | null;
  avatarUrl: string | null;
}

export interface DmLastMessage {
  id: number;
  content: string;
  senderId: number;
  createdAt: string;
}

export interface DmConversation {
  conversationId: number;
  participant: DmParticipant;
  lastMessage: DmLastMessage | null;
  unreadCount: number;
  updatedAt: string | null;
}

export interface DmMessage {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface FriendRequest {
  id: number;
  requesterId: number;
  receiverId: number;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  requester?: { id: number; name: string | null; avatarUrl: string | null };
}

// ─── Keys ────────────────────────────────────────────────────────────
export const networkKeys = {
  requests:      () => ['network', 'requests']     as const,
  conversations: () => ['dm', 'conversations']      as const,
  messages:      (userId: number) => ['dm', 'messages', userId] as const,
};

// ─── Richieste amicizia in arrivo ──────────────────────────────────────
export function useRequests(options?: Partial<UseQueryOptions<{ requests: FriendRequest[] }>>) {
  return useQuery({
    queryKey: networkKeys.requests(),
    queryFn: () => apiRequest<{ requests: FriendRequest[] }>('GET', '/api/friends/requests'),
    staleTime: 20_000,
    ...options,
  });
}

// ─── Lista conversazioni DM ──────────────────────────────────────────────
export function useConversations() {
  return useQuery({
    queryKey: networkKeys.conversations(),
    queryFn: () => apiRequest<{ conversations: DmConversation[] }>('GET', '/api/dm/conversations'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

// ─── Messaggi di una conversazione specifica ───────────────────────────────
export function useMessages(userId: number | null) {
  return useQuery({
    queryKey: networkKeys.messages(userId ?? 0),
    queryFn: () =>
      apiRequest<{ messages: DmMessage[]; hasMore: boolean; oldestId: number | null }>(
        'GET',
        `/api/dm/conversations/${userId}`,
      ),
    enabled: userId !== null && userId > 0,
    staleTime: 5_000,
  });
}

// ─── Invia messaggio (optimistic update) ───────────────────────────────────
export function useSendMessage(toUserId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiRequest<{ message: DmMessage }>('POST', `/api/dm/conversations/${toUserId}`, { content }),
    onSuccess: (data) => {
      // Appende il messaggio in cache senza refetch
      qc.setQueryData<{ messages: DmMessage[]; hasMore: boolean; oldestId: number | null }>(
        networkKeys.messages(toUserId),
        (old) => old
          ? { ...old, messages: [...old.messages, data.message] }
          : { messages: [data.message], hasMore: false, oldestId: data.message.id },
      );
      // Aggiorna lastMessage nella lista conversazioni
      qc.invalidateQueries({ queryKey: networkKeys.conversations() });
    },
  });
}

// ─── Elimina messaggio (optimistic remove) ─────────────────────────────────
export function useDeleteMessage(toUserId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) =>
      apiRequest<{ success: boolean }>('DELETE', `/api/dm/messages/${messageId}`),
    onMutate: async (messageId) => {
      await qc.cancelQueries({ queryKey: networkKeys.messages(toUserId) });
      const prev = qc.getQueryData(networkKeys.messages(toUserId));
      qc.setQueryData<{ messages: DmMessage[]; hasMore: boolean; oldestId: number | null }>(
        networkKeys.messages(toUserId),
        (old) => old
          ? { ...old, messages: old.messages.filter((m) => m.id !== messageId) }
          : old,
      );
      return { prev };
    },
    onError: (_err, _id, ctx: any) => {
      qc.setQueryData(networkKeys.messages(toUserId), ctx?.prev);
    },
  });
}
