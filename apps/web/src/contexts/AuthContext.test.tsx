import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_EXPIRED_EVENT, TOKEN_STORAGE_KEY } from "@/lib/storage-keys";

const clerkState = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  isLoaded: true,
  isSignedIn: false,
  getToken: vi.fn(),
  signOut: vi.fn(),
}));

const apiClient = vi.hoisted(() => ({
  setAuthTokenGetter: vi.fn(),
}));

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: clerkState.user, isLoaded: clerkState.isLoaded }),
  useAuth: () => ({
    getToken: clerkState.getToken,
    isSignedIn: clerkState.isSignedIn,
  }),
  useClerk: () => ({ signOut: clerkState.signOut }),
}));

vi.mock("@workspace/api-client-react", () => ({
  setAuthTokenGetter: apiClient.setAuthTokenGetter,
}));

import { AuthProvider, useAuth, type AuthUser } from "./AuthContext";

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="email">{auth.user?.email ?? "none"}</span>
      <span data-testid="token">{auth.token ?? "none"}</span>
      <span data-testid="ready">{String(auth.authReady)}</span>
      <span data-testid="sync-error">{auth.authSyncError ?? "none"}</span>
      <button type="button" onClick={() => auth.login(mockUser, "token-1")}>
        login
      </button>
      <button type="button" onClick={() => auth.logout()}>
        logout
      </button>
    </div>
  );
}

const mockUser: AuthUser = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
  testSessionId: null,
};

function renderAuth(children: ReactNode = <Probe />) {
  const client = new QueryClient();
  const ui = (node: ReactNode) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{node}</AuthProvider>
    </QueryClientProvider>
  );
  const result = render(ui(children));
  return {
    ...result,
    rerenderAuth: (node: ReactNode = children) => result.rerender(ui(node)),
  };
}

describe("AuthContext", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clerkState.user = null;
    clerkState.isLoaded = true;
    clerkState.isSignedIn = false;
    clerkState.getToken.mockReset();
    clerkState.signOut.mockReset().mockResolvedValue(undefined);
    apiClient.setAuthTokenGetter.mockReset();
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  it("logs in, stores token, and logs out", async () => {
    renderAuth();

    await act(async () => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("email")).toHaveTextContent("ada@example.com");
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe("token-1");

    await act(async () => {
      screen.getByText("logout").click();
    });
    expect(screen.getByTestId("email")).toHaveTextContent("none");
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(clerkState.signOut).toHaveBeenCalled();
  });

  it("clears session on AUTH_EXPIRED_EVENT", async () => {
    renderAuth();
    await act(async () => {
      screen.getByText("login").click();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    });

    expect(screen.getByTestId("email")).toHaveTextContent("none");
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("syncs Clerk users successfully and exposes failures", async () => {
    clerkState.isSignedIn = true;
    clerkState.user = {
      id: "clerk-1",
      fullName: "Grace Hopper",
      username: "grace",
      imageUrl: "avatar.png",
      primaryEmailAddress: {
        emailAddress: "grace@example.com",
        verification: { status: "verified" },
      },
      emailAddresses: [],
    };
    clerkState.getToken.mockResolvedValue("clerk-token");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          id: 2,
          name: "Grace Hopper",
          email: "grace@example.com",
          testSessionId: null,
          northstar_token: "northstar-token",
        }),
      json: async () => ({
        id: 2,
        name: "Grace Hopper",
        email: "grace@example.com",
        testSessionId: null,
        northstar_token: "northstar-token",
      }),
    } as Response);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent("northstar-token"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("grace@example.com");

    cleanup();
    clerkState.user = { ...clerkState.user, id: "clerk-2" };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "sync failed" }),
      json: async () => ({ error: "sync failed" }),
    } as Response);

    renderAuth();
    await waitFor(() =>
      expect(screen.getByTestId("sync-error")).toHaveTextContent("sync failed"),
    );
  });

  it("retries Clerk sync for the same Clerk user after a failed attempt", async () => {
    clerkState.isSignedIn = true;
    clerkState.user = {
      id: "clerk-retry",
      fullName: "Retry User",
      username: "retry",
      imageUrl: "avatar.png",
      primaryEmailAddress: {
        emailAddress: "retry@example.com",
        verification: { status: "verified" },
      },
      emailAddresses: [],
    };
    clerkState.getToken.mockResolvedValue("clerk-token");
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: "temporary sync failure" }),
        json: async () => ({ error: "temporary sync failure" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            id: 3,
            name: "Retry User",
            email: "retry@example.com",
            testSessionId: null,
            northstar_token: "northstar-retry-token",
          }),
        json: async () => ({
          id: 3,
          name: "Retry User",
          email: "retry@example.com",
          testSessionId: null,
          northstar_token: "northstar-retry-token",
        }),
      } as Response);

    const { rerenderAuth } = renderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("sync-error")).toHaveTextContent("temporary sync failure"),
    );

    clerkState.user = { ...clerkState.user };
    rerenderAuth();

    await waitFor(() =>
      expect(screen.getByTestId("token")).toHaveTextContent("northstar-retry-token"),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
