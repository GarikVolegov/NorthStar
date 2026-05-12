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
import { AUTH_EXPIRED_EVENT } from "@/lib/api-fetch";
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
}

/** Dati minimi salvati in localStorage per UI pre-mount. */
interface UserCache {
  id: number;
  name: string;
  avatarUrl?: string | null;
}

function cacheUser(u: AuthUser): UserCache {
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl };
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

const USER_STORAGE_KEY = "northstar_user";
const TOKEN_STORAGE_KEY = "northstar_token";

const BASE = import.meta.env.BASE_URL || "/";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      // If no token in sessionStorage, don't restore user — require fresh auth
      if (!raw) return null;
      const cached = localStorage.getItem(USER_STORAGE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached) as UserCache;
      // Partial user — full data fetched via /api/auth/me on mount
      return { id: parsed.id, name: parsed.name, avatarUrl: parsed.avatarUrl ?? null } as AuthUser;
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
