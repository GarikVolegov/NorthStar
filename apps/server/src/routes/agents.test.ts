import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const executeAgentTaskMock = vi.hoisted(() => vi.fn(async () => undefined));
const appendOperatorEventMock = vi.hoisted(() => vi.fn(async () => ({ id: 9001 })));
const getSnapshotMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  execute: vi.fn(async () => undefined),
  transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(dbMock)),
}));

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("../lib/agent-registry", () => ({
  agentRegistry: {
    getSnapshot: getSnapshotMock,
  },
}));

vi.mock("../services/agents/agent-task-notifications", () => ({
  notifyAgentTaskFinished: vi.fn(async () => undefined),
}));

vi.mock("@workspace/ai-server", () => ({
  appendOperatorEvent: appendOperatorEventMock,
  executeAgentTask: executeAgentTaskMock,
}));

vi.mock("@workspace/db", () => ({
  db: dbMock,
  usersTable: { clerkId: "users.clerk_id" },
  agentEmployeesTable: {
    slug: "agent_employees.slug",
    isActive: "agent_employees.is_active",
    sortOrder: "agent_employees.sort_order",
    id: "agent_employees.id",
    name: "agent_employees.name",
    role: "agent_employees.role",
    domain: "agent_employees.domain",
    avatar: "agent_employees.avatar",
    color: "agent_employees.color",
    description: "agent_employees.description",
    capabilities: "agent_employees.capabilities",
  },
  agentTasksTable: {
    id: "agent_tasks.id",
    userId: "agent_tasks.user_id",
    agentSlug: "agent_tasks.agent_slug",
    title: "agent_tasks.title",
    prompt: "agent_tasks.prompt",
    status: "agent_tasks.status",
    queuedAt: "agent_tasks.queued_at",
    completedAt: "agent_tasks.completed_at",
    durationMs: "agent_tasks.duration_ms",
    errorMessage: "agent_tasks.error_message",
    contextType: "agent_tasks.context_type",
    contextId: "agent_tasks.context_id",
    contextData: "agent_tasks.context_data",
    updatedAt: "agent_tasks.updated_at",
  },
}));

import agentsRouter from "./agents";

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

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/agents", agentsRouter);
  return instance;
}

describe("agents routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    dbMock.insert.mockReset();
    dbMock.update.mockReset();
    getSnapshotMock.mockResolvedValue({
      generatedAt: "2026-05-30T10:00:00.000Z",
      aggregates: { online: 2, executing: 1, tokensTotalToday: 123 },
      agents: [{ slug: "wendy", status: "idle" }],
    });
  });

  it("returns operator status for authenticated users", async () => {
    const response = await request(app())
      .get("/api/agents/operator/status")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      health: "ok",
      snapshot: {
        aggregates: { online: 2, executing: 1, tokensTotalToday: 123 },
      },
    });
    expect(getSnapshotMock).toHaveBeenCalled();
  });

  it("creates an agent task and returns orchestration metadata", async () => {
    mockSelectOnce([{ slug: "marco-career" }]);
    mockSelectOnce([{ value: 0 }]);
    mockInsertReturning([{ id: 123 }]);

    const response = await request(app())
      .post("/api/agents/tasks")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        agentSlug: "marco-career",
        title: "Analizza percorso",
        prompt: "Analizza il mio percorso e prepara un report operativo.",
        contextData: { origin: "test" },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      ok: true,
      taskId: 123,
      orchestrationEventId: 9001,
      executionMode: "background",
    });
    expect(appendOperatorEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        source: "agent_route",
        triggerType: "agent_task_created",
        decision: "agent_task",
        targetType: "agent_task",
        targetId: "123",
        status: "dispatched",
      }),
    );
    expect(executeAgentTaskMock).toHaveBeenCalledWith(123, expect.objectContaining({ source: "agent_route" }));
  });

  it("refuses new tasks when queued plus running tasks reach the limit", async () => {
    mockSelectOnce([{ slug: "marco-career" }]);
    mockSelectOnce([{ value: 5 }]);

    const response = await request(app())
      .post("/api/agents/tasks")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        agentSlug: "marco-career",
        title: "Analizza percorso",
        prompt: "Analizza il mio percorso e prepara un report operativo.",
      })
      .expect(429);

    expect(response.body.error).toContain("limite");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

function mockSelectOnce(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  dbMock.select.mockReturnValueOnce(chain);
}

function mockInsertReturning(rows: unknown[]) {
  const chain = {
    values: vi.fn(() => chain),
    returning: vi.fn(async () => rows),
  };
  dbMock.insert.mockReturnValueOnce(chain);
}
