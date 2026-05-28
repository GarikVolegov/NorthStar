import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "./useNotifications";

const getJson = vi.fn();
const postJson = vi.fn();
let wsHandler: ((payload: unknown) => void) | null = null;

vi.mock("@/lib/apiClient", () => ({
  getJson: (...args: unknown[]) => getJson(...args),
  postJson: (...args: unknown[]) => postJson(...args),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 42 },
    token: "token",
  }),
}));

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    isConnected: true,
    on: (_event: string, handler: (payload: unknown) => void) => {
      wsHandler = handler;
      return () => {
        wsHandler = null;
      };
    },
    send: vi.fn(),
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useNotifications", () => {
  beforeEach(() => {
    getJson.mockReset();
    postJson.mockReset();
    wsHandler = null;
  });

  it("loads notifications and prepends realtime notifications", async () => {
    getJson.mockResolvedValue({
      notifications: [{ id: 1, title: "Prima", readAt: null, source: "system", severity: "info" }],
      unreadCount: 1,
      nextCursor: null,
    });

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    wsHandler?.({ id: 2, title: "Realtime", readAt: null, source: "wendy", severity: "success" });

    await waitFor(() => expect(result.current.notifications[0]?.id).toBe(2));
    expect(result.current.unreadCount).toBe(2);
  });

  it("marks a notification as read through the API", async () => {
    getJson.mockResolvedValue({ notifications: [], unreadCount: 0, nextCursor: null });
    postJson.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    result.current.markRead(7);

    await waitFor(() => expect(postJson).toHaveBeenCalledWith("/api/notifications/7/read"));
  });
});
