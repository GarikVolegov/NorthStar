import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activationsRows = vi.hoisted(() => ({ value: [] as Array<Record<string, unknown>> }));
const edgesRows = vi.hoisted(() => ({ value: [] as Array<Record<string, unknown>> }));
const updateWhere = vi.hoisted(() => vi.fn(async () => undefined));
const updateSet = vi.hoisted(() => vi.fn(() => ({ where: updateWhere })));
const updateMock = vi.hoisted(() => vi.fn(() => ({ set: updateSet })));

const tables = vi.hoisted(() => ({
  activations: {
    requestId: "request_id",
    createdAt: "created_at",
    score: "score",
  },
  edges: {
    id: "id",
    status: "status",
    weight: "weight",
    lastReinforcedAt: "last_reinforced_at",
    updatedAt: "updated_at",
  },
}));

const selectMock = vi.hoisted(() => vi.fn(() => ({
  from: vi.fn((table: unknown) => ({
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(async () => table === tables.edges ? edgesRows.value : activationsRows.value),
      })),
      limit: vi.fn(async () => table === tables.edges ? edgesRows.value : activationsRows.value),
    })),
    orderBy: vi.fn(() => ({
      limit: vi.fn(async () => table === tables.edges ? edgesRows.value : activationsRows.value),
    })),
    limit: vi.fn(async () => table === tables.edges ? edgesRows.value : activationsRows.value),
  })),
})));

vi.mock("@workspace/db", () => ({
  db: {
    select: selectMock,
    update: updateMock,
  },
  wendyBrainNodesTable: "wendy_brain_nodes",
  wendyNeuralActivationsTable: tables.activations,
  wendyNeuralEdgesTable: tables.edges,
}));

vi.mock("@workspace/ai-server", () => ({
  promoteWendyBrainCandidate: vi.fn(async () => undefined),
  searchWendyBrain: vi.fn(async () => []),
}));

vi.mock("../../lib/graphify-client", () => ({
  getGraphifyStatus: vi.fn(async () => ({ enabled: true })),
}));

import router from "./wendy-brain";

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use((req, _res, next) => {
    (req as typeof req & { user: NonNullable<typeof req.user> }).user = {
      id: 7,
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      stripeSubscriptionId: null,
      journeyType: null,
      testSessionId: null,
      onboardingCompleted: true,
    };
    next();
  });
  testApp.use("/api/admin", router);
  return testApp;
}

describe("admin Wendy Brain neural endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activationsRows.value = [];
    edgesRows.value = [];
  });

  it("returns recent neural activation traces", async () => {
    activationsRows.value = [
      {
        requestId: "req-1",
        itemKind: "brain_note",
        itemRef: ".brain/20_Product/Subsystems/RAG-Pipeline.md",
        label: "RAG Pipeline",
        score: 0.91,
        selected: true,
      },
    ];

    const response = await request(app()).get("/api/admin/wendy-brain/neural/recent").expect(200);

    expect((response.body as { activations: unknown[] }).activations).toEqual(activationsRows.value);
  });

  it("returns candidate neural edges and supports review actions", async () => {
    edgesRows.value = [
      {
        id: 11,
        sourceItemKind: "brain_note",
        sourceItemRef: "brain:rag",
        targetItemKind: "tool",
        targetItemRef: "tool:search_brain",
        status: "candidate",
      },
    ];

    const response = await request(app()).get("/api/admin/wendy-brain/neural/edges?status=candidate").expect(200);
    expect((response.body as { edges: unknown[] }).edges).toEqual(edgesRows.value);

    await request(app()).post("/api/admin/wendy-brain/neural/edges/11/approve").expect(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));

    await request(app()).post("/api/admin/wendy-brain/neural/edges/11/reject").expect(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "archived" }));
  });
});
