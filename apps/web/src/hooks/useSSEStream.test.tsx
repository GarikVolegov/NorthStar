import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSSEStream } from "./useSSEStream";

function streamResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200, ...init },
  );
}

describe("useSSEStream", () => {
  it("parses SSE data lines without a space after the colon", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      streamResponse('data:{"type":"token","value":"ciao"}\n\ndata: [DONE]\n\n'),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useSSEStream({ onComplete, flushIntervalMs: 0 }));

    await act(async () => {
      await result.current.start("/api/ai/wendy");
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("ciao"));
    expect(result.current.content).toBe("ciao");
  });

  it("surfaces message fields from HTTP error bodies", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      streamResponse(JSON.stringify({ message: "Token non valido" }), { status: 401 }),
    );

    const onError = vi.fn();
    const { result } = renderHook(() => useSSEStream({ onError }));

    await act(async () => {
      await result.current.start("/api/ai/wendy");
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Token non valido" }));
    expect(result.current.error?.message).toBe("Token non valido");
  });
});
