import { type ComponentType } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/PageLoader";

interface ProtectedRouteProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  [key: string]: unknown;
}

/**
 * Wraps a page component so that:
 * 1. While JWT validation is in-flight (authReady=false), shows a full-screen
 *    spinner — prevents the ~200ms flash of unauthenticated UI (FOUC).
 * 2. Once ready, redirects unauthenticated users to /registra.
 * 3. Renders the page only when the user is confirmed authenticated.
 *
 * Usage in App.tsx:
 *   <Route path="/dashboard">
 *     <ProtectedRoute component={Dashboard} />
 *   </Route>
 */
export function ProtectedRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <PageLoader />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/registra" />;
  }

  return <Component {...rest} />;
}

/**
 * Redirects already-authenticated users away from auth pages
 * (register, reset-password) to /dashboard.
 */
export function PublicOnlyRoute({ component: Component, ...rest }: ProtectedRouteProps) {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <PageLoader />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Component {...rest} />;
}
