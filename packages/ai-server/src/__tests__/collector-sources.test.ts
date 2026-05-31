import { describe, expect, it, vi } from "vitest";
import {
  classifyItalianLaborSectors,
  getCollectorSources,
  getItalianLaborNewsQueries,
  isItalianLaborNewsText,
} from "../discovery-agent/collector-sources";

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

  it("defines Italian labor-market news searches across multiple sectors for GNews and Tavily", () => {
    const queries = getItalianLaborNewsQueries();

    expect(queries.length).toBeGreaterThanOrEqual(10);
    expect(new Set(queries.map((query) => query.sector)).size).toBeGreaterThanOrEqual(8);
    expect(queries.every((query) => query.type === "news")).toBe(true);
    expect(queries.every((query) => /lavoro|profession|occupazione|competenze|carriere/i.test(query.q))).toBe(true);
    expect(queries.map((query) => query.sector)).toEqual(expect.arrayContaining([
      "Tecnologia & Software",
      "Sanita & Life Sciences",
      "Energia & Sostenibilita",
      "Finanza & Fintech",
      "Marketing & Comunicazione",
    ]));
  });

  it("filters Tavily-style results to Italian labor-market content", () => {
    expect(isItalianLaborNewsText({
      title: "Lavoro, crescono le richieste di competenze digitali nelle imprese italiane",
      summary: "Il mercato del lavoro in Italia accelera su AI, formazione e professioni tecniche.",
      url: "https://www.esempio.it/lavoro/competenze-digitali",
    })).toBe(true);

    expect(isItalianLaborNewsText({
      title: "Global study finds widening gap between AI ambition and workforce readiness",
      summary: "Only 36% of leaders say their talent strategy clearly demonstrates AI will create opportunities for workers.",
      url: "https://www.example.com/press-release",
    })).toBe(false);
  });

  it("classifies Italian news into NorthStar sector buckets", () => {
    expect(classifyItalianLaborSectors({
      title: "Competenze digitali richieste in 6 assunzioni su 10",
      summary: "Cresce la domanda di profili software, dati e intelligenza artificiale.",
      fallbackSector: "Economia Italia",
    })).toEqual(expect.arrayContaining(["Tecnologia & Software", "AI & Automazione"]));

    expect(classifyItalianLaborSectors({
      title: "Parchi acquatici, al via la stagione calda",
      summary: "Nuove assunzioni stagionali nel turismo e nell'hospitality.",
      fallbackSector: "Economia Italia",
    })).toEqual(["Turismo & Hospitality"]);
  });
});
