import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const aiServerMock = vi.hoisted(() => ({
  runNewsPublisher: vi.fn(),
  translateNewsForLocale: vi.fn(),
}));

const redisMock = vi.hoisted(() => ({
  cacheGet: vi.fn(async (): Promise<unknown> => null),
  cacheSet: vi.fn(async () => undefined),
}));

vi.mock("../lib/redis", () => ({
  cacheGet: redisMock.cacheGet,
  cacheSet: redisMock.cacheSet,
}));

vi.mock("@workspace/ai-server", () => ({
  PUBLIC_NEWS_SOURCES: ["gnews", "tavily", "newsapi", "il sole 24 ore", "ninja marketing", "ansa", "wired italia", "la repubblica"],
  runNewsPublisher: aiServerMock.runNewsPublisher,
  translateNewsForLocale: aiServerMock.translateNewsForLocale,
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: dbMock,
  };
});

import newsRouter from "./news";

const publishedRows = [
  {
    id: 10,
    embedding: null,
    title: "Competenze digitali, nuove assunzioni nelle imprese italiane",
    url: "https://www.lastampa.it/economia/lavoro/competenze-digitali",
    urlHash: "gnews-lastampa",
    source: "GNews: La Stampa",
    summary: "Le imprese italiane cercano profili software e competenze digitali.",
    imageUrl: null,
    content: "Dettaglio",
    publishedAt: new Date("2026-06-01T10:00:00.000Z"),
    sectorNames: ["Tecnologia & Software"],
    category: "tech_lavoro",
    relevanceScore: 0.7,
    searchQuery: "lavoro tecnologia software competenze digitali Italia",
    createdAt: new Date("2026-06-01T10:10:00.000Z"),
  },
  {
    id: 11,
    embedding: null,
    title: "Sanita, cresce la domanda di nuove professioni",
    url: "https://www.ilpost.it/lavoro/sanita-professioni",
    urlHash: "tavily-ilpost",
    source: "Tavily: Il Post",
    summary: "La sanita italiana assume nuovi profili e investe in formazione.",
    imageUrl: null,
    content: "Dettaglio",
    publishedAt: new Date("2026-06-01T09:00:00.000Z"),
    sectorNames: ["Sanita & Life Sciences"],
    category: "sanita_lavoro",
    relevanceScore: 0.66,
    searchQuery: "lavoro sanita life sciences professioni Italia",
    createdAt: new Date("2026-06-01T09:10:00.000Z"),
  },
];

let lastWhereText = "";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/news", newsRouter);
  return instance;
}

function flattenSql(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenSql).join(" ");
  if (typeof value === "object") {
    const record = value as { queryChunks?: unknown[]; value?: unknown };
    if (record.queryChunks) return record.queryChunks.map(flattenSql).join(" ");
    if (Array.isArray(record.value)) return record.value.map(flattenSql).join(" ");
    if (record.value) return flattenSql(record.value);
  }
  return "";
}

