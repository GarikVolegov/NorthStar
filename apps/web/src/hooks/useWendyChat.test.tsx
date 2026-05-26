import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WendyAction } from "./useWendyActionExecutor";

type SseOptions = {
  onRawChunk?: (raw: string) => boolean;
  onComplete?: (content: string) => void;
  onError?: (error: Error) => void;
};

const sse = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  options: undefined as undefined | SseOptions,
}));

vi.mock("./useSSEStream.js", () => ({
  useSSEStream: vi.fn((options: SseOptions) => {
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
  useOptionalWendy: () => ({ setPhase: vi.fn(), pageContext: null }),
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
    executeImmediate: vi.fn((action: WendyAction) => action),
    confirm: vi.fn(async (action: WendyAction) => action),
    cancel: vi.fn((action: WendyAction) => action),
  }),
}));

vi.mock("./useWendyHistoryCompression", () => ({
  buildCompressedHistory: vi.fn(() => ({ messages: [] })),
  compactPageData: vi.fn((data: Record<string, unknown> | undefined) => data),
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
      sse.options?.onRawChunk?.(JSON.stringify({
        type: "done",
        requestId: "req-1",
        contextSources: ["rag", "openhuman", "graphify"],
      }));
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
      contextSources: ["rag", "openhuman", "graphify"],
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

  it("shows the server error message when Wendy reports a stream error", async () => {
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({
        type: "error",
        message: "Il provider AI ha raggiunto un limite temporaneo.",
      }));
      sse.options?.onComplete?.("");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("ciao");
    });

    expect(result.current.messages.at(-1)).toMatchObject({
      role: "error",
      content: "Il provider AI ha raggiunto un limite temporaneo.",
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

  it("reconnects when the stream closes without a done event", async () => {
    vi.useFakeTimers();
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({ type: "token", value: "Parziale" }));
      sse.options?.onComplete?.("Parziale");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false, maxRetries: 1 }));
    await act(async () => {
      await result.current.sendMessage("dopo reload");
    });

    expect(sse.start).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(sse.start).toHaveBeenCalledTimes(2);
  });

  it("marks contextual suggestion requests as predefined", async () => {
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({ type: "done", requestId: "req-2", contextSources: [] }));
      sse.options?.onComplete?.("ok");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendContextualMessage({
        id: "career-plan",
        label: "Piano carriera",
        prompt: "Fammi un piano carriera",
      });
    });

    const [, request] = sse.start.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      message: "Fammi un piano carriera",
      isPredefined: true,
    });
  });

  it("keeps feedback local when a message has no requestId", async () => {
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({ type: "done", contextSources: [] }));
      sse.options?.onComplete?.("ok");
    });
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
