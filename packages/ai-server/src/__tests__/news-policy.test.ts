import { describe, expect, it } from "vitest";
import {
  isPublicNewsArticleSource,
  isPublishableDiscoveryNews,
} from "../discovery-agent/news-policy";

describe("news policy", () => {
  it("keeps public news limited to verified editorial sources", () => {
    expect(isPublicNewsArticleSource({ source: "Il Sole 24 Ore", url: "https://www.ilsole24ore.com/art/x" })).toBe(true);
    expect(isPublicNewsArticleSource({ source: "GNews", url: "https://example.com/news" })).toBe(true);
    expect(isPublicNewsArticleSource({ source: "ANSA", url: "https://www.ansa.it/sito/notizie/economia/x.html" })).toBe(true);
    expect(isPublicNewsArticleSource({ source: "Wired Italia", url: "https://www.wired.it/article/x/" })).toBe(true);
    expect(isPublicNewsArticleSource({ source: "La Repubblica", url: "https://www.repubblica.it/economia/x/" })).toBe(true);
    expect(isPublicNewsArticleSource({ source: "Reddit r/learnprogramming", url: "https://www.reddit.com/r/learnprogramming/post" })).toBe(false);
    expect(isPublicNewsArticleSource({ source: "Dev.to", url: "https://dev.to/example/post" })).toBe(false);
    expect(isPublicNewsArticleSource({ source: "NorthStar", url: "https://northstar.internal/seed/1" })).toBe(false);
  });

  it("allows news from approved collector sources even when editorial source differs", () => {
    expect(isPublishableDiscoveryNews({
      type: "news",
      source: "La Stampa",
      url: "https://example.com/economia/x",
      collectorSource: "gnews",
    })).toBe(true);
    expect(isPublishableDiscoveryNews({
      type: "news",
      source: "ANSA",
      url: "https://www.ansa.it/sito/notizie/economia/x.html",
      collectorSource: "ansa_rss",
    })).toBe(true);
  });

  it("publishes only enriched real news discoveries", () => {
    expect(isPublishableDiscoveryNews({
      type: "news",
      source: "Il Sole 24 Ore",
      url: "https://www.ilsole24ore.com/art/x",
    })).toBe(true);
    expect(isPublishableDiscoveryNews({
      type: "growth",
      source: "Il Sole 24 Ore",
      url: "https://www.ilsole24ore.com/art/x",
    })).toBe(false);
    expect(isPublishableDiscoveryNews({
      type: "news",
      source: "Reddit r/ItaliaPersonalFinance",
      url: "https://www.reddit.com/r/ItaliaPersonalFinance/post",
      collectorSource: "reddit",
    })).toBe(false);
  });
});
