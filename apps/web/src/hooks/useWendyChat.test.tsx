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

const actionExecutorMock = vi.hoisted(() => ({
  normalizeWendyAction: vi.fn(() => null as WendyAction | null),
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
  normalizeWendyAction: actionExecutorMock.normalizeWendyAction,
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
import { loadPersistedThread, savePersistedThread } from "./wendyPersistence";

describe("useWendyChat", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
    sse.start.mockReset();
    sse.stop.mockReset();
    sse.options = undefined;
    wendyProviderMock.pageContext = null;
    wendyProviderMock.setPhase.mockReset();
    actionExecutorMock.normalizeWendyAction.mockReset();
    actionExecutorMock.normalizeWendyAction.mockReturnValue(null);
    localStorage.clear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
  });

  it("hydrates persisted visible messages when a page starts with an empty thread", async () => {
    savePersistedThread(
      [
        { role: "user", content: "trova match" },
        { role: "assistant", content: "[Azione Wendy proposta o completata]" },
      ],
      undefined,
      [
        { id: "user-1", role: "user", content: "trova match", timestamp: 1 },
        {
          id: "assistant-1",
          role: "assistant",
          content: "[Azione Wendy proposta o completata]",
          timestamp: 2,
          uiTool: { name: "career_match", args: { role: "Designer" } },
          toolsUsed: ["career_match"],
          actions: [
            {
              id: "action-1",
              type: "set_filters",
              label: "Applica filtri",
              status: "preview",
              risk: "low",
              description: "Prepara la lista filtrata.",
              requiresConfirmation: false,
              payload: { sector: "design" },
            },
          ],
        },
      ],
    );

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));

    await waitFor(() => expect(result.current.restoredFromPersistence).toBe(true));
    expect(result.current.messages).toEqual([
      { id: "user-1", role: "user", content: "trova match", timestamp: 1 },
      expect.objectContaining({
        id: "assistant-1",
        role: "assistant",
        uiTool: { name: "career_match", args: { role: "Designer" } },
        toolsUsed: ["career_match"],
        actions: [expect.objectContaining({ id: "action-1", type: "set_filters" })],
      }),
    ]);
  });

  it("hydrates legacy history-only threads into the visible conversation", async () => {
    const savedAt = Date.now();
    localStorage.setItem(
      "wendy:thread:v1",
      JSON.stringify({
        v: 1,
        history: [
          { role: "user", content: "ciao" },
          { role: "assistant", content: "ehi" },
        ],
        savedAt,
      }),
    );

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));

    await waitFor(() => expect(result.current.messages).toEqual([
      { id: "persisted-user-0", role: "user", content: "ciao", timestamp: savedAt },
      { id: "persisted-assistant-1", role: "assistant", content: "ehi", timestamp: savedAt + 1 },
    ]));
    expect(result.current.restoredFromPersistence).toBe(true);
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
      suggestedPrompts: expect.arrayContaining([
        { label: "Confronta settori", prompt: "Confronta i primi tre settori" },
        { label: "Prossimo passo", prompt: "Dimmi cosa fare oggi" },
      ]),
      isStreaming: false,
    });
    expect(result.current.messages[1]?.suggestedPrompts).toHaveLength(3);
  });

  it("persists the completed visible turn with streamed tools and actions", async () => {
    actionExecutorMock.normalizeWendyAction.mockReturnValue({
      id: "action-1",
      type: "set_filters",
      status: "preview",
      risk: "low",
      label: "Applica filtri",
      description: "Prepara la lista filtrata.",
      requiresConfirmation: false,
      payload: { listType: "roles", filters: { sector: "design" } },
      sourceTool: "career_match",
    });
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({
        type: "tool_call",
        name: "career_match",
        args: { sector: "design" },
        result: { clientSide: true, action: "set_filters" },
      }));
      sse.options?.onRawChunk?.(JSON.stringify({
        type: "ui_tool",
        name: "career_match",
        args: { role: "Designer" },
      }));
      sse.options?.onRawChunk?.(JSON.stringify({ type: "done", requestId: "req-tool", contextSources: [] }));
      sse.options?.onComplete?.("");
    });

    const { result, unmount } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("trova match");
    });

    const persisted = loadPersistedThread();
    expect(persisted?.messages?.at(-1)).toMatchObject({
      role: "assistant",
      content: "[Azione Wendy proposta o completata]",
      requestId: "req-tool",
      toolsUsed: ["career_match"],
      uiTool: { name: "career_match", args: { role: "Designer" } },
      actions: [expect.objectContaining({ id: "action-1", type: "set_filters" })],
    });

    unmount();
    const restored = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await waitFor(() => expect(restored.result.current.messages.at(-1)).toMatchObject({
      uiTool: { name: "career_match", args: { role: "Designer" } },
      actions: [expect.objectContaining({ id: "action-1" })],
    }));
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

  it("adds recovery follow-ups when Wendy reports a stream error", async () => {
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({
        type: "error",
        message: "Wendy non ha potuto aggiornare il progresso dell'obiettivo.",
      }));
      sse.options?.onComplete?.("");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("aggiorna progresso obiettivo");
    });

    expect(result.current.messages.at(-1)).toMatchObject({
      role: "error",
      suggestedPrompts: expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringMatching(/obiettiv|progresso/i),
          prompt: expect.stringMatching(/strumenti dell'app|app/i),
        }),
      ]),
    });
  });

  it("adds fallback suggested prompts when Wendy completes without backend prompts", async () => {
    wendyProviderMock.pageContext = {
      page: "sector",
      data: { entityType: "sector", entityId: 7, entityName: "Cybersecurity" },
    };
    sse.start.mockImplementation(async () => {
      sse.options?.onRawChunk?.(JSON.stringify({
        type: "token",
        value: "Cybersecurity e profilo tecnico: parti da una mappa delle competenze.",
      }));
      sse.options?.onRawChunk?.(JSON.stringify({
        type: "done",
        requestId: "req-fallback",
        contextSources: ["app-data"],
      }));
      sse.options?.onComplete?.("Cybersecurity e profilo tecnico: parti da una mappa delle competenze.");
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false }));
    await act(async () => {
      await result.current.sendMessage("analizza questa pagina");
    });

    expect(result.current.messages.at(-1)?.suggestedPrompts).toEqual([
      expect.objectContaining({
        label: expect.stringContaining("Cybersecurity"),
        prompt: expect.stringContaining("Cybersecurity"),
      }),
      expect.objectContaining({
        label: expect.any(String),
        prompt: expect.any(String),
      }),
      expect.objectContaining({
        label: expect.any(String),
        prompt: expect.any(String),
      }),
    ]);
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

  it("does not retry session-expired stream failures", async () => {
    vi.useFakeTimers();
    sse.start.mockImplementation(async () => {
      sse.options?.onError?.(new Error("SESSION_EXPIRED: login required"));
    });

    const { result } = renderHook(() => useWendyChat({ ttsEnabled: false, maxRetries: 2 }));
    await act(async () => {
      await result.current.sendMessage("ciao");
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(sse.start).toHaveBeenCalledTimes(1);
    expect(result.current.retryState.active).toBe(false);
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
