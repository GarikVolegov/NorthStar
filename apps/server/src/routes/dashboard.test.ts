import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.hoisted(() => vi.fn());
const getEffectivePlanMock = vi.hoisted(() => vi.fn());
const planMeetsMock = vi.hoisted(() => vi.fn());

function queryChain() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: limitMock,
        })),
      })),
    })),
  };
}

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("../middleware/check-feature", () => ({
  getEffectivePlan: getEffectivePlanMock,
  planMeets: planMeetsMock,
}));

vi.mock("@workspace/db", () => ({
  calendarEventsTable: {
    id: "calendar.id",
    title: "calendar.title",
    category: "calendar.category",
    startAt: "calendar.start_at",
    endAt: "calendar.end_at",
    priority: "calendar.priority",
    userId: "calendar.user_id",
  },
  db: {
    select: vi.fn(() => queryChain()),
  },
  testSessionsTable: {
    id: "test_sessions.id",
    userId: "test_sessions.user_id",
    riasecScores: "test_sessions.riasec_scores",
    primaryTypes: "test_sessions.primary_types",
    spiritScores: "test_sessions.spirit_scores",
    recommendations: "test_sessions.recommendations",
    createdAt: "test_sessions.created_at",
  },
  userObjectivesTable: {
    id: "objectives.id",
    userId: "objectives.user_id",
    text: "objectives.text",
    category: "objectives.category",
    progress: "objectives.progress",
    completed: "objectives.completed",
    completedAt: "objectives.completed_at",
    dueDate: "objectives.due_date",
    createdAt: "objectives.created_at",
  },
}));

import dashboardRouter from "./dashboard";

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "dipendente",
      journeyDecidedAt: "2026-06-01T10:00:00.000Z",
      journeyDecisionSource: "percorso_page",
      stripeSubscriptionId: null,
      testSessionId: 7,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/dashboard", dashboardRouter);
  return instance;
}

describe("dashboard decision state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEffectivePlanMock.mockResolvedValue("free");
    planMeetsMock.mockReturnValue(false);
    limitMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  it("returns persisted journey decision metadata in the dashboard user payload", async () => {
    const response = await request(app())
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.user).toMatchObject({
      journeyType: "dipendente",
      journeyDecidedAt: "2026-06-01T10:00:00.000Z",
      journeyDecisionSource: "percorso_page",
    });
  });
});
