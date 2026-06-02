import { setInMemoryToken } from "@/lib/api-fetch";
import { postJson } from "@/lib/apiClient";
import { clientLogger } from "@/lib/clientLogger";
import { AUTH_EXPIRED_EVENT, TOKEN_STORAGE_KEY } from "@/lib/storage-keys";
import { useClerk, useAuth as useClerkAuth, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

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
  journeyDecidedAt?: string | null;
  journeyDecisionSource?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  username?: string | null;
  wendyTonePreference?: string | null;
  isPublic?: boolean;
  isAffiliate?: boolean;
  onboardingCompleted?: boolean;
  role?: "user" | "admin";
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  isLoggedIn: boolean;
  isAffiliate: boolean;
  token: string | null;
  authReady: boolean;
  authSyncFailed: boolean;
  authSyncError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL || "/";
const REFERRAL_STORAGE_KEY = "referralCode";
const ENABLE_DEV_TOKEN_AUTH = import.meta.env.DEV;

type ClerkUser = NonNullable<ReturnType<typeof useUser>["user"]>;

function getClerkEmail(clerkUser: ClerkUser): string {
  return clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "";
}

function clerkUserToAuthUser(clerkUser: ClerkUser): AuthUser {
  const email = getClerkEmail(clerkUser);

  return {
    id: 0,
    name: clerkUser.fullName ?? clerkUser.username ?? email,
    email,
    testSessionId: null,
    emailVerified: clerkUser.primaryEmailAddress?.verification?.status === "verified",
    avatarUrl: clerkUser.imageUrl ?? null,
    role: "user",
    journeyType: null,
    isAffiliate: false,
    onboardingCompleted: false,
  };
}

function readReferralCode(): string | undefined {
  return (
    localStorage.getItem(REFERRAL_STORAGE_KEY) ??
    sessionStorage.getItem(REFERRAL_STORAGE_KEY) ??
    undefined
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { getToken, isSignedIn } = useClerkAuth();
  const clerk = useClerk();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authSyncFailed, setAuthSyncFailed] = useState<boolean>(false);
  const [authSyncError, setAuthSyncError] = useState<string | null>(null);

  const clearNorthStarSession = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setInMemoryToken(null);
    setAuthTokenGetter(null);
  }, []);

  const logout = useCallback(() => {
    clearNorthStarSession();
    setAuthSyncFailed(false);
    setAuthSyncError(null);
    queryClient.clear();
    clerk.signOut().catch(() => {});
  }, [clearNorthStarSession, queryClient, clerk]);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const login = useCallback((u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    setAuthSyncFailed(false);
    setAuthSyncError(null);
    sessionStorage.setItem(TOKEN_STORAGE_KEY, t);
    setInMemoryToken(t);
    setAuthTokenGetter(() => t);
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!clerkLoaded) return;

    if (isSignedIn && clerkUser && token) {
      setAuthTokenGetter(() => token);
    } else {
      setAuthTokenGetter(null);
      setInMemoryToken(null);
    }
  }, [clerkLoaded, isSignedIn, clerkUser, token]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  const syncedClerkIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!clerkLoaded) return;

    if (!isSignedIn || !clerkUser) {
      const devToken = ENABLE_DEV_TOKEN_AUTH
        ? sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;

      if (!devToken) {
        clearNorthStarSession();
        setAuthSyncFailed(false);
        setAuthSyncError(null);
        setAuthReady(true);
        return;
      }

      const ctrl = new AbortController();
      const syncDevToken = async () => {
        setAuthReady(false);
        setToken(devToken);
        setInMemoryToken(devToken);
        setAuthTokenGetter(() => devToken);
        try {
          const res = await fetch(`${BASE}api/auth/me`, {
            headers: { Authorization: `Bearer ${devToken}` },
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const serverUser = (await res.json()) as AuthUser;
          sessionStorage.setItem(TOKEN_STORAGE_KEY, devToken);
          setUser(serverUser);
          setAuthSyncFailed(false);
          setAuthSyncError(null);
        } catch (err) {
          if (ctrl.signal.aborted) return;
          const message = err instanceof Error ? err.message : "Token dev non valido.";
          clearNorthStarSession();
          setAuthSyncFailed(true);
          setAuthSyncError(message);
        } finally {
          if (!ctrl.signal.aborted) setAuthReady(true);
        }
      };

      void syncDevToken();
      return () => ctrl.abort();
    }

    if (syncedClerkIdRef.current === clerkUser.id) return;

    const clerkOnlyUser = clerkUserToAuthUser(clerkUser);
    const clerkEmail = getClerkEmail(clerkUser);

    clearNorthStarSession();
    setAuthSyncFailed(false);
    setAuthSyncError(null);
    setAuthReady(false);

    const ctrl = new AbortController();

    const syncWithServer = async () => {
      try {
        if (!clerkUser.id || !clerkEmail) {
          syncedClerkIdRef.current = null;
          setAuthSyncFailed(true);
          setAuthSyncError("Clerk non ha ancora restituito un'email valida per completare l'accesso.");
          setAuthReady(true);
          return;
        }

        const clerkToken = await getToken().catch(() => null);
        if (!clerkToken) {
          syncedClerkIdRef.current = null;
          setAuthSyncFailed(true);
          setAuthSyncError("Token Clerk non disponibile. Esci e accedi di nuovo.");
          setAuthReady(true);
          return;
        }

        const data = await postJson<AuthUser & { northstar_token?: string }>(
          `${BASE}api/auth/clerk-sync`,
          {
            clerkId: clerkUser.id,
            email: clerkEmail,
            name: clerkUser.fullName ?? clerkUser.username ?? clerkEmail ?? "Utente",
            referralCode: readReferralCode(),
          },
          {
            headers: {
              Authorization: `Bearer ${clerkToken}`,
            },
            signal: ctrl.signal,
          },
        );
        const { northstar_token: nsToken, ...serverUser } = data;
        if (!nsToken) {
          syncedClerkIdRef.current = null;
          clearNorthStarSession();
          setAuthSyncFailed(true);
          setAuthSyncError("Il server non ha restituito un token NorthStar valido.");
          return;
        }

        sessionStorage.setItem(TOKEN_STORAGE_KEY, nsToken);
        setInMemoryToken(nsToken);
        setToken(nsToken);
        setAuthSyncFailed(false);
        setAuthSyncError(null);
        setAuthTokenGetter(() => nsToken);
        setUser({ ...clerkOnlyUser, ...serverUser });
        syncedClerkIdRef.current = clerkUser.id;
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
        queryClient.invalidateQueries();
      } catch (err) {
        if (ctrl.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Errore di rete durante la sincronizzazione.";
        clientLogger.warn("[auth] clerk-sync request failed", { error: message });
        syncedClerkIdRef.current = null;
        clearNorthStarSession();
        setAuthSyncFailed(true);
        setAuthSyncError(message);
      } finally {
        if (!ctrl.signal.aborted) {
          setAuthReady(true);
        }
      }
    };

    void syncWithServer();
    return () => ctrl.abort();
  }, [clearNorthStarSession, clerkLoaded, isSignedIn, clerkUser, getToken, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
        isLoggedIn: !!user && user.id > 0 && !!token,
        isAffiliate: !!user?.isAffiliate,
        token,
        authReady,
        authSyncFailed,
        authSyncError,
      }}
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
