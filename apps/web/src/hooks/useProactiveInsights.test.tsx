import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/apiClient";
import { useProactiveInsights } from "./useProactiveInsights";

const getJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 } }),
}));

vi.mock("@/lib/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/apiClient")>();
  return {
    ...actual,
    getJson: getJsonMock,
    postJson: postJsonMock,
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useProactiveInsights", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    postJsonMock.mockReset();
  });

  it("keeps API failures in error state instead of reporting an empty insight list", async () => {
    getJsonMock.mockRejectedValueOnce(new ApiClientError("Server down", 500, null));

    const { result } = renderHook(() => useProactiveInsights(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.insights).toEqual([]);
  });
});
