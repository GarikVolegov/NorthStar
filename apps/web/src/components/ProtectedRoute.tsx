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
import { type ComponentType } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@clerk/react";
import { PageLoader } from "@/components/PageLoader";

interface ProtectedRouteProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  [key: string]: unknown;
}

export function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { authReady } = useAuth();

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

  return <Component {...rest} />;
}

export function PublicOnlyRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useUser();

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
