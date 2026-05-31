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

const wendyProviderMock = vi.hoisted(() => ({
  pageContext: null as null | { page: string; title?: string; data?: Record<string, unknown> },
  setPhase: vi.fn(),
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
  useWendy: () => ({ setPhase: wendyProviderMock.setPhase, pageContext: wendyProviderMock.pageContext }),
  useOptionalWendy: () => ({ setPhase: wendyProviderMock.setPhase, pageContext: wendyProviderMock.pageContext }),
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
    wendyProviderMock.pageContext = null;
    wendyProviderMock.setPhase.mockReset();
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
        answerMode: "llm-full-path",
        adaptiveReasoning: {
          mode: "tool_action",
          reasoningDepth: "grounded",
          dataStrategy: "profile_market",
          executionMode: "tool_augmented_chat",
          selfCheck: ["non_empty"],
          latencyTargetMs: 1800,
        },
        suggestedPrompts: [
          { label: "Confronta settori", prompt: "Confronta i primi tre settori" },
          { label: "Prossimo passo", prompt: "Dimmi cosa fare oggi" },
        ],
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
      answerMode: "llm-full-path",
      adaptiveReasoning: expect.objectContaining({
        reasoningDepth: "grounded",
        dataStrategy: "profile_market",
      }),
      suggestedPrompts: [
        { label: "Confronta settori", prompt: "Confronta i primi tre settori" },
        { label: "Prossimo passo", prompt: "Dimmi cosa fare oggi" },
      ],
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

  it("shows a session message for authenticated stream failures", async () => {
    sse.start.mockImplementation(async () => {
      sse.options?.onError?.(new Error("HTTP_401: Token non valido"));
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false, maxRetries: 0 }));
    await act(async () => {
      await result.current.sendMessage("ciao");
    });

    expect(result.current.messages.at(-1)).toMatchObject({
      role: "error",
      content: "Sessione scaduta. Effettua nuovamente il login.",
    });
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

  it("sends contextual suggestion requests with visible text and hidden follow-up context", async () => {
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
        contextPrompt: "Risposta precedente Wendy: hai completato il test. Usa questo contesto per procedere.",
      });
    });

    const [, request] = sse.start.mock.calls[0]!;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      message: "Piano carriera",
      contextPrompt: expect.stringContaining("Fammi un piano carriera"),
      isPredefined: true,
    });
    expect(JSON.parse(String(request?.body)).contextPrompt).toContain(
      "Risposta precedente Wendy: hai completato il test. Usa questo contesto per procedere.",
    );
    expect(result.current.messages[0]).toMatchObject({ role: "user", content: "Piano carriera" });
  });

  it("keeps unsupported page entity types inside compact data instead of sending invalid top-level values", async () => {
    wendyProviderMock.pageContext = {
      page: "wendy",
      title: "Wendy",
      data: { entityType: "assistant", entityName: "Wendy full screen" },
    };
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({ type: "token", value: "Ciao" }));
      sse.options?.onRawChunk?.(JSON.stringify({ type: "done", contextSources: [] }));
      sse.options?.onComplete?.("Ciao");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("ciao");
    });

    const [, request] = sse.start.mock.calls[0]!;
    const body = JSON.parse(String(request?.body));
    expect(body.pageContext).toMatchObject({
      page: "wendy",
      data: { entityType: "assistant", entityName: "Wendy full screen" },
    });
    expect(body.pageContext).not.toHaveProperty("entityType");
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
