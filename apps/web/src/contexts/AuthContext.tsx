/**
 * AuthContext — bridge tra Clerk e il resto dell'app.
 * Mantiene la stessa interfaccia per non rompere i componenti esistenti.
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
import { useUser, useAuth as useClerkAuth, useClerk } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { AUTH_EXPIRED_EVENT } from "@/lib/storage-keys";
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL || "/";

function clerkUserToAuthUser(clerkUser: NonNullable<ReturnType<typeof useUser>["user"]>): AuthUser {
  return {
    id: parseInt(clerkUser.id.replace(/\D/g, "") || "0", 10),
    name: clerkUser.fullName ?? clerkUser.username ?? clerkUser.emailAddresses[0]?.emailAddress ?? "",
    email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
    testSessionId: null,
    emailVerified: clerkUser.primaryEmailAddress?.verification?.status === "verified",
    avatarUrl: clerkUser.imageUrl ?? null,
    role: "user",
    journeyType: null,
    isAffiliate: false,
    onboardingCompleted: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { getToken, isSignedIn } = useClerkAuth();
  const clerk = useClerk();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    queryClient.clear();
    clerk.signOut().catch(() => {});
  }, [queryClient, clerk]);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  const login = useCallback(
    (u: AuthUser, t: string) => {
      setUser(u);
      setToken(t);
      setAuthTokenGetter(() => t);
      setAuthReady(true);
    },
    [],
  );

  useEffect(() => {
    if (!clerkLoaded) return;

    if (isSignedIn && clerkUser && token) {
      setAuthTokenGetter(() => token);
    } else {
      setAuthTokenGetter(null);
    }
  }, [clerkLoaded, isSignedIn, clerkUser, token]);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, [logout]);

  // Sync con server — eseguito una volta quando Clerk carica.
  // NON usa didMountSync (causava authReady bloccato a false).
  // Strategia non bloccante:
  //   1. Se non loggato: authReady=true immediatamente
  //   2. Se loggato: mostra subito dati Clerk (authReady=true), poi arricchisce con dati server
  const syncedClerkIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!clerkLoaded) return;  // Aspetta che Clerk sia pronto

    if (!isSignedIn || !clerkUser) {
      setUser(null);
      setToken(null);
      setAuthReady(true);  // Guest: pronto immediatamente
      return;
    }

    // Già sincronizzato per questo utente Clerk — evita re-sync su re-render
    if (syncedClerkIdRef.current === clerkUser.id) return;
    syncedClerkIdRef.current = clerkUser.id;

    // Mostra subito i dati di Clerk — l'app diventa interattiva immediatamente
    const clerkOnlyUser = clerkUserToAuthUser(clerkUser);
    setUser(clerkOnlyUser);
    setAuthReady(true);  // ← Sblocca l'app subito, senza aspettare il server

    // Sync con il server in background — aggiorna i dati senza bloccare
    const ctrl = new AbortController();
    const syncWithServer = async () => {
      try {
        let clerkToken = await getToken({ template: "NorthStar" }).catch(() => null);
        if (!clerkToken) clerkToken = await getToken().catch(() => null);
        if (!clerkToken) return;  // Nessun token — mantieni dati Clerk puri

        setToken(clerkToken);

        const res = await fetch(`${BASE}api/auth/clerk-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${clerkToken}`,
          },
          body: JSON.stringify({
            clerkId: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress,
            name: clerkUser.fullName ?? clerkUser.username,
          }),
          signal: ctrl.signal,
        });

        if (res.ok) {
          const serverUser = (await res.json()) as AuthUser;
          // Merge: dati server sovrascrivono dati Clerk (più completi)
          setUser({ ...clerkOnlyUser, ...serverUser });
        }
      } catch {
        // Sync fallita — utente rimane con dati Clerk puri, è accettabile
      }
    };

    void syncWithServer();
    return () => ctrl.abort();
  }, [clerkLoaded, isSignedIn, clerkUser, getToken]);

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateUser, isLoggedIn: !!user, isAffiliate: !!user?.isAffiliate, token, authReady }}
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
