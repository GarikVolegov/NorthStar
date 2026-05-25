import { useCallback } from "react";
import { apiFetch as rawApiFetch } from "@/lib/api-fetch";
import { readApiError, readApiErrorFields } from "@/pages/admin-review-api";
import type { AdminReviewApiFetch } from "../api/adminReviewApi";

const BASE = import.meta.env.BASE_URL || "/";

function localApiUnavailableMessage(path: string) {
  const target = path.includes("business-status")
    ? "le metriche business"
    : "la console admin";
  if (import.meta.env.DEV) {
    return `Server locale non raggiungibile per ${target}. Avvia il backend su porta 3001 e il web su 5173, poi riprova.`;
  }
  return `API non raggiungibile per ${target}. Riprova tra poco.`;
}

function isLocalProxyFailure(status: number, bodyText: string | null) {
  if (!import.meta.env.DEV || status < 500 || !bodyText) return false;
  return /ECONNREFUSED|proxy|connect|localhost:3001|127\.0\.0\.1:3001/i.test(
    bodyText,
  );
}

type UseAdminReviewApiFetchOptions = {
  token: string | null;
  adminForbidden: boolean;
  logout: () => void;
  setAdminError: (message: string | null) => void;
  setAdminForbidden: (forbidden: boolean) => void;
  setLastUpdatedAt: (value: string | null) => void;
};

export function useAdminReviewApiFetch({
  token,
  adminForbidden,
  logout,
  setAdminError,
  setAdminForbidden,
  setLastUpdatedAt,
}: UseAdminReviewApiFetchOptions): AdminReviewApiFetch {
  return useCallback(
    async <T = unknown,>(path: string, options?: RequestInit): Promise<T> => {
      if (!token || adminForbidden) {
        throw new Error("auth");
      }

      let res: Response;
      try {
        res = await rawApiFetch(`${BASE}api${path}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(options?.headers || {}),
          },
        });
      } catch (error) {
        const message = localApiUnavailableMessage(path);
        setAdminError(message);
        throw new Error(message, { cause: error });
      }
      if (res.status === 401) {
        logout();
        throw new Error("auth");
      }
      if (res.status === 403) {
        setAdminForbidden(true);
        setAdminError(
          "Accesso non autorizzato: il tuo account non ha il ruolo admin.",
        );
        throw new Error("forbidden");
      }
      if (!res.ok) {
        let errorBody: unknown = null;
        let errorText: string | null = null;
        try {
          errorBody = (await res.clone().json()) as unknown;
        } catch {
          try {
            errorText = await res.text();
          } catch {
            errorText = null;
          }
        }
        const message = isLocalProxyFailure(res.status, errorText)
          ? localApiUnavailableMessage(path)
          : (readApiError(errorBody) ??
            `Errore ${res.status} durante il caricamento della console admin.`);
        setAdminError(message);
        const error = new Error(message) as Error & {
          fields?: Record<string, string>;
        };
        const fields = readApiErrorFields(errorBody);
        if (fields) error.fields = fields;
        throw error;
      }
      const data = (await res.json()) as unknown;
      setAdminError(null);
      setLastUpdatedAt(new Date().toISOString());
      return data as T;
    },
    [
      adminForbidden,
      logout,
      setAdminError,
      setAdminForbidden,
      setLastUpdatedAt,
      token,
    ],
  );
}
