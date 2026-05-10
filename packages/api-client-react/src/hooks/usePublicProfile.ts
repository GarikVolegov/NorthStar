/**
 * usePublicProfile.ts
 *
 * Hook per caricare e interagire con un profilo pubblico.
 *
 * Uso:
 *   const { profile, loading, error, actions } = usePublicProfile(userId);
 *
 * actions.sendRequest()   — invia richiesta di connessione
 * actions.cancelRequest() — annulla richiesta pending
 * actions.acceptRequest() — accetta se pending_received
 * actions.remove()        — rimuovi connessione
 */
import { useState, useEffect, useCallback } from 'react';

// ── Tipi ──────────────────────────────────────────────────────────────────────

export type ConnectionStatus =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'accepted';

export type PublicBadge = {
  id: number;
  name: string;
  description: string | null;
  icon: string | null;
  earnedAt: string;
};

export type PublicProfileData = {
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    linkedinUrl: string | null;
    journeyType: string | null;
    totalXp: number | null;
    sectorName: string | null;
    memberSince: string;
    isPublic: boolean;
    isOwner: boolean;
  };
  stats: {
    friendCount: number;
    badgeCount: number;
  };
  badges: PublicBadge[];
  connectionStatus: ConnectionStatus;
  friendshipId: number | null;
};

type ProfileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: PublicProfileData }
  | { status: 'error'; message: string; code: number };

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePublicProfile(userId: number | null) {
  const [state, setState] = useState<ProfileState>({ status: 'idle' });
  const [actionPending, setActionPending] = useState(false);

  // ── Fetch profilo ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (userId === null) return;
    setState({ status: 'loading' });
    try {
      const res = await fetch(`/api/users/${userId}/public`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          status: 'error',
          message: body.error ?? 'Impossibile caricare il profilo',
          code: res.status,
        });
        return;
      }
      const data: PublicProfileData = await res.json();
      setState({ status: 'loaded', data });
    } catch {
      setState({ status: 'error', message: 'Connessione non riuscita', code: 0 });
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Aggiorna connectionStatus ottimisticamente ────────────────────────────
  const patchStatus = useCallback(
    (connectionStatus: ConnectionStatus, friendshipId: number | null = null) => {
      setState((prev) => {
        if (prev.status !== 'loaded') return prev;
        return {
          ...prev,
          data: { ...prev.data, connectionStatus, friendshipId },
        };
      });
    },
    [],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const sendRequest = useCallback(async () => {
    if (!userId || actionPending) return;
    setActionPending(true);
    patchStatus('pending_sent');
    try {
      const res = await fetch(`/api/friends/request/${userId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        patchStatus('none'); // rollback
      } else {
        const body = await res.json();
        patchStatus('pending_sent', body.friendship?.id ?? null);
      }
    } catch {
      patchStatus('none');
    } finally {
      setActionPending(false);
    }
  }, [userId, actionPending, patchStatus]);

  const cancelRequest = useCallback(async () => {
    const fid = state.status === 'loaded' ? state.data.friendshipId : null;
    if (!fid || actionPending) return;
    setActionPending(true);
    patchStatus('none', null);
    try {
      await fetch(`/api/friends/${fid}`, { method: 'DELETE', credentials: 'include' });
    } catch {
      // ripristina su errore ricaricando
      load();
    } finally {
      setActionPending(false);
    }
  }, [state, actionPending, patchStatus, load]);

  const acceptRequest = useCallback(async () => {
    const fid = state.status === 'loaded' ? state.data.friendshipId : null;
    if (!fid || actionPending) return;
    setActionPending(true);
    patchStatus('accepted');
    try {
      const res = await fetch(`/api/friends/${fid}/accept`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (!res.ok) load();
    } catch {
      load();
    } finally {
      setActionPending(false);
    }
  }, [state, actionPending, patchStatus, load]);

  const removeConnection = useCallback(async () => {
    const fid = state.status === 'loaded' ? state.data.friendshipId : null;
    if (!fid || actionPending) return;
    setActionPending(true);
    patchStatus('none', null);
    try {
      await fetch(`/api/friends/${fid}`, { method: 'DELETE', credentials: 'include' });
    } catch {
      load();
    } finally {
      setActionPending(false);
    }
  }, [state, actionPending, patchStatus, load]);

  // ── Valori esposti ────────────────────────────────────────────────────────
  return {
    loading:  state.status === 'loading' || state.status === 'idle',
    error:    state.status === 'error' ? { message: state.message, code: state.code } : null,
    profile:  state.status === 'loaded' ? state.data : null,
    actionPending,
    reload:   load,
    actions: {
      sendRequest,
      cancelRequest,
      acceptRequest,
      removeConnection,
    },
  };
}
