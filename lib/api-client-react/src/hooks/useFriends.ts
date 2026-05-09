/**
 * useFriends
 *
 * Hook per la sezione Network (/amici).
 * Gestisce connessioni, richieste in arrivo e suggerimenti.
 *
 * Pattern identico a useLeaderboard: fetch nativo + useState + useCallback.
 * Nessuna dipendenza esterna oltre a React.
 *
 * Usage:
 *   const { friends, requests, suggestions, loading, actions } = useFriends();
 */
import { useState, useEffect, useCallback } from "react";

// ── Tipi ─────────────────────────────────────────────────────────────────────

export interface NetworkUser {
  id: number;
  name: string;
  avatarUrl: string | null;
  sectorName: string | null;
  journeyType: string | null;
  totalXp: number | null;
}

export interface Friend {
  friendshipId: number;
  since: string;
  user: NetworkUser;
}

export interface FriendRequest {
  friendshipId: number;
  sentAt: string;
  user: NetworkUser;
}

export interface Suggestion {
  id: number;
  name: string;
  avatarUrl: string | null;
  sectorName: string | null;
  journeyType: string | null;
  totalXp: number | null;
  sectorId: number | null;
}

export type FriendshipAction = "sending" | "accepting" | "removing" | null;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFriends() {
  const [friends,     setFriends]     = useState<Friend[]>([]);
  const [requests,    setRequests]    = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  // Mappa id → azione in corso per UI ottimistica
  const [pendingIds,  setPendingIds]  = useState<Record<number, FriendshipAction>>({});

  // ── Fetch parallelo all'avvio ─────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [friendsRes, requestsRes, suggestionsRes] = await Promise.all([
        fetch("/api/friends",             { credentials: "include" }),
        fetch("/api/friends/requests",    { credentials: "include" }),
        fetch("/api/friends/suggestions", { credentials: "include" }),
      ]);

      if (!friendsRes.ok || !requestsRes.ok || !suggestionsRes.ok) {
        throw new Error("Errore nel caricamento del network");
      }

      const [f, r, s] = await Promise.all([
        friendsRes.json() as Promise<{ friends: Friend[] }>,
        requestsRes.json() as Promise<{ requests: FriendRequest[] }>,
        suggestionsRes.json() as Promise<{ suggestions: Suggestion[] }>,
      ]);

      setFriends(f.friends);
      setRequests(r.requests);
      setSuggestions(s.suggestions);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Azioni ────────────────────────────────────────────────────────────────

  /** Invia richiesta di amicizia a un utente (da Esplora) */
  const sendRequest = useCallback(async (targetUserId: number) => {
    setPendingIds((p) => ({ ...p, [targetUserId]: "sending" }));
    try {
      const res = await fetch(`/api/friends/request/${targetUserId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      // Rimuovi dai suggerimenti (optimistic)
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
    } catch (err) {
      setError(String(err));
    } finally {
      setPendingIds((p) => { const n = { ...p }; delete n[targetUserId]; return n; });
    }
  }, []);

  /** Accetta una richiesta ricevuta */
  const acceptRequest = useCallback(async (friendshipId: number, requesterId: number) => {
    setPendingIds((p) => ({ ...p, [friendshipId]: "accepting" }));
    try {
      const res = await fetch(`/api/friends/${friendshipId}/accept`, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      // Aggiorna stato localmente senza refetch completo
      const accepted = requests.find((r) => r.friendshipId === friendshipId);
      if (accepted) {
        setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
        setFriends((prev) => [
          ...prev,
          { friendshipId, since: new Date().toISOString(), user: accepted.user },
        ]);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setPendingIds((p) => { const n = { ...p }; delete n[friendshipId]; return n; });
    }
  }, [requests]);

  /** Rimuovi amico o rifiuta richiesta */
  const remove = useCallback(async (friendshipId: number) => {
    setPendingIds((p) => ({ ...p, [friendshipId]: "removing" }));
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setFriends((prev)  => prev.filter((f) => f.friendshipId !== friendshipId));
      setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
    } catch (err) {
      setError(String(err));
    } finally {
      setPendingIds((p) => { const n = { ...p }; delete n[friendshipId]; return n; });
    }
  }, []);

  return {
    friends,
    requests,
    suggestions,
    loading,
    error,
    pendingIds,
    refetch: fetchAll,
    actions: { sendRequest, acceptRequest, remove },
  };
}
