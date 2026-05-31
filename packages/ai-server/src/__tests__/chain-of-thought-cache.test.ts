import { beforeEach, describe, expect, it, vi } from "vitest";

const chatOnceMock = vi.hoisted(() => vi.fn());
const getLLMForRouteMock = vi.hoisted(() => vi.fn());

vi.mock("../llm/client", () => ({
  getLLMForRoute: getLLMForRouteMock,
}));

vi.mock("../model-router", () => ({
  selectModelFor: vi.fn(() => ({ model: "test-model", provider: "groq" })),
}));

describe("runChainOfThought cache", () => {
  beforeEach(() => {
    vi.resetModules();
    chatOnceMock.mockReset();
    getLLMForRouteMock.mockReset();
    getLLMForRouteMock.mockReturnValue({ chatOnce: chatOnceMock });
  });

  it("does not reuse cached reasoning across different conversations", async () => {
    chatOnceMock
      .mockResolvedValueOnce(JSON.stringify({
          limiting_pattern: "first",
          controllable_actions: ["one"],
          blind_spot: "first blind spot",
          confidence: 0.95,
        }))
      .mockResolvedValueOnce(JSON.stringify({
          limiting_pattern: "second",
          controllable_actions: ["two"],
          blind_spot: "second blind spot",
          confidence: 0.95,
        }));

    const { runChainOfThought } = await import("../growth-agent/chain-of-thought");
    const message = "voglio cambiare carriera ma continuo a rimandare ogni settimana per paura";

    const first = await runChainOfThought(42, message, "summary", "conversation-a");
    const second = await runChainOfThought(42, message, "summary", "conversation-b");

    expect(first?.limitingPattern).toBe("first");
    expect(second?.limitingPattern).toBe("second");
    expect(getLLMForRouteMock).toHaveBeenCalledWith({ provider: "groq" });
    expect(chatOnceMock).toHaveBeenCalledTimes(2);
  });
});
