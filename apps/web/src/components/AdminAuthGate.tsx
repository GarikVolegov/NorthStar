/**
 * Legacy wrapper kept for older admin pages that are no longer routed directly.
 * Real admin authentication is handled by Clerk/NorthStar auth and server-side
 * role checks.
 */

import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/contexts/AuthContext";
import { type ReactNode } from "react";
import { Redirect } from "wouter";

interface Props {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AdminAuthGate({ children }: Props) {
  const { authReady, isLoggedIn, token } = useAuth();

  if (!authReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <PageLoader />
      </div>
    );
  }

  if (!isLoggedIn || !token) {
    return <Redirect to="/sign-in" />;
  }

  return <>{children}</>;
}
