import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDbJobsStore,
  createJobsRouter,
  createMemoryJobsStore,
  type JobCardRecord,
  type JobsFeedResponse,
  type JobsStore,
} from "./jobs";

const dbMock = vi.hoisted(() => {
  const state = {
    queryResults: [] as unknown[][],
    selectCalls: [] as Array<{
      selection: unknown;
      from?: unknown;
      wheres: unknown[];
      orderByArgs: unknown[];
      limitValue?: number;
    }>,
  };

  return {
    state,
    db: {
      select(selection: unknown) {
        const call = { selection, wheres: [], orderByArgs: [] } as typeof state.selectCalls[number];
        state.selectCalls.push(call);
        const builder = {
          from(table: unknown) {
            call.from = table;
            return builder;
          },
          leftJoin() {
            return builder;
          },
          where(condition: unknown) {
            call.wheres.push(condition);
            return builder;
          },
          orderBy(...args: unknown[]) {
            call.orderByArgs = args;
            return builder;
          },
          limit(value: number) {
            call.limitValue = value;
            return Promise.resolve(state.queryResults.shift() ?? []);
          },
        };
        return builder;
      },
    },
  };
});

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: dbMock.db,
  usersTable: { clerkId: "users.clerk_id" },
  jobPostingSnapshotsTable: {
    id: "job_posting_snapshots.id",
    roleTitle: "job_posting_snapshots.role_title",
    sectorId: "job_posting_snapshots.sector_id",
    professionId: "job_posting_snapshots.profession_id",
    count: "job_posting_snapshots.count",
    period: "job_posting_snapshots.period",
    geography: "job_posting_snapshots.geography",
    topSkills: "job_posting_snapshots.top_skills",
    avgSalaryMin: "job_posting_snapshots.avg_salary_min",
    avgSalaryMax: "job_posting_snapshots.avg_salary_max",
    growthRate: "job_posting_snapshots.growth_rate",
    source: "job_posting_snapshots.source",
  },
  professionsTable: {
    id: "professions.id",
    title: "professions.title",
    salaryRange: "professions.salary_range",
  },
  sectorsTable: {
    id: "sectors.id",
    name: "sectors.name",
  },
  testSessionsTable: {
    userId: "test_sessions.user_id",
    confirmedSectorId: "test_sessions.confirmed_sector_id",
    recommendations: "test_sessions.recommendations",
    createdAt: "test_sessions.created_at",
  },
}));

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "autonomo",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function job(overrides: Partial<JobCardRecord> = {}): JobCardRecord {
  return {
    id: 12,
    title: "UX Designer",
    company: "Adzuna - 128 segnali",
    location: "Italia",
    type: "market-signal",
    sector: "Design & UX",
    tags: ["figma", "research"],
    url: "https://www.linkedin.com/jobs/search/?keywords=UX+Designer&location=Italia",
    salary: "32.000 - 45.000 EUR",
    matchScore: 91,
    source: "adzuna",
    sourceLabel: "Adzuna",
    count: 128,
    period: "2026-06",
    growthRate: 0.12,
    isAggregate: true,
    ...overrides,
  };
}

function feed(overrides: Partial<JobsFeedResponse> = {}): JobsFeedResponse {
  const jobs = overrides.jobs ?? [job()];
  return {
    jobs,
    basedOnProfession: null,
    basedOnSector: "Design & UX",
    totalCount: jobs.length,
    status: jobs.length > 0 ? "ok" : "empty",
    personalized: true,
    source: "job_posting_snapshots",
    period: "2026-06",
    filter: { professionId: null, sectorId: null, fallback: null },
    ...overrides,
  };
}

function app(store: JobsStore = createMemoryJobsStore(feed())) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/jobs", createJobsRouter({ store }));
  return instance;
}

