/**
 * queryClient.ts
 *
 * Wrapper fetch leggero per le API NorthStar + QueryClient condiviso.
 * Supporta credentials (cookie di sessione) e JSON.
 *
 * In dev, Vite fa proxy di /api verso http://localhost:3001.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min default
      retry: 2,
    },
  },
});

export async function apiRequest<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body != null) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  if (!res.ok) {
    let detail: string | undefined;
    try {
      const errBody = (await res.json()) as { error?: string; message?: string };
      detail = errBody.error ?? errBody.message;
    } catch {
      // non-JSON response
    }
    throw new Error(detail ?? `HTTP ${res.status} ${res.statusText}`);
  }

  // 204 No Content
  if (res.status === 204) return null as T;

  return (await res.json()) as T;
}