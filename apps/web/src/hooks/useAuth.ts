/**
 * useAuth.ts — apps/web
 *
 * Hook di autenticazione per il frontend.
 * In sviluppo restituisce un utente mock per bypassare /api/auth/me.
 * In produzione chiama GET /api/auth/me e gestisce il ciclo di vita della sessione.
 */

import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

// ─── Tipi ──────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  isPremium: boolean;
  isAdmin?: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
}

// ─── Cache a livello di modulo (sopravvive ai re-render) ────────────────────────
let cachedUser: User | null = null;
let fetchPromise: Promise<User | null> | null = null;

async function fetchMe(): Promise<User | null> {
  if (fetchPromise) return fetchPromise;
  try {
    fetchPromise = apiRequest<{ user: User }>('GET', '/api/auth/me')
      .then((data) => data.user ?? null)
      .catch(() => null)
      .finally(() => { fetchPromise = null; });
    return fetchPromise;
  } catch {
    return null;
  }
}

/**
 * useAuth — restituisce lo stato di autenticazione corrente.
 *
 * Comportamento:
 *   - Se esiste una sessione cookie valida, /api/auth/me restituisce l'utente
 *   - Altrimenti restituisce null (utente non loggato)
 *   - cachedUser viene usato come cache in-memory per evitare refetch inutili
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [isLoading, setIsLoading] = useState<boolean>(!cachedUser);

  useEffect(() => {
    // Se abbiamo già la cache, non rifetchiamo
    if (cachedUser) {
      setUser(cachedUser);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchMe().then((result) => {
      if (cancelled) return;
      cachedUser = result;
      setUser(result);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoading };
}

/**
 * resetAuthCache — invalida la cache dell'utente.
 * Utile dopo logout o cambio di sessione.
 */
export function resetAuthCache(): void {
  cachedUser = null;
}