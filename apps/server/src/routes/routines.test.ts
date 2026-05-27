/**
 * routines.test.ts — unit tests for /api/routines routes.
 *
 * Tests feature gates, CRUD operations, and feed endpoints.
 * Uses vi.mock to isolate DB and plan checks.
 */
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mutable state ────────────────────────────────────────────────────

const selectRows   = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const insertRows   = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const updateRows   = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const deleteResult = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const activeCount  = vi.hoisted(() => ({ value: 0 }));
const effectivePlan = vi.hoisted(() => ({ value: "free" as "free" | "pro" | "team" }));

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../lib/jwt-secret", () => ({ JWT_SECRET: "test-secret" }));

vi.mock("../middleware/check-feature", () => ({
  getEffectivePlan: vi.fn(async () => effectivePlan.value),
}));

vi.mock("../lib/routine-schedule", () => ({
  computeNextRun:   vi.fn(() => new Date("2026-06-05T09:00:00.000Z")),
  scheduleToDisplay: vi.fn((s: string) => s === "every_thursday" ? "Ogni giovedì" : s),
}));

vi.mock("@workspace/db", () => {
  const userRoutinesTable = {
    id:            "user_routines.id",
    userId:        "user_routines.user_id",
    type:          "user_routines.type",
    name:          "user_routines.name",
    schedule:      "user_routines.schedule",
    parameters:    "user_routines.parameters",
    outputChannel: "user_routines.output_channel",
    active:        "user_routines.active",
    lastRunAt:     "user_routines.last_run_at",
    nextRunAt:     "user_routines.next_run_at",
    createdAt:     "user_routines.created_at",
    updatedAt:     "user_routines.updated_at",
  };

  const routineExecutionsTable = {
    id:        "routine_executions.id",
    routineId: "routine_executions.routine_id",
    userId:    "routine_executions.user_id",
    title:     "routine_executions.title",
    body:      "routine_executions.body",
    ctaLabel:  "routine_executions.cta_label",
    ctaTarget: "routine_executions.cta_target",
    metadata:  "routine_executions.metadata",
    readAt:    "routine_executions.read_at",
    createdAt: "routine_executions.created_at",
  };

  const usersTable = { clerkId: "users.clerk_id" };

  /**
   * A thenable chain: every chained method returns `chain` itself.
   * Awaiting the chain at any point resolves to `rows`.
   * This handles both:
   *   - await db.select().from().where().orderBy()        (no .limit)
   *   - await db.select().from().where().orderBy().limit() (with .limit)
   */
  function selectChain(rows: Array<Record<string, unknown>>) {
    type Chain = {
      from: ReturnType<typeof vi.fn>;
      where: ReturnType<typeof vi.fn>;
      orderBy: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise<unknown>;
    };
    const chain: Chain = {
      from:    vi.fn(() => chain),
      where:   vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit:   vi.fn(() => Promise.resolve(rows)),
      // Makes `await chain` resolve to rows without .limit()
      then:    (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
    };
    return chain;
  }

  return {
    userRoutinesTable,
    routineExecutionsTable,
    usersTable,
    ROUTINE_TYPES:           ["job_monitor", "market_report", "mindset_exercise", "growth_briefing", "interview_prep"],
    ROUTINE_OUTPUT_CHANNELS: ["email", "in_app", "wendy_context", "all"],
    db: {
      select: vi.fn((fields?: unknown) => {
        // Count queries use { activeCount: count() } — resolve to count row
        const isCount = fields != null &&
          typeof fields === "object" &&
          "activeCount" in (fields as object);
        const rows = isCount ? [{ activeCount: activeCount.value }] : selectRows.rows;
        return selectChain(rows);
      }),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => insertRows.rows),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => updateRows.rows),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => deleteResult.rows),
        })),
      })),
    },
  };
});

import routinesRouter from "./routines";

// ── Helpers ───────────────────────────────────────────────────────────────────

