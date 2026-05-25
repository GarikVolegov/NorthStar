/**
 * Compatibility bridge for legacy admin pages.
 *
 * The canonical admin console now uses Clerk/NorthStar auth. `key` is kept only
 * as a legacy property name and contains the current Bearer token, never an
 * admin API key.
 */

import { useAuth } from "@/contexts/AuthContext";

export function useAdminAuth() {
  const { token, isLoggedIn, logout } = useAuth();

  return {
    key: token ?? "",
    isAuthenticated: isLoggedIn && !!token,
    authError: false,
    login: () => undefined,
    logout,
    setAuthError: () => undefined,
  };
}
