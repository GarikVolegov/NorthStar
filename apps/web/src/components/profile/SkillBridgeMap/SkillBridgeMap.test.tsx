import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillBridgeMap } from "./SkillBridgeMap";

const getJson = vi.hoisted(() => vi.fn());
const askWendy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson,
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => ({ ask: askWendy }),
}));

vi.mock("reactflow", async () => {
  const React = await import("react");
  return {
    Background: () => null,
    BaseEdge: () => null,
    Controls: () => null,
    Handle: () => null,
    Position: { Left: "left", Right: "right" },
    getBezierPath: () => [""],
    ReactFlow: ({ nodes, edges, onNodeClick, children }: {
      nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>;
      edges: unknown[];
      onNodeClick?: (event: unknown, node: { id: string; type?: string; data: Record<string, unknown> }) => void;
      children?: React.ReactNode;
    }) => (
      <div data-testid="bridge-canvas" data-edge-count={edges.length}>
        {nodes.map((node) => {
          if (node.type === "profession") {
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onNodeClick?.({}, node)}
              >
                {String(node.data.title)}
              </button>
            );
          }
          return <div key={node.id}>{node.data.label as React.ReactNode}</div>;
        })}
        {children}
      </div>
    ),
  };
});

describe("SkillBridgeMap", () => {
  beforeEach(() => {
    getJson.mockReset();
    askWendy.mockReset();
    getJson.mockResolvedValue(response());
  });

  it("renders the skill constellation from the endpoint", async () => {
    render(<SkillBridgeMap lens="dipendente" />);

    expect(await screen.findByText("Skill Bridge Map")).toBeInTheDocument();
    expect(screen.getByText("Aumenti possibili e tempo di transizione")).toBeInTheDocument();
    expect(screen.getAllByText("Data Analyst").length).toBeGreaterThan(0);
    expect(screen.getByTestId("bridge-canvas")).toHaveAttribute("data-edge-count", "2");
    expect(getJson).toHaveBeenCalledWith("/api/user/skill-bridge", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("opens the side panel and sends Wendy a contextual prompt", async () => {
    render(<SkillBridgeMap lens="dipendente" />);

    fireEvent.click(await screen.findByRole("button", { name: "Product Manager" }));

    expect(screen.getByText("Stakeholder management")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /chiedi a wendy/i }));

    expect(askWendy).toHaveBeenCalledWith(expect.stringContaining("Product Manager"));
    expect(askWendy).toHaveBeenCalledWith(expect.stringContaining("Stakeholder management"));
  });

  it("applies filters to the endpoint query", async () => {
    render(<SkillBridgeMap lens="autonomo" />);

    await screen.findByText("Ruoli freelance o remote in evidenza");
    await waitFor(() => expect(getJson).toHaveBeenCalledWith("/api/user/skill-bridge?workMode=remote", expect.any(Object)));

    fireEvent.change(screen.getByPlaceholderText("30000"), { target: { value: "35000" } });

    await waitFor(() => {
      expect(getJson).toHaveBeenLastCalledWith(
        "/api/user/skill-bridge?minSalary=35000&workMode=remote",
        expect.any(Object),
      );
    });
  });
});

function response() {
  return {
    center: { userId: 1, skills: ["SQL", "React", "Storytelling"] },
    professions: [
      {
        id: 1,
        title: "Data Analyst",
        sector: "Tecnologia",
        salaryRange: "28.000 - 40.000 EUR",
        workModes: ["remote"],
        overlapSkills: ["SQL"],
        missingSkills: ["Statistics", "Dashboard"],
        ring: 1,
        overlapPercent: 67,
        learnTimeWeeks: 8,
      },
      {
        id: 2,
        title: "Product Manager",
        sector: "Prodotto",
        salaryRange: "35.000 - 55.000 EUR",
        workModes: ["team"],
        overlapSkills: ["Storytelling"],
        missingSkills: ["Stakeholder management", "Roadmap", "Analytics"],
        ring: 2,
        overlapPercent: 25,
        learnTimeWeeks: 12,
      },
    ],
    filtersApplied: {},
  };
}