function token(userId = 42) {
  return jwt.sign(
    {
      userId,
      name:                "Ada",
      email:               "ada@example.com",
      role:                "user",
      onboardingCompleted: true,
      journeyType:         "autonomo",
      stripeSubscriptionId: null,
      testSessionId:       null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/routines", routinesRouter);
  return instance;
}

function makeRoutine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id:            1,
    userId:        42,
    type:          "job_monitor",
    name:          "Monitoraggio Offerte Lavoro",
    schedule:      "every_thursday",
    parameters:    { role: "developer", city: "Milano" },
    outputChannel: "email",
    active:        true,
    lastRunAt:     null,
    nextRunAt:     "2026-06-05T09:00:00.000Z",
    createdAt:     new Date("2026-05-28T10:00:00.000Z"),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/routines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.rows   = [];
    insertRows.rows   = [];
    updateRows.rows   = [];
    deleteResult.rows = [];
    activeCount.value = 0;
    effectivePlan.value = "free";
  });

  it("requires auth — 401 without token", async () => {
    await request(app()).get("/api/routines").expect(401);
  });

  it("returns empty list with free plan meta", async () => {
    selectRows.rows     = [];
    effectivePlan.value = "free";

    const res = await request(app())
      .get("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.routines).toEqual([]);
    expect(res.body.meta).toMatchObject({
      total:       0,
      activeCount: 0,
      plan:        "free",
      limit:       1,
      canCreate:   true,
    });
  });

  it("includes scheduleDisplay in each routine", async () => {
    selectRows.rows     = [makeRoutine()];
    effectivePlan.value = "free";

    const res = await request(app())
      .get("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.routines[0]).toMatchObject({
      id:              1,
      scheduleDisplay: "Ogni giovedì",
    });
  });

  it("canCreate is false when at free plan limit", async () => {
    selectRows.rows     = [makeRoutine({ active: true })];
    effectivePlan.value = "free";

    const res = await request(app())
      .get("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.meta.canCreate).toBe(false);
    expect(res.body.meta.limit).toBe(1);
    expect(res.body.meta.activeCount).toBe(1);
  });

  it("pro plan limit is 5", async () => {
    selectRows.rows     = [makeRoutine({ active: true })];
    effectivePlan.value = "pro";

    const res = await request(app())
      .get("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.meta.limit).toBe(5);
    expect(res.body.meta.canCreate).toBe(true);
  });
});

describe("POST /api/routines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.rows   = [];
    insertRows.rows   = [];
    activeCount.value = 0;
    effectivePlan.value = "free";
  });

  it("requires auth — 401 without token", async () => {
    await request(app())
      .post("/api/routines")
      .send({ type: "job_monitor", schedule: "every_thursday" })
      .expect(401);
  });

  it("creates a routine for free plan when under limit", async () => {
    activeCount.value   = 0;   // 0 active → can create 1
    effectivePlan.value = "free";
    insertRows.rows     = [makeRoutine()];

    const res = await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "job_monitor", schedule: "every_thursday" })
      .expect(201);

    expect(res.body.routine).toMatchObject({
      id:   1,
      type: "job_monitor",
    });
  });

  it("returns 403 ROUTINE_LIMIT_REACHED for free plan at limit", async () => {
    activeCount.value   = 1;   // already has 1 active
    effectivePlan.value = "free";

    const res = await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "job_monitor", schedule: "every_thursday" })
      .expect(403);

    expect(res.body.code).toBe("ROUTINE_LIMIT_REACHED");
    expect(res.body.plan).toBe("free");
    expect(res.body.limit).toBe(1);
    expect(res.body.upgrade).toBe("pro");
  });

  it("allows pro plan up to 5 routines", async () => {
    activeCount.value   = 4;   // 4 active → can add 5th
    effectivePlan.value = "pro";
    insertRows.rows     = [makeRoutine()];

    await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "market_report", schedule: "weekly" })
      .expect(201);
  });

  it("returns 403 when pro plan is at limit of 5", async () => {
    activeCount.value   = 5;
    effectivePlan.value = "pro";

    const res = await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "market_report", schedule: "weekly" })
      .expect(403);

    expect(res.body.code).toBe("ROUTINE_LIMIT_REACHED");
    expect(res.body.limit).toBe(5);
    expect(res.body.upgrade).toBe("team");
  });

  it("team plan is unlimited (no 403)", async () => {
    activeCount.value   = 100;
    effectivePlan.value = "team";
    insertRows.rows     = [makeRoutine()];

    await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "growth_briefing", schedule: "daily" })
      .expect(201);
  });

  it("returns 400 for missing type", async () => {
    const res = await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ schedule: "every_thursday" })
      .expect(400);

    expect(res.body.error).toMatch(/type/i);
  });

  it("returns 400 for invalid type", async () => {
    const res = await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "bogus_type", schedule: "every_thursday" })
      .expect(400);

    expect(res.body.error).toMatch(/type/i);
  });

  it("returns 400 for missing schedule", async () => {
    const res = await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "job_monitor" })
      .expect(400);

    expect(res.body.error).toMatch(/schedule/i);
  });

  it("uses name default when name not provided", async () => {
    activeCount.value   = 0;
    effectivePlan.value = "free";
    insertRows.rows     = [makeRoutine({ name: "Monitoraggio Offerte Lavoro" })];

    const res = await request(app())
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({ type: "job_monitor", schedule: "every_thursday" })
      .expect(201);

    expect(res.body.routine.name).toBe("Monitoraggio Offerte Lavoro");
  });
});

