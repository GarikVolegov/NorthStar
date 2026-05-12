/**
 * AuthContext — gestione autenticazione globale.
 * FRONTEND_RULES.md: unico punto di verità per token + user.
 *
 * Changelog:
 *   - Fase 4: aggiunto isAffiliate?: boolean al tipo AuthUser.
 *     Viene popolato da GET /api/auth/me al mount; è poi usato
 *     in navbar.tsx per mostrare/nascondere il link dashboard affiliazione.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { AUTH_EXPIRED_EVENT, TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from "@/lib/storage-keys";
import { useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  testSessionId: number | null;
  emailVerified?: boolean;
  stripeSubscriptionId?: string | null;
  workPreference?: string | null;
  autonomyPreference?: number | null;
  stabilityPreference?: number | null;
  timezone?: string | null;
  userMode?: string | null;
  journeyType?: string | null;
  avatarUrl?: string | null;
  isPublic?: boolean;
  /** Fase 4: accesso dashboard affiliazione — viene da users.is_affiliate */
  isAffiliate?: boolean;
  /** Onboarding completato — viene da users.onboarding_completed */
  onboardingCompleted?: boolean;
}

const JOURNEY_CACHE_KEY = "ns_journey";

/** Dati minimi salvati in localStorage per UI pre-mount. */
interface UserCache {
  id: number;
  name: string;
  avatarUrl?: string | null;
  journeyType?: string | null;
}

function cacheUser(u: AuthUser): UserCache {
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl, journeyType: u.journeyType };
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  isLoggedIn: boolean;
  token: string | null;
  authReady: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL || "/";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      if (!raw) return null;
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached) as UserCache;
      const cachedJourney = localStorage.getItem(JOURNEY_CACHE_KEY);
      return {
        id: parsed.id,
        name: parsed.name,
        avatarUrl: parsed.avatarUrl ?? null,
        journeyType: parsed.journeyType ?? cachedJourney ?? null,
      } as AuthUser;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [authReady, setAuthReady] = useState<boolean>(false);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(cacheUser(next)));
        if (next.journeyType) localStorage.setItem(JOURNEY_CACHE_KEY, next.journeyType);
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (user && token) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(cacheUser(user)));
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setAuthTokenGetter(token ? () => token : null);
  }, [user, token]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  // Silent token refresh: decode exp claim and refresh 5 min before expiry
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!token) return;
    try {
      const payloadB64 = token.split(".")[1];
      if (!payloadB64) return;
      const payload = JSON.parse(atob(payloadB64)) as { exp?: number };
      const exp = payload.exp;
      if (!exp) return;
      const expiresInMs = exp * 1000 - Date.now();
      const refreshAtMs = Math.max(0, expiresInMs - 5 * 60 * 1000);
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${BASE}api/auth/refresh`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = (await res.json()) as { token?: string };
            if (body.token) {
              sessionStorage.setItem(TOKEN_STORAGE_KEY, body.token);
              setToken(body.token);
              setAuthTokenGetter(() => body.token!);
            }
          }
        } catch {}
      }, refreshAtMs);
    } catch {}
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [token]);

  // Valida il token cached al mount e aggiorna i dati freschi (incluso isAffiliate)
  const didMountValidate = useRef(false);
  useEffect(() => {
    if (didMountValidate.current) return;
    didMountValidate.current = true;

    const cachedToken = token;
    if (!cachedToken) {
      setAuthReady(true);
      return;
    }

    const ctrl = new AbortController();
    fetch(`${BASE}api/auth/me`, {
      headers: { Authorization: `Bearer ${cachedToken}` },
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (res.ok) {
          const fresh = (await res.json()) as AuthUser;
          if (fresh.journeyType) localStorage.setItem(JOURNEY_CACHE_KEY, fresh.journeyType);
          setUser((prev) => (prev ? { ...prev, ...fresh } : fresh));
        } else if (res.status === 401) {
          setUser(null);
          setToken(null);
          queryClient.clear();
        }
      })
      .catch(() => {})
      .finally(() => {
        setAuthReady(true);
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    (u: AuthUser, t: string) => {
      try {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, t);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(cacheUser(u)));
        if (u.journeyType) localStorage.setItem(JOURNEY_CACHE_KEY, u.journeyType);
      } catch {}

      setAuthTokenGetter(() => t);
      setUser(u);
      setToken(t);
      setAuthReady(true);

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        fetch(`${BASE}api/me`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${t}`,
          },
          body: JSON.stringify({ timezone: tz }),
        }).catch(() => {});
      }
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateUser, isLoggedIn: !!user, token, authReady }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
