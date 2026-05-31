import { describe, expect, it } from "vitest";
import {
  formatPublicNewsSource,
  isPublicNewsArticleSource,
  isPublishableDiscoveryNews,
  shouldAutoPublishTrustedNews,
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

  it("keeps GNews and Tavily articles public while preserving the editorial source name", () => {
    const gnewsSource = formatPublicNewsSource({
      source: "La Stampa",
      collectorSource: "gnews",
    });
    const tavilySource = formatPublicNewsSource({
      source: "Il Post",
      collectorSource: "tavily_news",
    });

    expect(gnewsSource).toBe("GNews: La Stampa");
    expect(tavilySource).toBe("Tavily: Il Post");
    expect(isPublicNewsArticleSource({ source: gnewsSource, url: "https://www.lastampa.it/economia/lavoro/x" })).toBe(true);
    expect(isPublicNewsArticleSource({ source: tavilySource, url: "https://www.ilpost.it/lavoro/x" })).toBe(true);
    expect(isPublicNewsArticleSource({ source: "GNews: Reddit", url: "https://www.reddit.com/r/italy/post" })).toBe(false);
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

  it("allows trusted Italian news collectors to bypass LLM enrichment for baseline population", () => {
    expect(shouldAutoPublishTrustedNews({
      type: "news",
      source: "GNews",
      url: "https://example.com/lavoro-ai",
      collectorSource: "gnews",
      summary: "Notizia italiana sul mondo del lavoro e competenze digitali.",
    })).toBe(true);
    expect(shouldAutoPublishTrustedNews({
      type: "news",
      source: "Tavily",
      url: "https://example.com/lavoro-sanita",
      collectorSource: "tavily_news",
      summary: "Approfondimento italiano sul lavoro nella sanita.",
    })).toBe(true);
    expect(shouldAutoPublishTrustedNews({
      type: "news",
      source: "Reddit",
      url: "https://reddit.com/r/italy",
      collectorSource: "reddit",
      summary: "thread",
    })).toBe(false);
  });
});
