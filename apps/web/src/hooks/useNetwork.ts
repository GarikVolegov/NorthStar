/**
 * useNetwork.ts
 *
 * Tutti gli hook React Query per network (amicizie) e DM.
 * La cache è condivisa tra Navbar, BottomNav e pagina /amici.
 */
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── Tipi ────────────────────────────────────────────────────────────────────
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

// ─── NetworkUser & Entry types (Step 4) ───────────────────────────────────────
export interface NetworkUser {
  id: number;
  name: string;
  avatarUrl: string | null;
  sectorName: string | null;
  journeyType: string | null;
  totalXp: number | null;
  matchScore?: number;
}

export interface FriendEntry {
  friendshipId: number;
  since: string | null;
  user: NetworkUser;
}

export interface RequestEntry {
  friendshipId: number;
  sentAt: string | null;
  user: NetworkUser;
}

// ─── Keys ────────────────────────────────────────────────────────────────────
export const networkKeys = {
  friends:     ['network', 'friends']      as const,
  requests:    ['network', 'requests']     as const,
  suggestions: ['network', 'suggestions']  as const,
  search:      (q: string) => ['network', 'search', q] as const,
  sent:        ['network', 'sent']         as const,
  conversations: () => ['dm', 'conversations'] as const,
  messages:    (userId: number) => ['dm', 'messages', userId] as const,
};

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useFriends(options?: Omit<UseQueryOptions<{ friends: FriendEntry[] }>, 'queryKey' | 'queryFn'>) {
  return useQuery<{ friends: FriendEntry[] }>({
    queryKey: networkKeys.friends,
    queryFn:  () => apiRequest<{ friends: FriendEntry[] }>('GET', '/api/friends'),
    staleTime: 30_000,
    ...options,
  });
}

export function useRequests(options?: Omit<UseQueryOptions<{ requests: RequestEntry[] }>, 'queryKey' | 'queryFn'>) {
  return useQuery<{ requests: RequestEntry[] }>({
    queryKey: networkKeys.requests,
    queryFn:  () => apiRequest<{ requests: RequestEntry[] }>('GET', '/api/friends/requests'),
    staleTime: 20_000,
    ...options,
  });
}

/** Richieste inviate dall'utente corrente */
export function useSentRequests(options?: Omit<UseQueryOptions<{ requests: RequestEntry[] }>, 'queryKey' | 'queryFn'>) {
  return useQuery<{ requests: RequestEntry[] }>({
    queryKey: networkKeys.sent,
    queryFn:  () => apiRequest<{ requests: RequestEntry[] }>('GET', '/api/friends/requests/sent'),
    staleTime: 20_000,
    ...options,
  });
}

/** Suggeriti con matchScore (Step 4) */
export function useSuggestions(options?: Omit<UseQueryOptions<{ suggestions: NetworkUser[] }>, 'queryKey' | 'queryFn'>) {
  return useQuery<{ suggestions: NetworkUser[] }>({
    queryKey: networkKeys.suggestions,
    queryFn:  () => apiRequest<{ suggestions: NetworkUser[] }>('GET', '/api/friends/suggestions'),
    staleTime: 60_000,
    ...options,
  });
}

/** Ricerca utenti (Step 4) */
export function useSearchUsers(q: string) {
  return useQuery<{ results: NetworkUser[]; hasMore: boolean }>({
    queryKey: networkKeys.search(q),
    queryFn:  () =>
      apiRequest<{ results: NetworkUser[]; hasMore: boolean }>(
        'GET',
        `/api/friends/search?q=${encodeURIComponent(q)}`,
      ),
    enabled: q.trim().length >= 2,
    staleTime: 15_000,
  });
}

// ─── Lista conversazioni DM ──────────────────────────────────────────────────
export function useConversations() {
  return useQuery({
    queryKey: networkKeys.conversations(),
    queryFn: () => apiRequest<{ conversations: DmConversation[] }>('GET', '/api/dm/conversations'),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

// ─── Messaggi di una conversazione specifica ─────────────────────────────────
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

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Invia richiesta di amicizia */
export function useSendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: number) =>
      apiRequest('POST', `/api/friends/request/${targetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: networkKeys.suggestions });
      qc.invalidateQueries({ queryKey: ['network', 'search'] });
    },
  });
}

/** Accetta richiesta ricevuta */
export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: number) =>
      apiRequest('PUT', `/api/friends/${friendshipId}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: networkKeys.requests });
      qc.invalidateQueries({ queryKey: networkKeys.friends });
      qc.invalidateQueries({ queryKey: networkKeys.sent });
    },
  });
}

/** Rimuovi amico / Rifiuta richiesta */
export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: number) =>
      apiRequest('DELETE', `/api/friends/${friendshipId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: networkKeys.friends });
      qc.invalidateQueries({ queryKey: networkKeys.requests });
      qc.invalidateQueries({ queryKey: networkKeys.suggestions });
      qc.invalidateQueries({ queryKey: networkKeys.sent });
    },
  });
}

// ─── Invia messaggio (optimistic update) ──────────────────────────────────────
export function useSendMessage(toUserId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      apiRequest('POST', `/api/dm/conversations/${toUserId}`, { content }),
    onSuccess: (data) => {
      qc.setQueryData<{ messages: DmMessage[]; hasMore: boolean; oldestId: number | null }>(
        networkKeys.messages(toUserId),
        (old) => old
          ? { ...old, messages: [...old.messages, data.message] }
          : { messages: [data.message], hasMore: false, oldestId: data.message.id },
      );
      qc.invalidateQueries({ queryKey: networkKeys.conversations() });
    },
  });
}

// ─── Elimina messaggio (optimistic remove) ────────────────────────────────────
export function useDeleteMessage(toUserId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) =>
      apiRequest('DELETE', `/api/dm/messages/${messageId}`),
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


