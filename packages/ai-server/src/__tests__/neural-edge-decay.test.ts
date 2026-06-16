import { beforeEach, describe, expect, it, vi } from "vitest";

const selectRows = vi.hoisted(() => [
  {
    id: 1,
    weight: 0.4,
    lastReinforcedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    status: "candidate",
  },
  {
    id: 2,
    weight: 0.9,
    lastReinforcedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "candidate",
  },
]);

const updateWhere = vi.hoisted(() => vi.fn(async () => undefined));
const updateSet = vi.hoisted(() => vi.fn(() => ({ where: updateWhere })));
const updateMock = vi.hoisted(() => vi.fn(() => ({ set: updateSet })));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => selectRows) })) })),
    update: updateMock,
  },
  wendyNeuralEdgesTable: {
    id: "id",
    weight: "weight",
    lastReinforcedAt: "last_reinforced_at",
    status: "status",
  },
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyNeuralEdgeDecay } from "../index";

describe("applyNeuralEdgeDecay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WENDY_NEURAL_EDGE_DECAY_DAYS = "7";
    process.env.WENDY_NEURAL_MIN_EDGE_WEIGHT = "0.5";
  });

  it("archives stale weak edges and returns the decay summary", async () => {
    const result = await applyNeuralEdgeDecay();

    expect(result.archivedBefore).toBe(1);
    expect(result.updated).toBe(1);
    expect(updateMock).toHaveBeenCalled();
  });
});
