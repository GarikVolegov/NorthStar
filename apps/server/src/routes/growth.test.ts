import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: null as Express.Request["user"] | null,
}));

vi.mock("../middleware/auth", () => ({
  optionalAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (authState.user) req.user = authState.user;
    next();
  },
}));

vi.mock("../middleware/require-auth", () => ({
  requireAuth: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: dbMock,
  };
});

import growthRouter from "./growth";

const articles = [
  {
    id: 1,
    title: "Allenare una routine di focus",
    slug: "routine-focus",
    category: "produttivita",
    subcategory: null,
    description: "Una guida pratica per iniziare.",
    content: "Contenuto",
    tags: ["focus"],
    difficulty: "base",
    personalityMatches: ["I"],
    sectorLinks: [],
    readTimeMinutes: 5,
    viewCount: 0,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-20T00:00:00.000Z"),
  },
];

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/crescita", growthRouter);
  return instance;
}

function mockSelectRows(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(async () => rows),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  dbMock.select.mockReturnValueOnce(chain);
}

function mockUpdateOk() {
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(async () => []),
  };
  dbMock.update.mockReturnValueOnce(chain);
}

function stringifyQueryCondition(condition: unknown) {
  const seen = new WeakSet<object>();
  return JSON.stringify(condition, (_key, value) => {
    if (typeof value !== "object" || value === null) return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value;
  });
}

function countConditionJoins(condition: unknown) {
  const chunks = (condition as { queryChunks?: unknown[] } | undefined)?.queryChunks;
  const nested = (chunks?.[1] as { queryChunks?: unknown[] } | undefined)?.queryChunks ?? [];
  return nested.filter((chunk) => {
    const value = (chunk as { value?: unknown }).value;
    return Array.isArray(value) && value.includes(" and ");
  }).length;
}

