/**
 * ProtectedRoute.tsx — Guard di autenticazione basato su Clerk.
 *
 * ProtectedRoute:
 *   - Mentre Clerk carica: spinner full-screen (evita FOUC)
 *   - Non autenticato: redirect a /sign-in
 *   - Autenticato: renderizza il componente
 *
 * PublicOnlyRoute:
 *   - Autenticato: redirect a /dashboard (evita /sign-in se già loggato)
 *   - Non autenticato: renderizza il componente
 *
 * Usa useAuth() (bridged su Clerk) per non rompere le pagine esistenti
 * che usano già useAuth() internamente.
 */
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/contexts/AuthContext";
import { isClerkConfigured } from "@/lib/clerk-config";
import { useClerk, useUser } from "@clerk/react";
import { type ComponentType } from "react";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  [key: string]: unknown;
}

export function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { authReady, isLoggedIn, authSyncFailed, authSyncError, logout } = useAuth();

  // Senza Clerk configurato non esiste sessione possibile: manda subito al
  // /sign-in invece di restare bloccati per sempre sullo spinner (Clerk non
  // diventa mai isLoaded → authReady non si risolve).
  if (!isClerkConfigured()) {
    return <Redirect to="/sign-in" />;
  }

  // Aspetta che sia Clerk che il sync locale siano pronti
  if (!isLoaded || !authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <PageLoader />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/sign-in" />;
  }

  if (!isLoggedIn) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-4 z-50">
        <div className="w-full max-w-sm rounded-lg border bg-card p-5 text-center shadow-sm">
          <h1 className="text-base font-semibold text-foreground">
            Sincronizzazione account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {authSyncFailed
              ? "Non siamo riusciti a completare l'accesso a NorthStar. Riprova o esci e accedi di nuovo."
              : "Stiamo completando l'accesso al tuo spazio NorthStar."}
          </p>
          {authSyncFailed && authSyncError ? (
            <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {authSyncError}
            </p>
          ) : null}
          {authSyncFailed ? (
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Riprova
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  signOut().catch(() => {});
                }}
                className="rounded-md border px-3 py-2 text-sm font-medium text-foreground"
              >
                Esci
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <PageLoader />
            </div>
          )}
        </div>
      </div>
    );
  }

  return <Component {...rest} />;
}

export function PublicOnlyRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useUser();

  // Senza Clerk configurato non c'è sessione: mostra la pagina pubblica
  // (es. /sign-in) invece di restare sullo spinner in attesa di Clerk.
  if (!isClerkConfigured()) {
    return <Component {...rest} />;
  }

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <PageLoader />
      </div>
    );
  }

  if (isSignedIn) {
    return <Redirect to="/dashboard" />;
  }

  return <Component {...rest} />;
}
