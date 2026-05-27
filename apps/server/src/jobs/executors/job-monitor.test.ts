/**
 * job-monitor.test.ts — unit tests for jobMonitorExecutor.
 *
 * Verifies:
 *  - Returns a valid RoutineResult shape with title, body, cta, metadata
 *  - Handles empty results (no matching job snapshots) without crashing
 *  - Handles DB errors gracefully (returns a fallback result, never throws)
 *  - Honors role/city/count parameters
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mutable state ────────────────────────────────────────────────────

const queryRows = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  throws: null as Error | null,
}));

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../../middleware/logger.js", () => ({
  rootLogger: {
    child: vi.fn(() => ({
      info:  vi.fn(),
      warn:  vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@workspace/db", () => {
  const jobPostingSnapshotsTable = {
    roleTitle:  "job_posting_snapshots.role_title",
    count:      "job_posting_snapshots.count",
    geography:  "job_posting_snapshots.geography",
    topSkills:  "job_posting_snapshots.top_skills",
    growthRate: "job_posting_snapshots.growth_rate",
    period:     "job_posting_snapshots.period",
  };

  function selectChain() {
    type Chain = {
      from:    ReturnType<typeof vi.fn>;
      where:   ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit:   ReturnType<typeof vi.fn>;
    };
    const chain: Chain = {
      from:    vi.fn(() => chain),
      where:   vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit:   vi.fn(() => {
        if (queryRows.throws) return Promise.reject(queryRows.throws);
        return Promise.resolve(queryRows.rows);
      }),
    };
    return chain;
  }

  return {
    jobPostingSnapshotsTable,
    db: {
      select: vi.fn(() => selectChain()),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  desc:  vi.fn((col: unknown) => ({ _desc: col })),
  ilike: vi.fn((col: unknown, val: unknown) => ({ _ilike: [col, val] })),
  and:   vi.fn((...args: unknown[]) => ({ _and: args })),
}));

// ── Import subject AFTER mocks ────────────────────────────────────────────────

import { jobMonitorExecutor } from "./job-monitor";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRoutine(parameters: Record<string, unknown> = {}): Parameters<typeof jobMonitorExecutor>[0] {
  return {
    id:            1,
    userId:        42,
    type:          "job_monitor",
    name:          "Test routine",
    schedule:      "every_thursday",
    parameters,
    outputChannel: "email",
    active:        true,
    lastRunAt:     null,
    nextRunAt:     new Date(),
    createdAt:     new Date(),
    updatedAt:     new Date(),
  } as unknown as Parameters<typeof jobMonitorExecutor>[0];
}

function makeUser(): Parameters<typeof jobMonitorExecutor>[1] {
  return { id: 42, email: "ada@example.com" } as unknown as Parameters<typeof jobMonitorExecutor>[1];
}

function makeSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    roleTitle:  "Senior Developer",
    count:      120,
    geography:  "Milano",
    topSkills:  ["TypeScript", "React", "Node.js", "PostgreSQL"],
    growthRate: 0.15,
    period:     "2026-05",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("jobMonitorExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRows.rows = [];
    queryRows.throws = null;
  });

  it("returns a valid RoutineResult with title, body, cta when matches found", async () => {
    queryRows.rows = [makeSnapshot(), makeSnapshot({ roleTitle: "Backend Developer", count: 80 })];

    const result = await jobMonitorExecutor(makeRoutine({ role: "developer", city: "Milano" }), makeUser());

    expect(result.title).toMatch(/offerte/i);
    expect(result.body).toBeTruthy();
    expect(result.body.length).toBeGreaterThan(0);
    expect(result.ctaTarget).toBe("/jobs");
    expect(result.metadata).toMatchObject({
      role: "developer",
      city: "Milano",
      jobCount: 2,
    });
  });

  it("handles empty result set without crashing", async () => {
    queryRows.rows = [];

    const result = await jobMonitorExecutor(makeRoutine({ role: "rust developer", city: "Foo" }), makeUser());

    expect(result.title).toMatch(/nessuna offerta/i);
    expect(result.body).toContain("rust developer");
    expect(result.ctaTarget).toBe("/jobs");
    expect(result.metadata).toMatchObject({ jobCount: 0 });
  });

  it("handles DB errors gracefully — returns fallback result, does not throw", async () => {
    queryRows.throws = new Error("DB connection lost");

    const result = await jobMonitorExecutor(makeRoutine({ role: "developer" }), makeUser());

    expect(result.title).toMatch(/monitoraggio offerte/i);
    expect(result.body).toMatch(/non è stato possibile/i);
    expect(result.metadata).toMatchObject({ jobCount: 0 });
    expect(result.metadata).toHaveProperty("error");
  });

  it("uses default role 'developer' when parameters.role is missing", async () => {
    queryRows.rows = [];

    const result = await jobMonitorExecutor(makeRoutine({}), makeUser());

    expect(result.body).toContain("developer");
  });

  it("does not add city to title/body when parameters.city is absent", async () => {
    queryRows.rows = [];

    const result = await jobMonitorExecutor(makeRoutine({ role: "designer" }), makeUser());

    expect(result.title).not.toMatch(/ a /);
    expect(result.body).toContain("designer");
  });

  it("formats skills (top 3) and growth trend in body when matches exist", async () => {
    queryRows.rows = [makeSnapshot({
      roleTitle:  "Data Scientist",
      topSkills:  ["Python", "SQL", "ML", "Stats"],
      growthRate: 0.25,
    })];

    const result = await jobMonitorExecutor(makeRoutine({ role: "data" }), makeUser());

    expect(result.body).toContain("Data Scientist");
    expect(result.body).toContain("Python");
    expect(result.body).toContain("SQL");
    expect(result.body).toContain("ML");
    expect(result.body).toContain("+25%");
  });
});