function snapshot(overrides: Partial<{
  id: number;
  roleTitle: string;
  sectorId: number | null;
  professionId: number | null;
  count: number;
  period: string;
  geography: string;
  topSkills: string[];
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  growthRate: number | null;
  source: string;
  sectorName: string | null;
  professionTitle: string | null;
  professionSalaryRange: string | null;
}> = {}) {
  return {
    id: 55,
    roleTitle: "product designer",
    sectorId: 2,
    professionId: 55,
    count: 64,
    period: "2026-06",
    geography: "IT",
    topSkills: ["figma", "research"],
    avgSalaryMin: 32000,
    avgSalaryMax: 45000,
    growthRate: 0.1,
    source: "adzuna",
    sectorName: "Design & UX",
    professionTitle: "Product Designer",
    professionSalaryRange: "32k-45k",
    ...overrides,
  };
}

describe("jobs routes", () => {
  beforeEach(() => {
    dbMock.state.queryResults = [];
    dbMock.state.selectCalls = [];
  });

  it("returns market-backed job role signals instead of a provider placeholder", async () => {
    const response = await request(app())
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      basedOnProfession: null,
      basedOnSector: "Design & UX",
      totalCount: 1,
      status: "ok",
      personalized: true,
      source: "job_posting_snapshots",
      period: "2026-06",
      filter: { professionId: null, sectorId: null, fallback: null },
    });
    expect(response.body.jobs[0]).toMatchObject({
      title: "UX Designer",
      company: "Adzuna - 128 segnali",
      type: "market-signal",
      count: 128,
      isAggregate: true,
    });
  });

  it("returns an honest empty state when snapshots are connected but no market signals exist", async () => {
    const response = await request(app(createMemoryJobsStore(feed({
      jobs: [],
      basedOnSector: null,
      totalCount: 0,
      status: "empty",
      personalized: false,
      period: null,
    }))))
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      jobs: [],
      basedOnProfession: null,
      basedOnSector: null,
      totalCount: 0,
      status: "empty",
      personalized: false,
      source: "job_posting_snapshots",
      period: null,
      filter: { professionId: null, sectorId: null, fallback: null },
    });
  });

  it("passes explicit profession and sector filters to the jobs store", async () => {
    const store: JobsStore = {
      list: vi.fn().mockResolvedValue(feed({
        basedOnProfession: "Product Designer",
        basedOnSector: "Design & UX",
        filter: { professionId: 55, sectorId: 2, fallback: null },
      })),
      find: vi.fn(),
    };

    const response = await request(app(store))
      .get("/api/jobs?professionId=55&sectorId=2")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(store.list).toHaveBeenCalledWith(42, { professionId: 55, sectorId: 2 });
    expect(response.body).toMatchObject({
      basedOnProfession: "Product Designer",
      basedOnSector: "Design & UX",
      filter: { professionId: 55, sectorId: 2, fallback: null },
    });
  });

  it("rejects invalid explicit job filters", async () => {
    const response = await request(app())
      .get("/api/jobs?professionId=-1&sectorId=abc")
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);

    expect(response.body).toEqual({
      error: "Filtri lavoro non validi",
      code: "INVALID_JOB_FILTERS",
      details: {
        professionId: ["Deve essere un intero positivo."],
        sectorId: ["Deve essere un intero positivo."],
      },
    });
  });

  it("documents role-filtered feed metadata through the memory store contract", async () => {
    const response = feed({
      jobs: [job({ title: "Product Designer" })],
      basedOnProfession: "Product Designer",
      basedOnSector: "Design & UX",
      filter: { professionId: 55, sectorId: 2, fallback: null },
    });

    await expect(createMemoryJobsStore(response).list(42, { professionId: 55, sectorId: 2 }))
      .resolves
      .toMatchObject({
        basedOnProfession: "Product Designer",
        basedOnSector: "Design & UX",
        filter: { professionId: 55, sectorId: 2, fallback: null },
      });
  });

  it("documents sector fallback metadata through the memory store contract", async () => {
    const response = feed({
      jobs: [job({ title: "UX Researcher" })],
      basedOnProfession: null,
      basedOnSector: "Design & UX",
      filter: { professionId: 999, sectorId: 2, fallback: "sector" },
    });

    await expect(createMemoryJobsStore(response).list(42, { professionId: 999, sectorId: 2 }))
      .resolves
      .toMatchObject({
        basedOnProfession: null,
        basedOnSector: "Design & UX",
        filter: { professionId: 999, sectorId: 2, fallback: "sector" },
      });
  });

  it("filters DB snapshots by explicit profession before sector context", async () => {
    dbMock.state.queryResults = [
      [{ confirmedSectorId: null, recommendations: [] }],
      [{ period: "2026-06" }],
      [snapshot()],
    ];

    const response = await createDbJobsStore().list(42, { professionId: 55, sectorId: 2 });

    expect(response).toMatchObject({
      basedOnProfession: "Product Designer",
      basedOnSector: "Design & UX",
      totalCount: 1,
      personalized: true,
      period: "2026-06",
      filter: { professionId: 55, sectorId: 2, fallback: null },
    });
    expect(response.jobs[0]).toMatchObject({
      title: "Product Designer",
      sector: "Design & UX",
      count: 64,
    });
  });

  it("keeps explicit profession filters constrained to the latest snapshot period", async () => {
    dbMock.state.queryResults = [
      [{ confirmedSectorId: null, recommendations: [] }],
      [{ period: "2026-06" }],
      [
        snapshot({ id: 55, count: 64, period: "2026-06" }),
        snapshot({ id: 44, count: 92, period: "2026-05" }),
      ],
    ];

    const response = await createDbJobsStore().list(42, { professionId: 55, sectorId: 2 });

    expect(response).toMatchObject({
      totalCount: 1,
      period: "2026-06",
      filter: { professionId: 55, sectorId: 2, fallback: null },
    });
    expect(response.jobs).toHaveLength(1);
    expect(response.jobs[0]).toMatchObject({
      id: 55,
      period: "2026-06",
      count: 64,
    });
  });

  it("falls back to DB sector snapshots when an explicit profession has no market signals", async () => {
    dbMock.state.queryResults = [
      [{ confirmedSectorId: null, recommendations: [] }],
      [{ period: "2026-06" }],
      [],
      [snapshot({
        id: 77,
        roleTitle: "ux researcher",
        professionId: 77,
        professionTitle: "UX Researcher",
        count: 38,
      })],
    ];

    const response = await createDbJobsStore().list(42, { professionId: 999, sectorId: 2 });

    expect(response).toMatchObject({
      basedOnProfession: null,
      basedOnSector: "Design & UX",
      totalCount: 1,
      personalized: true,
      period: "2026-06",
      filter: { professionId: 999, sectorId: 2, fallback: "sector" },
    });
    expect(response.jobs[0]).toMatchObject({
      title: "UX Researcher",
      sector: "Design & UX",
      count: 38,
    });
  });

  it("returns a real detail for an existing market signal and 404 for a missing one", async () => {
    const api = app(createMemoryJobsStore(feed()));

    const existing = await request(api)
      .get("/api/jobs/12")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(existing.body).toMatchObject({ id: 12, title: "UX Designer" });

    await request(api)
      .get("/api/jobs/99")
      .set("Authorization", `Bearer ${token()}`)
      .expect(404);
  });

  it("keeps the setup state visible when the snapshots table is missing", async () => {
    const store = {
      list: vi.fn().mockRejectedValue(Object.assign(new Error("relation does not exist"), { code: "42P01" })),
      find: vi.fn(),
    };

    const response = await request(app(store))
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      jobs: [],
      basedOnProfession: null,
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
      personalized: false,
      source: "job_posting_snapshots",
      filter: { professionId: null, sectorId: null, fallback: null },
    });
  });

  it("rejects manual writes as read-only market intelligence rather than fake persistence", async () => {
    const response = await request(app())
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .send({ title: "Designer", company: "NorthStar" })
      .expect(405);

    expect(response.body).toEqual({
      code: "JOBS_READ_ONLY",
      error: "La job board usa dati aggregati di mercato e non consente modifiche manuali agli annunci.",
      action: "refresh_market_snapshots",
    });
  });
});
