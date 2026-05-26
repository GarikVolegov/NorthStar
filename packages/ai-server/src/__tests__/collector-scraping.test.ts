import { describe, expect, it } from "vitest";
import { normalizeScrapedItems } from "../discovery-agent/collector-scraping";

describe("collector scraping sources", () => {
  it("normalizes structured scraping results into raw discovery items", () => {
    const items = normalizeScrapedItems(
      {
        id: 9,
        name: "Jobrapido Blog",
        itemType: "growth",
        sector: "Career Development",
        category: "career_advice",
        scrapingUrl: "https://blog.jobrapido.com",
      },
      [
        {
          title: "Come leggere i segnali del mercato del lavoro",
          url: "/mercato-lavoro",
          summary: "Una guida pratica per candidati e professionisti.",
          publishedAt: "2026-05-20T09:00:00.000Z",
        },
        { title: "", url: "https://example.com/skip", summary: "incompleto" },
      ],
    );

    expect(items).toEqual([
      {
        type: "growth",
        title: "Come leggere i segnali del mercato del lavoro",
        url: "https://blog.jobrapido.com/mercato-lavoro",
        source: "Jobrapido Blog",
        summary: "Una guida pratica per candidati e professionisti.",
        imageUrl: undefined,
        publishedAt: new Date("2026-05-20T09:00:00.000Z"),
        category: "career_advice",
        sectorNames: ["Career Development"],
        collectorSource: "scraping_9",
        searchQuery: "Jobrapido Blog",
      },
    ]);
  });
});
