import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sse = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  options: undefined as undefined | {
    onRawChunk?: (raw: string) => boolean;
    onComplete?: (content: string) => void;
    onError?: (error: Error) => void;
  },
}));

vi.mock("./useSSEStream.js", () => ({
  useSSEStream: vi.fn((options) => {
    sse.options = options;
    return {
      start: sse.start,
      stop: sse.stop,
      isStreaming: false,
      error: null,
      content: "",
      isPending: false,
      reset: vi.fn(),
    };
  }),
}));

vi.mock("../contexts/WendyProvider", () => ({
  useWendy: () => ({ setPhase: vi.fn(), pageContext: null }),
}));

vi.mock("./useTTS.js", () => ({
  useTTS: () => ({ supported: false, speak: vi.fn(), stop: vi.fn() }),
}));

vi.mock("./useSTT.js", () => ({
  useSTT: () => ({
    transcript: "",
    interimTranscript: "",
    stop: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("./useWendyOpenAITTS.js", () => ({
  useWendyOpenAITTS: () => ({ play: vi.fn(async () => undefined), stop: vi.fn() }),
}));

vi.mock("./useWendyActionExecutor", () => ({
  normalizeWendyAction: vi.fn(() => null),
  useWendyActionExecutor: () => ({
    executeImmediate: vi.fn((action) => action),
    confirm: vi.fn(async (action) => action),
    cancel: vi.fn((action) => action),
  }),
}));

vi.mock("./useWendyHistoryCompression", () => ({
  buildCompressedHistory: vi.fn(() => ({ messages: [] })),
  compactPageData: vi.fn((data) => data),
}));

import { useWendyChat } from "./useWendyChat";

describe("useWendyChat", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
    sse.start.mockReset();
    sse.stop.mockReset();
    sse.options = undefined;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
  });

  it("sends a message and parses token, citations, and done events", async () => {
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(
        JSON.stringify({ type: "rag_citations", citations: [{ nodeId: 1, title: "Doc", type: "note", score: 91, url: null }] }),
      );
      sse.options?.onRawChunk?.(JSON.stringify({ type: "token", value: "Ciao" }));
      sse.options?.onRawChunk?.(JSON.stringify({ type: "done", requestId: "req-1" }));
      sse.options?.onComplete?.("Ciao");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("  hello  ");
    });

    expect(sse.start).toHaveBeenCalledWith(
      "/api/ai/wendy",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "hello" });
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Ciao",
      requestId: "req-1",
      isStreaming: false,
    });
  });

  it("handles gate and stream errors without losing observability", async () => {
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({ type: "gate", message: "Upgrade required" }));
      sse.options?.onComplete?.("");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("rag");
    });

    expect(result.current.streamError?.message).toBe("WENDY_GATE");
    expect(result.current.messages.at(-1)).toMatchObject({
      role: "error",
      content: "Upgrade required",
    });
  });

  it("retries non-fatal stream errors and can stop streaming", async () => {
    vi.useFakeTimers();
    sse.start.mockImplementation(async () => {
      sse.options?.onError?.(new Error("temporary"));
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false, maxRetries: 1 }));
    await act(async () => {
      await result.current.sendMessage("retry me");
    });
    expect(sse.start).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(sse.start).toHaveBeenCalledTimes(2);

    act(() => result.current.stopStream());
    expect(sse.stop).toHaveBeenCalled();
  });

  it("keeps feedback local when a message has no requestId", async () => {
    sse.start.mockImplementation(async () => sse.options?.onComplete?.("ok"));
    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("feedback");
    });
    const assistant = result.current.messages.at(-1)!;

    await act(async () => {
      await result.current.sendFeedback(assistant.id, "up");
    });

    expect(fetch).not.toHaveBeenCalledWith("/api/ai/wendy/feedback", expect.anything());
    expect(result.current.messages.at(-1)).toMatchObject({ feedback: "up" });
  });
});
