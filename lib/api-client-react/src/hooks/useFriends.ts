/**
 * useFriends.ts
 *
 * Hook principale per la gestione delle connessioni (friendships).
 *
 * Espone:
 *   - friends[]     — connessioni accettate
 *   - requests[]    — richieste di amicizia in arrivo
 *   - suggestions[] — suggeriti con matchScore (Step 4)
 *   - loading       — true durante il primo fetch
 *   - error         — messaggio di errore se il fetch fallisce
 *   - pendingIds    — mappa friendshipId / userId → stato azione in corso
 *   - actions       — { sendRequest, acceptRequest, remove }
 *   - refetch       — invalida tutte le query del network
 */
import { useCallback } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

// ── Tipi pubblici ───────────────────────────────────────────────────────────

export type PublicUser = {
  id: number;
  name: string;
  avatarUrl: string | null;
  sectorName: string | null;
  journeyType: string | null;
  totalXp: number | null;
};

export type Friend = {
  friendshipId: number;
  since: string;
  user: PublicUser;
};

export type FriendRequest = {
  friendshipId: number;
  sentAt: string;
  user: PublicUser;
};

/** Suggestion include matchScore: 0–100 (Step 4) */
export type Suggestion = PublicUser & {
  matchScore?: number;
};

// ── Query keys ───────────────────────────────────────────────────────────────

const FRIENDS_KEY      = ["network", "friends"]   as const;
const REQUESTS_KEY     = ["network", "requests"]  as const;
const SUGGESTIONS_KEY  = ["network", "suggestions"] as const;

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── useFriends ───────────────────────────────────────────────────────────────

export function useFriends() {
  const qc = useQueryClient();

  // ─ Fetch friends ────────────────────────────────────────────────────────
  const friendsQuery = useQuery({
    queryKey: FRIENDS_KEY,
    queryFn: () => apiFetch<{ friends: Friend[] }>("/api/friends"),
    staleTime: 60_000,
  });

  // ─ Fetch requests ──────────────────────────────────────────────────────
  const requestsQuery = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: () => apiFetch<{ requests: FriendRequest[] }>("/api/friends/requests"),
    staleTime: 30_000,
  });

  // ─ Fetch suggestions con matchScore ─────────────────────────────────
  const suggestionsQuery = useQuery({
    queryKey: SUGGESTIONS_KEY,
    queryFn: () =>
      apiFetch<{ suggestions: Suggestion[] }>("/api/friends/suggestions"),
    staleTime: 5 * 60_000, // 5 min: il ranking cambia raramente
  });

  // ─ Pending state (ottimistic UI per azioni) ──────────────────────────
  // pendingIds mappa: friendshipId (number) | userId (number stringificato) → stato
  // Nota: usiamo string key per gestire sia friendshipId che userId nella stessa mappa
  type PendingState = Record<string, "accepting" | "removing" | "sending">;

  // ─ Mutation: invia richiesta ───────────────────────────────────────────
  const sendRequestMutation = useMutation({
    mutationFn: (userId: number) =>
      apiFetch(`/api/friends/request/${userId}`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SUGGESTIONS_KEY });
    },
  });

  // ─ Mutation: accetta richiesta ───────────────────────────────────────
  const acceptMutation = useMutation({
    mutationFn: ({ friendshipId }: { friendshipId: number; userId: number }) =>
      apiFetch(`/api/friends/${friendshipId}/accept`, { method: "PUT" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FRIENDS_KEY });
      void qc.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });

  // ─ Mutation: rimuovi / rifiuta ───────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: (friendshipId: number) =>
      apiFetch(`/api/friends/${friendshipId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FRIENDS_KEY });
      void qc.invalidateQueries({ queryKey: REQUESTS_KEY });
      void qc.invalidateQueries({ queryKey: SUGGESTIONS_KEY });
    },
  });

  // ─ API pubblica ───────────────────────────────────────────────────────────

  const refetch = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["network"] });
  }, [qc]);

  // pendingIds semplificato: traccka le operazioni in corso
  const pendingIds: PendingState = {};
  if (sendRequestMutation.isPending && sendRequestMutation.variables) {
    pendingIds[String(sendRequestMutation.variables)] = "sending";
  }
  if (acceptMutation.isPending && acceptMutation.variables) {
    pendingIds[String(acceptMutation.variables.friendshipId)] = "accepting";
  }
  if (removeMutation.isPending && removeMutation.variables) {
    pendingIds[String(removeMutation.variables)] = "removing";
  }

  return {
    friends:     friendsQuery.data?.friends ?? [],
    requests:    requestsQuery.data?.requests ?? [],
    suggestions: suggestionsQuery.data?.suggestions ?? [],
    loading:
      friendsQuery.isLoading ||
      requestsQuery.isLoading ||
      suggestionsQuery.isLoading,
    error:
      friendsQuery.error?.message ??
      requestsQuery.error?.message ??
      null,
    pendingIds,
    actions: {
      sendRequest:   (userId: number)                               => sendRequestMutation.mutate(userId),
      acceptRequest: (friendshipId: number, userId: number)         => acceptMutation.mutate({ friendshipId, userId }),
      remove:        (friendshipId: number)                         => removeMutation.mutate(friendshipId),
    },
    refetch,
  };
}

// ── Hooks singoli (per componenti che necessitano solo di una sezione) ──────

export function useFriendsList() {
  return useQuery({
    queryKey: FRIENDS_KEY,
    queryFn:  () => apiFetch<{ friends: Friend[] }>("/api/friends"),
    staleTime: 60_000,
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: REQUESTS_KEY,
    queryFn:  () => apiFetch<{ requests: FriendRequest[] }>("/api/friends/requests"),
    staleTime: 30_000,
  });
}

export function useSuggestions() {
  return useQuery({
    queryKey: SUGGESTIONS_KEY,
    queryFn:  () => apiFetch<{ suggestions: Suggestion[] }>("/api/friends/suggestions"),
    staleTime: 5 * 60_000,
  });
}

export function useAcceptFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: number) =>
      apiFetch(`/api/friends/${friendshipId}/accept`, { method: "PUT" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: FRIENDS_KEY });
      void qc.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}

export function useDeclineFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendshipId: number) =>
      apiFetch(`/api/friends/${friendshipId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REQUESTS_KEY });
    },
  });
}
