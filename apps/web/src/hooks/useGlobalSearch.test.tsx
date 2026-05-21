import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

import { useGlobalSearch } from "./useGlobalSearch";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function jsonResponse(body: unknown) {
  const text = JSON.stringify(body);
  return {
    ok: true,
    text: async () => text,
    json: async () => body,
  } as Response;
}

function sseResponse(events: Array<Record<string, unknown>>) {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
  } as Response;
}

describe("useGlobalSearch", () => {
  beforeEach(() => {
    vi.useRealTimers();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("hybrid")) {
        return Promise.resolve(jsonResponse({
          has_semantic: true,
          searchMode: "hybrid",
          indexStatus: "ready",
          results: [{ id: 1, type: "role", title: "Designer", description: "UI", url: "/r/1", icon: "x", color: "blue" }],
        }));
      }
      if (url.includes("suggest")) {
        return Promise.resolve(jsonResponse({
          suggestions: [{ title: "Design", description: "Explore", url: "/s" }],
        }));
      }
      if (url.includes("orchestrate")) {
        return Promise.resolve(sseResponse([
          { type: "status", value: "Cerco" },
          { type: "results", results: [{ id: 2, type: "article", title: "AI", description: "News", url: "/a", icon: "x", color: "green" }] },
          { type: "sources", chunks: [{ content: "chunk", source: "doc", score: 0.9 }] },
          { type: "token", value: "Risposta" },
          { type: "done" },
        ]));
      }
      return Promise.resolve(jsonResponse({}));
    });
  });

  it("opens with Cmd/Ctrl+K and resets on close", () => {
    const { result } = renderHook(() => useGlobalSearch(), { wrapper });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.setQuery("design");
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe("");
  });

  it("debounces hybrid and suggest queries", async () => {
    const { result } = renderHook(() => useGlobalSearch(), { wrapper });
    act(() => result.current.setQuery("de"));
    expect(apiFetchMock).not.toHaveBeenCalled();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("hybrid"), expect.anything()));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("suggest"), expect.anything()));
    expect(result.current.results[0]?.title).toBe("Designer");
    expect(result.current.suggestions[0]?.title).toBe("Design");
  });

  it("parses orchestrated SSE follow-up events", async () => {
    const { result } = renderHook(() => useGlobalSearch(), { wrapper });

    await act(async () => {
      result.current.sendFollowUp("come scelgo?");
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.aiTokens).toBe("Risposta"));
    expect(result.current.aiStatus).toBe("Cerco");
    expect(result.current.aiSources).toHaveLength(1);
    expect(result.current.results[0]?.title).toBe("AI");
    expect(result.current.isStreaming).toBe(false);
  });
});
