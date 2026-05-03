import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { AUTH_EXPIRED_EVENT } from "@/lib/api-fetch";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  testSessionId: number | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_STORAGE_KEY = "northstar_user";
const TOKEN_STORAGE_KEY = "northstar_token";

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

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

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

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  const login = (u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const base = import.meta.env.BASE_URL || "/";
    fetch(`${base}api/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${t}` },
      body: JSON.stringify({ timezone: tz }),
    }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
