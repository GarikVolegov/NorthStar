import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  createJobsRouter,
  createMemoryJobsStore,
  type JobCardRecord,
  type JobsFeedResponse,
  type JobsStore,
} from "./jobs";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
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
    basedOnSector: "Design & UX",
    totalCount: jobs.length,
    status: jobs.length > 0 ? "ok" : "empty",
    personalized: true,
    source: "job_posting_snapshots",
    period: "2026-06",
    ...overrides,
  };
}

function app(store: JobsStore = createMemoryJobsStore(feed())) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/jobs", createJobsRouter({ store }));
  return instance;
}

describe("jobs routes", () => {
  it("returns market-backed job role signals instead of a provider placeholder", async () => {
    const response = await request(app())
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      basedOnSector: "Design & UX",
      totalCount: 1,
      status: "ok",
      personalized: true,
      source: "job_posting_snapshots",
      period: "2026-06",
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
      basedOnSector: null,
      totalCount: 0,
      status: "empty",
      personalized: false,
      source: "job_posting_snapshots",
      period: null,
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
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
      personalized: false,
      source: "job_posting_snapshots",
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
