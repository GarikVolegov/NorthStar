import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPersonalIntelligenceContext } from "./personal-intelligence-context";

const openHumanMock = vi.hoisted(() => vi.fn());
const graphifyMock = vi.hoisted(() => vi.fn());
const semanticMemoryMock = vi.hoisted(() => vi.fn());
const originalEnv = { ...process.env };

vi.mock("./openhuman-client", () => ({
  buildOpenHumanContext: openHumanMock,
}));

vi.mock("./graphify-client", () => ({
  buildGraphifyContext: graphifyMock,
}));

vi.mock("./semantic-memory", () => ({
  buildSemanticMemoryContext: semanticMemoryMock,
}));

describe("personal-intelligence-context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("combines OpenHuman and Graphify context", async () => {
    openHumanMock.mockResolvedValue("\n\n## Contesto OpenHuman\n1. memory");
    graphifyMock.mockResolvedValue("\n\n## Contesto Graphify\n1. graph");
    semanticMemoryMock.mockResolvedValue("");

    const result = await buildPersonalIntelligenceContext({
      query: "auth",
      userId: 7,
      userRole: "admin",
    });

    expect(result.context).toContain("Contesto OpenHuman");
    expect(result.context).toContain("Contesto Graphify");
    expect(result.sources).toEqual(["openhuman", "graphify"]);
  });

  it("includes semantic Wendy memory when the memory plugin returns context", async () => {
    openHumanMock.mockResolvedValue("");
    graphifyMock.mockResolvedValue("");
    semanticMemoryMock.mockResolvedValue("\n\n## Memoria semantica Wendy\n1. Vuole lavorare in cybersecurity.");

    const result = await buildPersonalIntelligenceContext({
      query: "cosa ricordi?",
      userId: 7,
      userRole: "user",
    });

    expect(result.context).toContain("Memoria semantica Wendy");
    expect(result.sources).toEqual(["semantic-memory"]);
  });

  it("does not include Graphify for non-admin users when admin-only is enabled", async () => {
    process.env.GRAPHIFY_WENDY_ADMIN_ONLY = "true";
    openHumanMock.mockResolvedValue("");
    semanticMemoryMock.mockResolvedValue("");

    const result = await buildPersonalIntelligenceContext({
      query: "auth",
      userId: 7,
      userRole: "user",
    });

    expect(graphifyMock).not.toHaveBeenCalled();
    expect(result.context).toBe("");
  });

  it("isolates provider failures", async () => {
    openHumanMock.mockRejectedValue(new Error("down"));
    graphifyMock.mockResolvedValue("\n\n## Contesto Graphify\n1. graph");
    semanticMemoryMock.mockRejectedValue(new Error("memory down"));

    const result = await buildPersonalIntelligenceContext({
      query: "auth",
      userId: 7,
      userRole: "admin",
    });

    expect(result.context).toContain("Contesto Graphify");
    expect(result.sources).toEqual(["graphify"]);
  });
});
