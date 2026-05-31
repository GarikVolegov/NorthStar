import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
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

describe("growth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
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
});