function mockSelectRows(rows: unknown[]) {
  lastWhereText = "";
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((whereClause: unknown) => {
      lastWhereText = flattenSql(whereClause).toLowerCase();
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  dbMock.select.mockReturnValueOnce(chain);
}

describe("news routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    redisMock.cacheGet.mockResolvedValue(null);
    redisMock.cacheSet.mockResolvedValue(undefined);
    aiServerMock.runNewsPublisher.mockResolvedValue({ transferred: 0, seeded: 0, missingCoverage: [], durationMs: 10 });
    aiServerMock.translateNewsForLocale.mockImplementation(async (item, locale) => ({
      ...item,
      language: locale,
      title: `${locale}:${item.title}`,
      preview: `${locale}:${item.preview}`,
      description: `${locale}:${item.description}`,
      content: item.content ? `${locale}:${item.content}` : item.content,
      meaning: item.meaning ? {
        ...item.meaning,
        sections: item.meaning.sections?.map((section: { key: string; body: string }) => ({
          key: section.key,
          body: `${locale}:${section.body}`,
        })),
      } : item.meaning,
    }));
  });

  it("returns published GNews and Tavily articles whose source keeps the editorial name", async () => {
    mockSelectRows(publishedRows);

    const response = await request(app())
      .get("/api/news")
      .expect(200);

    expect(lastWhereText).toContain("gnews:%");
    expect(lastWhereText).toContain("tavily:%");
    expect(response.body.news).toEqual([
      expect.objectContaining({
        id: "10",
        source: "GNews: La Stampa",
        preview: expect.stringContaining("competenze digitali"),
        image: expect.stringContaining("/api/news/fallback-image/technology.svg"),
        language: "it",
        meaning: expect.objectContaining({
          audience: expect.stringContaining("Tecnologia & Software"),
          whyItMatters: expect.stringContaining("Questa notizia ti aiuta"),
          sections: [
            expect.objectContaining({ key: "audience", body: expect.stringContaining("Tecnologia & Software") }),
            expect.objectContaining({ key: "happened", body: expect.stringContaining("competenze digitali") }),
            expect.objectContaining({ key: "why", body: expect.stringContaining("Questa notizia ti aiuta") }),
            expect.objectContaining({ key: "practical", body: expect.stringContaining("Confronta") }),
          ],
        }),
        category: "technology",
        sector: "Tecnologia & Software",
        tags: ["Tecnologia & Software"],
      }),
      expect.objectContaining({
        id: "11",
        source: "Tavily: Il Post",
        preview: expect.stringContaining("sanita italiana"),
        category: "health",
        sector: "Sanita & Life Sciences",
        tags: ["Sanita & Life Sciences"],
      }),
    ]);
  });

  it("localizes the user-facing meaning contract to the requested news locale", async () => {
    mockSelectRows([publishedRows[0]]);

    const response = await request(app())
      .get("/api/news?locale=en")
      .expect(200);

    expect(response.body.news[0]).toMatchObject({
      language: "en",
      image: expect.stringContaining("/api/news/fallback-image/technology.svg"),
      title: expect.stringContaining("en:"),
      meaning: expect.objectContaining({
        sections: [
          expect.objectContaining({ key: "audience", body: expect.stringContaining("en:") }),
          expect.objectContaining({ key: "happened", body: expect.stringContaining("en:") }),
          expect.objectContaining({ key: "why", body: expect.stringContaining("en:") }),
          expect.objectContaining({ key: "practical", body: expect.stringContaining("en:") }),
        ],
      }),
    });
    expect(aiServerMock.translateNewsForLocale).toHaveBeenCalledWith(expect.objectContaining({ id: "10" }), "en");
    expect(response.body.news[0].meaning.whyItMatters).not.toMatch(/NorthStar/i);
  });

  it("does not return source-language feed items for a non-Italian requested locale", async () => {
    aiServerMock.translateNewsForLocale.mockImplementation(async (item) => ({
      ...item,
      language: "it",
      translationStatus: "source",
    }));
    mockSelectRows([publishedRows[0]]);

    const response = await request(app())
      .get("/api/news?locale=en")
      .expect(503);

    expect(response.body).toMatchObject({
      news: [],
      nextCursor: null,
      source: "error",
      status: "error",
      error: "news_translation_unavailable",
    });
  });

  it("structures news detail around the user and concrete next steps", async () => {
    mockSelectRows([{ ...publishedRows[0], content: null }]);

    const response = await request(app())
      .get("/api/news/article/10")
      .expect(200);

    expect(response.body.article.content).toContain("### Per chi è");
    expect(response.body.article.content).toContain("### Cosa è successo");
    expect(response.body.article.content).toContain("### Perché conta per l'utente");
    expect(response.body.article.content).toContain("### Cosa fare adesso");
    expect(response.body.article.content).not.toContain("### Perché conta per te");
    expect(response.body.article.content).not.toContain("### Impatto pratico");
    expect(response.body.article.content).not.toContain("### Cosa osservare");
    expect(response.body.article.content).not.toMatch(/NorthStar/i);
  });

  it("localizes the detailed news structure for supported locales", async () => {
    mockSelectRows([{ ...publishedRows[0], content: null }]);

    const response = await request(app())
      .get("/api/news/article/10?locale=es")
      .expect(200);

    expect(aiServerMock.translateNewsForLocale).toHaveBeenCalledWith(expect.objectContaining({ id: "10" }), "es");
    expect(response.body.article.language).toBe("es");
    expect(response.body.article.content).toContain("es:");
    expect(response.body.article.meaning.sections).toEqual([
      expect.objectContaining({ key: "audience", body: expect.stringContaining("es:") }),
      expect.objectContaining({ key: "happened", body: expect.stringContaining("es:") }),
      expect.objectContaining({ key: "why", body: expect.stringContaining("es:") }),
      expect.objectContaining({ key: "practical", body: expect.stringContaining("es:") }),
    ]);
    expect(response.body.article.content).not.toMatch(/NorthStar/i);
  });

  it("does not return source-language detail content for a non-Italian requested locale", async () => {
    aiServerMock.translateNewsForLocale.mockImplementation(async (item) => ({
      ...item,
      language: "it",
      translationStatus: "source",
    }));
    mockSelectRows([{ ...publishedRows[0], content: null }]);

    const response = await request(app())
      .get("/api/news/article/10?locale=en")
      .expect(503);

    expect(response.body).toMatchObject({
      error: "news_translation_unavailable",
      requestedLocale: "en",
    });
  });

  it("adds provider diagnostics when the feed is empty", async () => {
    mockSelectRows([]);
    aiServerMock.runNewsPublisher.mockResolvedValueOnce({ transferred: 0, seeded: 0, missingCoverage: [], durationMs: 10 });
    mockSelectRows([]);
    mockSelectRows([
      {
        name: "GNews lavoro",
        sourceType: "gnews",
        enabled: true,
        lastFetchAt: new Date("2026-05-31T08:00:00.000Z"),
        lastError: null,
        totalFetched: 7,
      },
      {
        name: "Tavily lavoro",
        sourceType: "tavily",
        enabled: true,
        lastFetchAt: null,
        lastError: "rate limit",
        totalFetched: 0,
      },
    ]);

    const response = await request(app())
      .get("/api/news")
      .expect(200);

    expect(response.body).toMatchObject({
      news: [],
      source: "live",
      status: "empty",
      diagnostics: {
        status: "degraded",
        providerStatus: "degraded",
        enabledSources: 2,
        sourcesWithErrors: 1,
        totalFetched: 7,
        lastFetchAt: "2026-05-31T08:00:00.000Z",
        lastAttemptAt: "2026-05-31T08:00:00.000Z",
        stalenessMs: expect.any(Number),
        refreshAction: "check_provider_keys",
        nextAction: "check_provider_keys",
        actionLabel: expect.any(String),
      },
    });
  });

  it("auto-refreshes the feed from trusted news providers when the first page is empty", async () => {
    mockSelectRows([]);
    aiServerMock.runNewsPublisher.mockResolvedValueOnce({ transferred: 1, seeded: 0, missingCoverage: [], durationMs: 25 });
    mockSelectRows([publishedRows[0]]);

    const response = await request(app())
      .get("/api/news")
      .expect(200);

    expect(aiServerMock.runNewsPublisher).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      status: "ok",
      source: "auto_refresh",
      refresh: {
        attempted: true,
        reason: "empty",
        transferred: 1,
      },
      news: [expect.objectContaining({ id: "10" })],
    });
  });

  it("does not serve a cached empty first page without trying an auto-refresh", async () => {
    redisMock.cacheGet.mockResolvedValueOnce([]);
    mockSelectRows([]);
    aiServerMock.runNewsPublisher.mockResolvedValueOnce({ transferred: 1, seeded: 0, missingCoverage: [], durationMs: 25 });
    mockSelectRows([publishedRows[0]]);

    const response = await request(app())
      .get("/api/news")
      .expect(200);

    expect(aiServerMock.runNewsPublisher).toHaveBeenCalledTimes(1);
    expect(response.body.source).toBe("auto_refresh");
    expect(response.body.news).toEqual([expect.objectContaining({ id: "10" })]);
  });

  it("does not serve a cached stale first page without trying an auto-refresh", async () => {
    redisMock.cacheGet.mockResolvedValueOnce([
      {
        id: "9",
        title: "Vecchia notizia",
        preview: "Feed fermo",
        description: "Feed fermo",
        source: "GNews",
        sourceUrl: "https://example.com/stale",
        url: "https://example.com/stale",
        detailUrl: "/news/9",
        publishedAt: "2026-05-20T10:00:00.000Z",
        image: null,
        category: "technology",
        sector: "Tecnologia & Software",
        tags: ["Tecnologia & Software"],
        relevance: 0.5,
        plan: "free",
      },
    ]);
    mockSelectRows([
      {
        ...publishedRows[0],
        id: 9,
        publishedAt: new Date("2026-05-20T10:00:00.000Z"),
      },
    ]);
    aiServerMock.runNewsPublisher.mockResolvedValueOnce({ transferred: 1, seeded: 0, missingCoverage: [], durationMs: 25 });
    mockSelectRows([publishedRows[0]]);

    const response = await request(app())
      .get("/api/news")
      .expect(200);

    expect(aiServerMock.runNewsPublisher).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      source: "auto_refresh",
      refresh: {
        reason: "stale",
        transferred: 1,
      },
      news: [expect.objectContaining({ id: "10" })],
    });
  });

  it("auto-refreshes the first page when the newest public article is stale", async () => {
    mockSelectRows([
      {
        ...publishedRows[0],
        id: 9,
        publishedAt: new Date("2026-05-20T10:00:00.000Z"),
      },
    ]);
    aiServerMock.runNewsPublisher.mockResolvedValueOnce({ transferred: 1, seeded: 0, missingCoverage: [], durationMs: 25 });
    mockSelectRows([publishedRows[0]]);

    const response = await request(app())
      .get("/api/news")
      .expect(200);

    expect(aiServerMock.runNewsPublisher).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      source: "auto_refresh",
      refresh: {
        reason: "stale",
        transferred: 1,
      },
      news: [expect.objectContaining({ id: "10" })],
    });
  });

  it("does not auto-refresh for a search query that simply has no matches", async () => {
    mockSelectRows([]);
    mockSelectRows([
      {
        name: "GNews lavoro",
        sourceType: "gnews",
        enabled: true,
        lastFetchAt: new Date(),
        lastError: null,
      },
    ]);

    const response = await request(app())
      .get("/api/news?search=nessun-risultato-specifico")
      .expect(200);

    expect(aiServerMock.runNewsPublisher).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      news: [],
      source: "live",
      status: "empty",
      diagnostics: {
        providerStatus: "ready",
      },
    });
  });

  it("auto-refreshes an empty multi-category feed so sector buckets can populate", async () => {
    mockSelectRows([]);
    mockSelectRows([]);
    aiServerMock.runNewsPublisher.mockResolvedValueOnce({ transferred: 2, seeded: 0, missingCoverage: [], durationMs: 25 });
    mockSelectRows([publishedRows[0]]);
    mockSelectRows([publishedRows[1]]);

    const response = await request(app())
      .get("/api/news?multi=true&categories=technology,health&perCategory=1")
      .expect(200);

    expect(aiServerMock.runNewsPublisher).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      source: "auto_refresh",
      status: "ok",
      refresh: {
        attempted: true,
        reason: "empty",
        transferred: 2,
      },
      news: [
        expect.objectContaining({ id: "10", category: "technology" }),
        expect.objectContaining({ id: "11", category: "health" }),
      ],
    });
  });

  it("does not mask an empty feed as real empty when every enabled provider has errors", async () => {
    mockSelectRows([]);
    aiServerMock.runNewsPublisher.mockResolvedValueOnce({ transferred: 0, seeded: 0, missingCoverage: [], durationMs: 10 });
    mockSelectRows([]);
    mockSelectRows([
      {
        name: "GNews lavoro",
        sourceType: "gnews",
        enabled: true,
        lastFetchAt: new Date("2026-05-31T08:00:00.000Z"),
        lastError: "quota exceeded",
      },
      {
        name: "Tavily lavoro",
        sourceType: "tavily",
        enabled: true,
        lastFetchAt: new Date("2026-05-31T08:01:00.000Z"),
        lastError: "rate limit",
      },
    ]);

    const response = await request(app())
      .get("/api/news")
      .expect(503);

    expect(response.body).toMatchObject({
      news: [],
      nextCursor: null,
      source: "error",
      status: "error",
      error: "news_unavailable",
      diagnostics: {
        providerStatus: "degraded",
        enabledSources: 2,
        sourcesWithErrors: 2,
        lastAttemptAt: "2026-05-31T08:01:00.000Z",
        refreshAction: "check_provider_keys",
      },
    });
  });

  it("returns a structured error status when the main feed cannot be queried", async () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    };
    dbMock.select.mockReturnValueOnce(chain);

    const response = await request(app())
      .get("/api/news")
      .expect(503);

    expect(response.body).toMatchObject({
      news: [],
      nextCursor: null,
      source: "error",
      error: "news_unavailable",
    });
  });

  it("keeps partial multi-category content but fails when every category query fails", async () => {
    const successChain = {
      from: vi.fn(() => successChain),
      where: vi.fn(() => successChain),
      orderBy: vi.fn(() => successChain),
      limit: vi.fn(async () => [publishedRows[0]]),
    };
    const failingChain = {
      from: vi.fn(() => failingChain),
      where: vi.fn(() => failingChain),
      orderBy: vi.fn(() => failingChain),
      limit: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    };
    dbMock.select.mockReturnValueOnce(successChain).mockReturnValueOnce(failingChain);

    const partial = await request(app())
      .get("/api/news?multi=true&categories=technology,business&perCategory=1")
      .expect(200);

    expect(partial.body).toMatchObject({
      news: [expect.objectContaining({ id: "10" })],
      source: "partial",
      status: "partial",
    });
    expect(partial.body.errors).toEqual(["news_unavailable"]);

    dbMock.select.mockReturnValue(failingChain);

    const failed = await request(app())
      .get("/api/news?multi=true&categories=technology,business&perCategory=1")
      .expect(503);

    expect(failed.body).toMatchObject({
      news: [],
      nextCursor: null,
      source: "error",
      status: "error",
      error: "news_unavailable",
    });
  });
});
