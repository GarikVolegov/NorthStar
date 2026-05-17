/**
 * useAdminAuth — Gestione autenticazione admin unificata.
 *
 * Una sola chiave localStorage (`ns_admin_key`) condivisa da tutte le pagine admin.
 * Il login viene richiesto una sola volta; lo stato persiste tra navigazione e tab.
 */

import { useState, useCallback, useEffect } from "react";
import { eventBus } from "@/lib/event-bus";

const LS_KEY = "ns_admin_key";
const EVENT_LOGIN = "admin:login";
const EVENT_LOGOUT = "admin:logout";

interface AdminAuthState {
  key: string;
  isAuthenticated: boolean;
  authError: boolean;
  login: (key: string) => void;
  logout: () => void;
  setAuthError: (error: boolean) => void;
}

let cachedKey: string | null = null;

function readKey(): string {
  return cachedKey ?? (localStorage.getItem(LS_KEY) ?? "");
}

function writeKey(key: string) {
  cachedKey = key;
  if (key) {
    localStorage.setItem(LS_KEY, key);
  } else {
    localStorage.removeItem(LS_KEY);
  }
}

export function useAdminAuth(): AdminAuthState {
  const [key, setKey] = useState(readKey);
  const [authError, setAuthError] = useState(false);

  const isAuthenticated = key.length > 0;

  const login = useCallback((k: string) => {
    writeKey(k);
    setKey(k);
    setAuthError(false);
    eventBus.emit(EVENT_LOGIN, { key: k });
  }, []);

  const logout = useCallback(() => {
    writeKey("");
    setKey("");
    setAuthError(false);
    eventBus.emit(EVENT_LOGOUT, {});
  }, []);

  // Cross-tab sync: if another tab logs in/out, reflect it here
  useEffect(() => {
    const unsubLogin = eventBus.on(EVENT_LOGIN, (e) => {
      const k = (e.payload as { key: string }).key;
      if (k && k !== key) {
        setKey(k);
        setAuthError(false);
      }
    });
    const unsubLogout = eventBus.on(EVENT_LOGOUT, () => {
      setKey("");
      setAuthError(false);
    });
    return () => {
      unsubLogin();
      unsubLogout();
    };
  }, [key]);

  return { key, isAuthenticated, authError, login, logout, setAuthError };
}

export { LS_KEY as ADMIN_LS_KEY };
