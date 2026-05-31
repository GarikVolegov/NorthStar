import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../lib/redis", () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => undefined),
}));

vi.mock("@workspace/ai-server", () => ({
  PUBLIC_NEWS_SOURCES: ["gnews", "tavily", "newsapi", "il sole 24 ore", "ninja marketing", "ansa", "wired italia", "la repubblica"],
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
    publishedAt: new Date("2026-05-30T10:00:00.000Z"),
    sectorNames: ["Tecnologia & Software"],
    category: "tech_lavoro",
    relevanceScore: 0.7,
    searchQuery: "lavoro tecnologia software competenze digitali Italia",
    createdAt: new Date("2026-05-30T10:10:00.000Z"),
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
    publishedAt: new Date("2026-05-29T09:00:00.000Z"),
    sectorNames: ["Sanita & Life Sciences"],
    category: "sanita_lavoro",
    relevanceScore: 0.66,
    searchQuery: "lavoro sanita life sciences professioni Italia",
    createdAt: new Date("2026-05-29T09:10:00.000Z"),
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

function mockSelectRows(rows: typeof publishedRows) {
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

  it("marks critical query failures instead of returning an indistinguishable empty list", async () => {
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
      .expect(200);

    expect(response.body).toMatchObject({
      news: [],
      nextCursor: null,
      source: "error",
      error: "news_unavailable",
    });
  });
});
