import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/apiClient";
import { useRoutineFeed, useRoutines } from "./useRoutines";

const getJson = vi.fn();

vi.mock("@/lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");
  return {
    ...actual,
    getJson: (...args: unknown[]) => getJson(...args),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 42 },
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useRoutines", () => {
  beforeEach(() => {
    getJson.mockReset();
  });

  it("surfaces routine API failures instead of presenting a false empty setup state", async () => {
    getJson.mockRejectedValue(new ApiClientError("Routine temporarily unavailable", 503, {
      status: "error",
    }));

    const { result } = renderHook(() => useRoutines(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.routines).toEqual([]);
    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.error).toMatchObject({
      message: "Routine temporarily unavailable",
      status: 503,
    });
  });
});

describe("useRoutineFeed", () => {
  beforeEach(() => {
    getJson.mockReset();
  });

  it("surfaces feed API failures instead of presenting a real empty feed", async () => {
    getJson.mockRejectedValue(new ApiClientError("Routine feed temporarily unavailable", 503, {
      status: "error",
    }));

    const { result } = renderHook(() => useRoutineFeed(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.feed).toEqual([]);
    expect(result.current.error).toBeInstanceOf(ApiClientError);
    expect(result.current.error).toMatchObject({
      message: "Routine feed temporarily unavailable",
      status: 503,
    });
  });
});
