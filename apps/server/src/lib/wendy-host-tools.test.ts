import { beforeEach, describe, expect, it, vi } from "vitest";

const searchGraphifyMock = vi.hoisted(() => vi.fn());
const explainGraphifyNodeMock = vi.hoisted(() => vi.fn());

vi.mock("./graphify-client", () => ({
  isGraphifyEnabled: () => true,
  searchGraphify: searchGraphifyMock,
  explainGraphifyNode: explainGraphifyNodeMock,
}));

vi.mock("./openhuman-client", () => ({
  isOpenHumanEnabled: () => false,
  searchOpenHumanMemory: vi.fn(),
}));

vi.mock("./semantic-memory", () => ({
  recallSemanticMemory: vi.fn(async () => ({ available: false, memories: [] })),
}));

import { executeHostTool, isHostTool } from "./wendy-host-tools";

describe("wendy-host-tools code graph capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes search_code_graph as an internal Graphify capability", async () => {
    searchGraphifyMock.mockResolvedValue([
      {
        id: "ai-growth-agent",
        graph: "root",
        label: "growth-agent",
        kind: "typescript",
        sourceFile: "packages/ai-server/src/growth-agent/agent.ts",
        sourceLocation: "packages/ai-server/src/growth-agent/agent.ts:1",
        score: 3,
        neighbors: [],
      },
    ]);

    expect(isHostTool("search_code_graph")).toBe(true);

    const result = await executeHostTool("search_code_graph", { query: "Wendy logic", limit: 3 }, 7);

    expect(searchGraphifyMock).toHaveBeenCalledWith("Wendy logic", 3);
    expect(result).toMatchObject({
      ok: true,
      data: {
        available: true,
        source: "graphify",
        count: 1,
      },
    });
  });

  it("exposes explain_code_node as a node explanation capability", async () => {
    explainGraphifyNodeMock.mockResolvedValue({
      id: "ai-growth-agent",
      graph: "root",
      label: "growth-agent",
      kind: "typescript",
      sourceFile: "packages/ai-server/src/growth-agent/agent.ts",
      sourceLocation: "packages/ai-server/src/growth-agent/agent.ts:1",
      score: 1,
      neighbors: [{ id: "ai-router-agent", label: "router-agent", relation: "USES" }],
    });

    expect(isHostTool("explain_code_node")).toBe(true);

    const result = await executeHostTool("explain_code_node", { graph: "root", id: "ai-growth-agent" }, 7);

    expect(explainGraphifyNodeMock).toHaveBeenCalledWith("root", "ai-growth-agent");
    expect(result).toMatchObject({
      ok: true,
      data: {
        available: true,
        source: "graphify",
        result: {
          id: "ai-growth-agent",
          label: "growth-agent",
        },
      },
    });
  });
});
