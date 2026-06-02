import { beforeEach, describe, expect, it, vi } from "vitest";

const chatOnceMock = vi.hoisted(() => vi.fn());
const isLlmConfiguredMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("../client", () => ({
  isLlmConfigured: isLlmConfiguredMock,
}));

vi.mock("../llm/client", () => ({
  getLLMForRoute: () => ({ chatOnce: chatOnceMock }),
}));

vi.mock("../model-router", () => ({
  selectModelFor: () => ({ provider: "openai", model: "gpt-4o-mini" }),
}));

import {
  clearDynamicUiTranslationCache,
  translateDynamicUiStrings,
} from "./dynamic-ui-translator";

describe("translateDynamicUiStrings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDynamicUiTranslationCache();
    isLlmConfiguredMock.mockReturnValue(true);
    chatOnceMock.mockResolvedValue(JSON.stringify({
      translations: [
        { index: 0, text: "Start test" },
      ],
    }));
  });

  it("translates uncached UI strings and serves repeated requests from cache", async () => {
    const input = {
      locale: "en",
      items: [
        {
          key: "dashboard.start",
          source: "Avvia test",
          context: "Dashboard primary action",
        },
      ],
    } as const;

    const first = await translateDynamicUiStrings(input);
    const second = await translateDynamicUiStrings(input);

    expect(first.items[0]).toMatchObject({
      key: "dashboard.start",
      source: "Avvia test",
      text: "Start test",
      status: "translated",
    });
    expect(second.items[0]).toMatchObject({
      text: "Start test",
      status: "cache",
    });
    expect(chatOnceMock).toHaveBeenCalledTimes(1);
  });

  it("returns source text without calling the LLM when target locale is Italian", async () => {
    const result = await translateDynamicUiStrings({
      locale: "it",
      items: [{ source: "Lingua", context: "Navigation menu" }],
    });

    expect(result).toMatchObject({
      locale: "it",
      items: [expect.objectContaining({ text: "Lingua", status: "source" })],
    });
    expect(chatOnceMock).not.toHaveBeenCalled();
  });

  it("falls back to source text when the LLM is not configured", async () => {
    isLlmConfiguredMock.mockReturnValue(false);

    const result = await translateDynamicUiStrings({
      locale: "fr",
      items: [{ source: "Dashboard non disponibile", context: "Dashboard error" }],
    });

    expect(result.items[0]).toMatchObject({
      text: "Dashboard non disponibile",
      status: "source",
    });
    expect(chatOnceMock).not.toHaveBeenCalled();
  });
});
