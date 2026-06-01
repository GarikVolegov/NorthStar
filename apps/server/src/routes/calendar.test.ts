import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: undefined as undefined | ReturnType<typeof vi.fn>,
  insert: undefined as undefined | ReturnType<typeof vi.fn>,
  update: undefined as undefined | ReturnType<typeof vi.fn>,
  delete: undefined as undefined | ReturnType<typeof vi.fn>,
}));

type TestCondition =
  | { op: "and"; conditions: TestCondition[] }
  | { op: "eq" | "gte" | "lte" | "asc"; column: unknown; value?: unknown }
  | { op: "sql"; strings: string[]; values: unknown[] };

vi.mock("drizzle-orm", () => ({
  and: (...conditions: TestCondition[]) => ({ op: "and", conditions }),
  asc: (column: unknown) => ({ op: "asc", column }),
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  gte: (column: unknown, value: unknown) => ({ op: "gte", column, value }),
  lte: (column: unknown, value: unknown) => ({ op: "lte", column, value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings: Array.from(strings),
    values,
  }),
}));

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: dbMock,
  usersTable: { clerkId: "users.clerk_id" },
  calendarEventsTable: {
    id: "calendar_events.id",
    userId: "calendar_events.user_id",
    title: "calendar_events.title",
    description: "calendar_events.description",
    startAt: "calendar_events.start_at",
    endAt: "calendar_events.end_at",
    allDay: "calendar_events.all_day",
    category: "calendar_events.category",
    priority: "calendar_events.priority",
    status: "calendar_events.status",
    color: "calendar_events.color",
    tags: "calendar_events.tags",
    linkedSectorId: "calendar_events.linked_sector_id",
    linkedGoal: "calendar_events.linked_goal",
    linkedContentIds: "calendar_events.linked_content_ids",
    isRecurring: "calendar_events.is_recurring",
    recurrenceRule: "calendar_events.recurrence_rule",
  },
}));

import calendarRouter from "./calendar";

function token(overrides: { stripeSubscriptionId?: string | null } = {}) {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: overrides.stripeSubscriptionId ?? null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/calendar", calendarRouter);
  return instance;
}

function hasCondition(condition: TestCondition, op: string, column: unknown): boolean {
  if (condition.op === op && "column" in condition && condition.column === column) {
    return true;
  }
  return condition.op === "and" && condition.conditions.some((child: TestCondition) => hasCondition(child, op, column));
}

describe("calendar quota route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select = undefined;
    dbMock.insert = undefined;
    dbMock.update = undefined;
    dbMock.delete = undefined;
  });

  it("requires authentication", async () => {
    await request(app()).get("/api/calendar/quota").expect(401);
  });

  it("returns free plan quota usage compatible with the calendar UI", async () => {
    const response = await request(app())
      .get("/api/calendar/quota")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      isPremium: false,
      eventCount: 0,
      eventLimit: expect.any(Number),
    });
    expect(response.body.eventLimit).toBeGreaterThan(0);
  });

  it("returns unlimited quota for users with a subscription marker", async () => {
    const response = await request(app())
      .get("/api/calendar/quota")
      .set("Authorization", `Bearer ${token({ stripeSubscriptionId: "sub_123" })}`)
      .expect(200);

    expect(response.body).toEqual({
      isPremium: true,
      eventCount: 0,
      eventLimit: null,
    });
  });
});

describe("calendar events route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select = undefined;
    dbMock.insert = undefined;
    dbMock.update = undefined;
    dbMock.delete = undefined;
  });

  it("queries events that overlap the requested visible range", async () => {
    const where = vi.fn((_condition: TestCondition) => ({
      orderBy: vi.fn().mockResolvedValue([
        {
          id: 12,
          title: "Sprint portfolio",
          description: null,
          startAt: new Date("2026-05-31T09:00:00.000Z"),
          endAt: new Date("2026-06-02T17:00:00.000Z"),
          allDay: false,
          category: "task",
          priority: "medium",
          status: "todo",
          color: null,
          tags: [],
          linkedSectorId: null,
          linkedGoal: null,
          linkedContentIds: [],
          isRecurring: false,
          recurrenceRule: null,
        },
      ]),
    }));
    dbMock.select = vi.fn(() => ({
      from: vi.fn(() => ({ where })),
    }));

    const response = await request(app())
      .get("/api/calendar/events?from=2026-06-01T00:00:00.000Z&to=2026-06-07T23:59:59.999Z")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.events).toHaveLength(1);
    const condition = where.mock.calls[0]?.[0] as TestCondition;
    expect(hasCondition(condition, "lte", "calendar_events.start_at")).toBe(true);
    expect(hasCondition(condition, "gte", "calendar_events.end_at")).toBe(true);
  });
});

describe("calendar persistence-sensitive writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select = undefined;
    dbMock.insert = undefined;
    dbMock.update = undefined;
    dbMock.delete = undefined;
  });

  it("returns an actionable 503 when event creation cannot reach persistence", async () => {
    const returning = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("relation does not exist"), { code: "42P01" }));
    dbMock.insert = vi.fn(() => ({
      values: vi.fn(() => ({ returning })),
    }));

    const response = await request(app())
      .post("/api/calendar/events")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        title: "Revisione CV",
        startAt: "2026-06-05T09:00:00.000Z",
        endAt: "2026-06-05T10:00:00.000Z",
      })
      .expect(503);

    expect(response.body).toMatchObject({
      status: "error",
      code: "CALENDAR_PERSISTENCE_UNAVAILABLE",
      action: "retry_after_persistence_restored",
      persistenceUnavailable: true,
    });
  });

  it("does not report delete success when the event is missing", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    dbMock.delete = vi.fn(() => ({
      where: vi.fn(() => ({ returning })),
    }));

    const response = await request(app())
      .delete("/api/calendar/events/999")
      .set("Authorization", `Bearer ${token()}`)
      .expect(404);

    expect(response.body).toMatchObject({
      code: "CALENDAR_EVENT_NOT_FOUND",
      action: "refresh_calendar",
    });
  });
});
