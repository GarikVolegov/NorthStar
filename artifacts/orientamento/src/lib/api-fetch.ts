// FIX #7: single in-memory token ref — avoids stale localStorage reads
// when apiFetch is called in the same frame as login/logout
let _tokenRef: string | null = null;

export const AUTH_EXPIRED_EVENT = "northstar:auth-expired";

/**
 * Call this whenever the auth token changes (login/logout).
 * apiFetch will use this value immediately, without waiting for
 * localStorage to be written by the AuthContext useEffect.
 */
export function setInMemoryToken(token: string | null) {
  _tokenRef = token;
}

/**
 * apiFetch — wrapper around fetch that:
 * 1. Reads the token from the in-memory ref first, falls back to localStorage
 * 2. Automatically injects the Authorization header
 * 3. Dispatches AUTH_EXPIRED_EVENT on 401 (only when a token was sent)
 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  // In-memory ref is authoritative; localStorage is the fallback for page refresh
  const TOKEN_STORAGE_KEY = "northstar_token";
  const token = _tokenRef ?? localStorage.getItem(TOKEN_STORAGE_KEY);

  const headers = new Headers(init.headers);
  const hasAuthHeader = headers.has("Authorization");

  if (token && !hasAuthHeader) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const sentToken = !!token || hasAuthHeader;

  return fetch(input, { ...init, headers }).then((res) => {
    if (res.status === 401 && sentToken) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    return res;
  });
}
