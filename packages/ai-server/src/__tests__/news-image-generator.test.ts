import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawItem } from "../discovery-agent/collector-types";
import { generateNewsImage } from "../discovery-agent/news-image-generator";
import { getNonChatOpenAI } from "../client";
import { generateImageBuffer } from "../image/client";

vi.mock("../client", () => ({
  getNonChatOpenAI: vi.fn(() => ({})),
}));

vi.mock("../image/client", () => ({
  generateImageBuffer: vi.fn(async () => Buffer.from("png-bytes")),
}));

function item(overrides: Partial<RawItem>): RawItem {
  return {
    type: "news",
    title: "Economia italiana e lavoro digitale",
    url: "https://example.com/news",
    source: "ANSA",
    summary: "summary",
    category: "economia",
    sectorNames: ["Economia Italia"],
    collectorSource: "ansa_rss",
    ...overrides,
  };
}

describe("news image generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEWS_IMAGE_GENERATION;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  });

  it("does nothing unless image generation is explicitly enabled", async () => {
    const items = [item({ imageUrl: undefined })];

    const result = await generateNewsImage(items);

    expect(result).toEqual(items);
    expect(getNonChatOpenAI).not.toHaveBeenCalled();
    expect(generateImageBuffer).not.toHaveBeenCalled();
  });

  it("fills missing image URLs with generated data URLs for at most ten unique priority items", async () => {
    process.env.NEWS_IMAGE_GENERATION = "true";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "sk-test";
    const items = Array.from({ length: 12 }, (_, index) => item({
      title: `Economia italiana lavoro digitale ${index}`,
      url: `https://example.com/news-${index}`,
      imageUrl: index === 11 ? "https://example.com/existing.png" : undefined,
    }));

    const result = await generateNewsImage(items);

    expect(generateImageBuffer).toHaveBeenCalledTimes(10);
    expect(result.filter((entry) => entry.imageUrl?.startsWith("data:image/png;base64,"))).toHaveLength(10);
    expect(result[10]!.imageUrl).toBeUndefined();
    expect(result[11]!.imageUrl).toBe("https://example.com/existing.png");
  });

  it("skips failed image generations without blocking the batch", async () => {
    process.env.NEWS_IMAGE_GENERATION = "true";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "sk-test";
    vi.mocked(generateImageBuffer)
      .mockRejectedValueOnce(new Error("image failed"))
      .mockResolvedValueOnce(Buffer.from("second-image"));

    const result = await generateNewsImage([
      item({ title: "Primo articolo", url: "https://example.com/1" }),
      item({ title: "Secondo articolo", url: "https://example.com/2" }),
    ]);

    expect(result[0]!.imageUrl).toBeUndefined();
    expect(result[1]!.imageUrl).toMatch(/^data:image\/png;base64,/);
  });
});
