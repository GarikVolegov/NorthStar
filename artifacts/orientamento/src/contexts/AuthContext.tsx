import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { AUTH_EXPIRED_EVENT } from "@/lib/api-fetch";

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
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
  token: string | null;
  authReady: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_STORAGE_KEY = "northstar_user";
const TOKEN_STORAGE_KEY = "northstar_token";

const BASE = import.meta.env.BASE_URL || "/";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [authReady, setAuthReady] = useState<boolean>(false);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  // Persist + register token getter on every change
  useEffect(() => {
    if (user && token) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setAuthTokenGetter(token ? () => token : null);
  }, [user, token]);

  // Listen for global auth-expired event
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  // Validate cached token once on mount: if it's expired/invalid, clear silently
  // so the user lands on the public home instead of seeing flash-of-logged-in UI
  // followed by a 401 kick later.
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
          // Token invalid/expired — clear silently
          setUser(null);
          setToken(null);
        }
        // any other status: keep cached state, just continue
      })
      .catch(() => {
        // Network error: keep cached state, user can retry actions
      })
      .finally(() => {
        setAuthReady(true);
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    setAuthReady(true);
    // Best-effort timezone sync — never block login on this
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      fetch(`${BASE}api/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
        body: JSON.stringify({ timezone: tz }),
      }).catch(() => {});
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user, token, authReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