describe("PATCH /api/routines/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.rows   = [];
    updateRows.rows   = [];
    activeCount.value = 0;
    effectivePlan.value = "free";
  });

  it("requires auth — 401 without token", async () => {
    await request(app())
      .patch("/api/routines/1")
      .send({ active: false })
      .expect(401);
  });

  it("returns 400 for non-numeric id", async () => {
    await request(app())
      .patch("/api/routines/abc")
      .set("Authorization", `Bearer ${token()}`)
      .send({ active: false })
      .expect(400);
  });

  it("returns 404 when routine not found or not owned", async () => {
    selectRows.rows = [];   // no existing routine

    const res = await request(app())
      .patch("/api/routines/99")
      .set("Authorization", `Bearer ${token()}`)
      .send({ active: false })
      .expect(404);

    expect(res.body.error).toMatch(/non trovata/i);
  });

  it("toggles active to false without limit check", async () => {
    selectRows.rows = [{ id: 1, active: true }];
    updateRows.rows = [makeRoutine({ active: false })];

    const res = await request(app())
      .patch("/api/routines/1")
      .set("Authorization", `Bearer ${token()}`)
      .send({ active: false })
      .expect(200);

    expect(res.body.routine).toBeDefined();
  });

  it("blocks re-activation when at free plan limit", async () => {
    // Existing routine is inactive; trying to activate it
    selectRows.rows     = [{ id: 1, active: false }];
    activeCount.value   = 1;   // 1 already active
    effectivePlan.value = "free";

    const res = await request(app())
      .patch("/api/routines/1")
      .set("Authorization", `Bearer ${token()}`)
      .send({ active: true })
      .expect(403);

    expect(res.body.code).toBe("ROUTINE_LIMIT_REACHED");
  });
});

describe("DELETE /api/routines/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteResult.rows = [];
  });

  it("requires auth — 401 without token", async () => {
    await request(app()).delete("/api/routines/1").expect(401);
  });

  it("returns 400 for non-numeric id", async () => {
    await request(app())
      .delete("/api/routines/abc")
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);
  });

  it("returns 404 when routine not found", async () => {
    deleteResult.rows = [];

    await request(app())
      .delete("/api/routines/99")
      .set("Authorization", `Bearer ${token()}`)
      .expect(404);
  });

  it("deletes routine and returns ok", async () => {
    deleteResult.rows = [{ id: 1 }];

    const res = await request(app())
      .delete("/api/routines/1")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
  });
});

describe("GET /api/routines/feed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.rows   = [];
    effectivePlan.value = "free";
  });

  it("requires auth — 401 without token", async () => {
    await request(app()).get("/api/routines/feed").expect(401);
  });

  it("returns empty feed with unreadCount 0", async () => {
    selectRows.rows = [];

    const res = await request(app())
      .get("/api/routines/feed")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body).toMatchObject({ executions: [], unreadCount: 0, total: 0 });
  });

  it("counts unread executions (readAt === null)", async () => {
    selectRows.rows = [
      { id: 1, title: "Offerte trovate", readAt: null,          createdAt: new Date() },
      { id: 2, title: "Report mercato",  readAt: new Date(),    createdAt: new Date() },
      { id: 3, title: "Esercizio",       readAt: null,          createdAt: new Date() },
    ];

    const res = await request(app())
      .get("/api/routines/feed")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.unreadCount).toBe(2);
  });
});

describe("PATCH /api/routines/feed/:id/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateRows.rows = [];
  });

  it("requires auth — 401 without token", async () => {
    await request(app()).patch("/api/routines/feed/1/read").expect(401);
  });

  it("returns 400 for non-numeric id", async () => {
    await request(app())
      .patch("/api/routines/feed/abc/read")
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);
  });

  it("marks execution as read and returns ok", async () => {
    const res = await request(app())
      .patch("/api/routines/feed/5/read")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
  });
});
