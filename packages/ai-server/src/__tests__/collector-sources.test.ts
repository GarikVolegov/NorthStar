import { describe, expect, it, vi } from "vitest";
import { getCollectorSources } from "../discovery-agent/collector-sources";

vi.mock("../discovery-agent/collector-rss", () => ({
  fetchRSS: vi.fn(async (url: string) => [{
    title: `RSS item ${url}`,
    url: `${url}?article=1`,
    summary: "summary",
    publishedAt: new Date("2026-05-26T10:00:00Z"),
  }]),
}));

describe("collector source selection", () => {
  it("limits fast lane to high-frequency sources", () => {
    const names = getCollectorSources({ priorityOnly: true }).map((source) => source.name);

    expect(names).toEqual(expect.arrayContaining(["hackernews", "newsapi", "gnews", "static_priority_rss", "dynamic_priority_sources"]));
    expect(names).not.toContain("reddit");
    expect(names).not.toContain("youtube_edu");
    expect(names).not.toContain("devto");
  });

  it("collects authoritative Italian RSS feeds as news", async () => {
    const staticSource = getCollectorSources().find((source) => source.name === "static_rss");
    expect(staticSource).toBeDefined();

    const items = await staticSource!.fn();

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "news",
        source: "ANSA",
        collectorSource: "ansa_rss",
        url: "https://www.ansa.it/sito/notizie/economia/economia_rss.xml?article=1",
      }),
      expect.objectContaining({
        type: "news",
        source: "ANSA",
        collectorSource: "ansa_rss",
        url: "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml?article=1",
      }),
      expect.objectContaining({
        type: "news",
        source: "Wired Italia",
        collectorSource: "wired_it_rss",
        url: "https://www.wired.it/feed/?article=1",
      }),
      expect.objectContaining({
        type: "news",
        source: "La Repubblica",
        collectorSource: "repubblica_rss",
        url: "https://www.repubblica.it/rss/economia/rss2.0.xml?article=1",
      }),
      expect.objectContaining({
        type: "news",
        source: "Ninja Marketing",
        collectorSource: "ninja_marketing_rss",
        url: "https://www.ninjamarketing.it/feed/?article=1",
      }),
    ]));
  });
});
