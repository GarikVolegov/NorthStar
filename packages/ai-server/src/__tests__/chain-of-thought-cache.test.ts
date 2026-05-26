import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.hoisted(() => vi.fn());

vi.mock("../client", () => ({
  openai: {
    chat: {
      completions: {
        create: createMock,
      },
    },
  },
}));

vi.mock("../model-router", () => ({
  selectModelFor: vi.fn(() => ({ model: "test-model" })),
}));

describe("runChainOfThought cache", () => {
  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
  });

  it("does not reuse cached reasoning across different conversations", async () => {
    createMock
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({
          limiting_pattern: "first",
          controllable_actions: ["one"],
          blind_spot: "first blind spot",
          confidence: 0.95,
        }) } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({
          limiting_pattern: "second",
          controllable_actions: ["two"],
          blind_spot: "second blind spot",
          confidence: 0.95,
        }) } }],
      });

    const { runChainOfThought } = await import("../growth-agent/chain-of-thought");
    const message = "voglio cambiare carriera ma continuo a rimandare ogni settimana per paura";

    const first = await runChainOfThought(42, message, "summary", "conversation-a");
    const second = await runChainOfThought(42, message, "summary", "conversation-b");

    expect(first?.limitingPattern).toBe("first");
    expect(second?.limitingPattern).toBe("second");
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
