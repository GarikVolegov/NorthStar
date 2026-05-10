/**
 * useNetwork.ts
 *
 * Hooks React Query per la sezione Network (/amici).
 *
 * Queries:
 *   useFriends()         — GET /api/friends
 *   useRequests()        — GET /api/friends/requests
 *   useSuggestions()     — GET /api/friends/suggestions
 *   useSearchUsers(q)    — GET /api/friends/search?q=
 *
 * Mutations:
 *   useSendRequest()     — POST /api/friends/request/:id
 *   useAcceptRequest()   — PUT  /api/friends/:id/accept
 *   useRemoveFriend()    — DELETE /api/friends/:id
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ── Tipi ────────────────────────────────────────────────────────────────────

export type NetworkUser = {
  id:          number;
  name:        string;
  avatarUrl:   string | null;
  sectorName:  string | null;
  journeyType: string | null;
  totalXp:     number | null;
  matchScore?: number;
};

export type FriendEntry = {
  friendshipId: number;
  since:        string | null;
  user:         NetworkUser;
};

export type RequestEntry = {
  friendshipId: number;
  sentAt:       string | null;
  user:         NetworkUser;
};

// ── Query keys ──────────────────────────────────────────────────────────────

export const networkKeys = {
  friends:     ['network', 'friends']     as const,
  requests:    ['network', 'requests']    as const,
  suggestions: ['network', 'suggestions'] as const,
  search:      (q: string) => ['network', 'search', q] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────────

export function useFriends(
  options?: Omit<UseQueryOptions<{ friends: FriendEntry[] }>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<{ friends: FriendEntry[] }>({
    queryKey: networkKeys.friends,
    queryFn:  () => apiClient.get<{ friends: FriendEntry[] }>('/friends'),
    staleTime: 30_000,
    ...options,
  });
}

export function useRequests(
  options?: Omit<UseQueryOptions<{ requests: RequestEntry[] }>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<{ requests: RequestEntry[] }>({
    queryKey: networkKeys.requests,
    queryFn:  () => apiClient.get<{ requests: RequestEntry[] }>('/friends/requests'),
    staleTime: 20_000,
    ...options,
  });
}

export function useSuggestions(
  options?: Omit<UseQueryOptions<{ suggestions: NetworkUser[] }>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<{ suggestions: NetworkUser[] }>({
    queryKey: networkKeys.suggestions,
    queryFn:  () => apiClient.get<{ suggestions: NetworkUser[] }>('/friends/suggestions'),
    staleTime: 60_000,
    ...options,
  });
}

export function useSearchUsers(q: string) {
  return useQuery<{ results: NetworkUser[]; hasMore: boolean }>({
    queryKey: networkKeys.search(q),
    queryFn:  () =>
      apiClient.get<{ results: NetworkUser[]; hasMore: boolean }>(
        `/friends/search?q=${encodeURIComponent(q)}`,
      ),
    enabled:   q.trim().length >= 2,
    staleTime: 15_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useSendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: number) =>
      apiClient.post<{ friendship: unknown }>(`/friends/request/${targetId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: networkKeys.suggestions });
      qc.invalidateQueries({ queryKey: ['network', 'search'] });
    },
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: number) =>
      apiClient.put<{ friendship: unknown }>(`/friends/${friendshipId}/accept`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: networkKeys.requests });
      qc.invalidateQueries({ queryKey: networkKeys.friends });
    },
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: number) =>
      apiClient.delete<{ success: boolean }>(`/friends/${friendshipId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: networkKeys.friends });
    },
  });
}
