import { beforeEach, describe, expect, it, vi } from "vitest";

const isLlmConfiguredMock = vi.hoisted(() => vi.fn());
const chatOnceMock = vi.hoisted(() => vi.fn());

vi.mock("../client", () => ({
  isLlmConfigured: isLlmConfiguredMock,
}));

vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

vi.mock("../llm/client", () => ({
  getLLMForRoute: () => ({ chatOnce: chatOnceMock }),
}));

vi.mock("../model-router", () => ({
  selectModelFor: () => ({ model: "test-model" }),
}));

import { translateNewsForLocale, type TranslatableNewsItem } from "./news-translator";

const italianArticle: TranslatableNewsItem = {
  id: "news-1",
  language: "it",
  title: "Titolo italiano",
  preview: "Anteprima italiana",
  content: "Contenuto italiano",
  meaning: {
    sections: [
      { key: "audience", body: "Per professionisti italiani" },
      { key: "happened", body: "E successo qualcosa" },
      { key: "why", body: "Conta per il lavoro" },
      { key: "practical", body: "Osserva cosa cambia" },
    ],
  },
};

describe("translateNewsForLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLlmConfiguredMock.mockReturnValue(true);
  });

  it("does not claim a requested locale when dynamic translation is unavailable", async () => {
    isLlmConfiguredMock.mockReturnValue(false);

    const translated = await translateNewsForLocale(italianArticle, "en");

    expect(translated).toMatchObject({
      language: "it",
      translationStatus: "source",
      title: "Titolo italiano",
      preview: "Anteprima italiana",
    });
    expect(chatOnceMock).not.toHaveBeenCalled();
  });

  it("does not claim a requested locale when dynamic translation fails", async () => {
    chatOnceMock.mockRejectedValue(new Error("llm unavailable"));

    const translated = await translateNewsForLocale(italianArticle, "fr");

    expect(translated).toMatchObject({
      language: "it",
      translationStatus: "failed",
      title: "Titolo italiano",
      preview: "Anteprima italiana",
    });
  });

  it("marks successful translations explicitly", async () => {
    chatOnceMock.mockResolvedValue(JSON.stringify({
      title: "English title",
      preview: "English preview",
      content: "English content",
      sections: [
        { key: "audience", body: "For English readers" },
        { key: "happened", body: "Something happened" },
        { key: "why", body: "It matters" },
        { key: "practical", body: "Watch one practical signal" },
      ],
    }));

    const translated = await translateNewsForLocale(italianArticle, "en");

    expect(translated).toMatchObject({
      language: "en",
      translationStatus: "translated",
      title: "English title",
      preview: "English preview",
      content: "English content",
    });
  });
});