describe("growth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    dbMock.update.mockReset();
    authState.user = null;
  });

  it("does not claim personalized growth content when the user has no test profile", async () => {
    authState.user = {
      id: 7,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      stripeSubscriptionId: null,
      journeyType: null,
      testSessionId: null,
      onboardingCompleted: false,
    };
    mockSelectRows([]);
    mockSelectRows(articles);

    const response = await request(app())
      .get("/api/crescita/per-te")
      .expect(200);

    expect(response.body).toMatchObject({
      articles: [expect.objectContaining({ id: 1 })],
      hasProfile: false,
      personalization: "generic",
      types: [],
      italianTypes: [],
    });
  });

  it("personalizes growth content from the user's latest test session", async () => {
    authState.user = {
      id: 7,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      stripeSubscriptionId: null,
      journeyType: null,
      testSessionId: null,
      onboardingCompleted: true,
    };
    mockSelectRows([
      {
        sessionId: 99,
        primaryTypes: ["Investigativo", "Artistico"],
        riasecScores: { I: 4.8, A: 4.2, S: 2 },
      } as never,
    ]);
    mockSelectRows([
      {
        ...articles[0],
        id: 2,
        title: "Allenare pensiero creativo",
        personalityMatches: ["Artistico"],
      },
      {
        ...articles[0],
        id: 3,
        title: "Organizzare documenti",
        personalityMatches: ["Convenzionale"],
      },
    ]);

    const response = await request(app())
      .get("/api/crescita/per-te")
      .expect(200);

    expect(response.body).toMatchObject({
      hasProfile: true,
      personalization: "profile",
      types: ["Investigativo", "Artistico"],
      italianTypes: ["Investigativo", "Artistico"],
    });
    expect(response.body.articles[0]).toMatchObject({
      id: 2,
      personalityMatches: ["Artistico"],
      personalization: "profile",
    });
  });

  it("marks growth list failures as structured errors", async () => {
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
      .get("/api/crescita?limit=6")
      .expect(503);

    expect(response.body).toMatchObject({
      articles: [],
      total: 0,
      status: "error",
      error: "growth_unavailable",
    });
  });

  it("includes discovery metadata on growth list articles", async () => {
    mockSelectRows(articles);

    const response = await request(app())
      .get("/api/crescita?limit=6")
      .expect(200);

    expect(response.body.articles[0]).toMatchObject({
      id: 1,
      source: "library",
      sourceLabel: "Biblioteca crescita",
      personalization: "generic",
      actionLabel: "Leggi",
      reasonLabels: expect.arrayContaining(["Tema: focus", "Profilo: I"]),
      matchSignals: expect.any(Array),
    });
  });

  it("accepts difficulty and tag filters without falling back when the library matches", async () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(async () => articles),
    };
    dbMock.select.mockReturnValueOnce(chain);

    const response = await request(app())
      .get("/api/crescita?category=produttivita&difficulty=base&tag=focus&limit=6")
      .expect(200);

    expect(response.body).toMatchObject({
      total: 1,
      status: "ok",
      source: "library",
      articles: [
        expect.objectContaining({
          source: "library",
          difficulty: "base",
          tags: ["focus"],
        }),
      ],
    });
    expect(dbMock.select).toHaveBeenCalledTimes(1);
    const whereCalls = chain.where.mock.calls as unknown as [[unknown]];
    const condition = whereCalls[0]?.[0];
    const conditionText = stringifyQueryCondition(condition);
    expect(conditionText).toContain("tags");
    expect(conditionText).toContain("%focus%");
    expect(countConditionJoins(condition)).toBe(3);
  });

  it("returns useful Italian fallback articles when the published growth library is empty", async () => {
    mockSelectRows([]);

    const response = await request(app())
      .get("/api/crescita?limit=6")
      .expect(200);

    expect(response.body).toMatchObject({
      total: expect.any(Number),
      status: "fallback",
      source: "fallback",
    });
    expect(response.body.articles.length).toBeGreaterThan(0);
    expect(response.body.articles[0]).toMatchObject({
      title: expect.stringMatching(/90 giorni|focus|crescita/i),
      category: expect.any(String),
      description: expect.stringMatching(/italiano|percorso|pratico|settimana/i),
      tags: expect.arrayContaining(["crescita"]),
    });
  });

  it("keeps empty filtered fallback responses distinguishable from provider errors", async () => {
    mockSelectRows([]);
    mockSelectRows([]);

    const response = await request(app())
      .get("/api/crescita?category=non-esiste&limit=6")
      .expect(200);

    expect(response.body).toMatchObject({
      articles: [],
      total: 0,
      status: "empty",
      source: "fallback",
    });
  });

  it("does not use fallback content for a filtered miss when the published library exists", async () => {
    mockSelectRows([]);
    mockSelectRows(articles);

    const response = await request(app())
      .get("/api/crescita?category=non-esiste&limit=6")
      .expect(200);

    expect(response.body).toMatchObject({
      articles: [],
      total: 0,
      status: "empty",
      source: "library",
    });
  });

  it("returns sectioned fallback categories when the growth library has no published categories", async () => {
    mockSelectRows([]);

    const response = await request(app())
      .get("/api/crescita/categorie")
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "crescita-professionale",
          label: "Crescita professionale",
          description: expect.stringMatching(/Percorsi pratici in italiano/i),
          count: expect.any(Number),
          source: "fallback",
        }),
      ]),
    );
  });

  it("keeps fallback recommendations generic when a ready profile has no published growth content", async () => {
    authState.user = {
      id: 7,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      stripeSubscriptionId: null,
      journeyType: null,
      testSessionId: null,
      onboardingCompleted: true,
    };
    mockSelectRows([{ primaryTypes: ["I", "A"], riasecScores: { I: 4.8, A: 4.1 } }]);
    mockSelectRows([]);

    const response = await request(app())
      .get("/api/crescita/per-te")
      .expect(200);

    expect(response.body).toMatchObject({
      hasProfile: true,
      personalization: "generic",
      status: "fallback",
      source: "fallback",
      types: ["I", "A"],
      italianTypes: ["Investigativo", "Artistico"],
    });
    expect(response.body.articles.length).toBeGreaterThan(0);
  });

  it("serves fallback growth article details by slug without touching unavailable providers", async () => {
    mockSelectRows([]);

    const response = await request(app())
      .get("/api/crescita/piano-crescita-90-giorni")
      .expect(200);

    expect(response.body).toMatchObject({
      slug: "piano-crescita-90-giorni",
      title: expect.stringMatching(/90 giorni/i),
      source: "fallback",
      related: expect.any(Array),
    });
    expect(response.body.content).toMatch(/Settimana|giorni|azione/i);
  });

  it("keeps library article details and related articles generic outside profile context", async () => {
    mockSelectRows(articles);
    mockUpdateOk();
    mockSelectRows([
      {
        ...articles[0],
        id: 2,
        slug: "routine-focus-related",
        personalityMatches: ["Artistico"],
      },
    ]);

    const response = await request(app())
      .get("/api/crescita/routine-focus")
      .expect(200);

    expect(response.body).toMatchObject({
      slug: "routine-focus",
      source: "library",
      personalization: "generic",
      reasonLabels: expect.arrayContaining(["Profilo: I"]),
      related: [
        expect.objectContaining({
          slug: "routine-focus-related",
          source: "library",
          personalization: "generic",
          reasonLabels: expect.arrayContaining(["Profilo: Artistico"]),
        }),
      ],
    });
  });
});
