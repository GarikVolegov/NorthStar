const TOKEN_STORAGE_KEY = "northstar_token";

export const AUTH_EXPIRED_EVENT = "northstar:auth-expired";

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
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
    // Only treat as "auth expired" when we actually attached a token.
    // Otherwise a 401 is just a normal "not logged in" response and must NOT log out the user.
    if (res.status === 401 && sentToken) {
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    return res;
  });
}
