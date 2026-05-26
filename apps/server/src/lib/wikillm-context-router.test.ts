import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildWikiLLMContext } from "./wikillm-context-router";

const semanticMemoryMock = vi.hoisted(() => vi.fn());
const openHumanMock = vi.hoisted(() => vi.fn());
const graphifyMock = vi.hoisted(() => vi.fn());
const searchWendyBrainMock = vi.hoisted(() => vi.fn());
const buildWendyBrainContextSectionMock = vi.hoisted(() => vi.fn());

vi.mock("./semantic-memory", () => ({
  buildSemanticMemoryContext: semanticMemoryMock,
}));

vi.mock("./openhuman-client", () => ({
  buildOpenHumanContext: openHumanMock,
}));

vi.mock("./graphify-client", () => ({
  buildGraphifyContext: graphifyMock,
}));

vi.mock("@workspace/ai-server", () => ({
  searchWendyBrain: searchWendyBrainMock,
  buildWendyBrainContextSection: buildWendyBrainContextSectionMock,
}));

describe("wikillm-context-router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    semanticMemoryMock.mockResolvedValue("");
    openHumanMock.mockResolvedValue("");
    graphifyMock.mockResolvedValue("");
    searchWendyBrainMock.mockResolvedValue([]);
    buildWendyBrainContextSectionMock.mockReturnValue("");
  });

  it("routes code questions to the code graph profile", async () => {
    graphifyMock.mockResolvedValue("\n\n## Contesto Graphify\n1. apps/server/src/routes/wiki.ts");

    const result = await buildWikiLLMContext({
      query: "Dove viene costruito streamWikiResponse nel codice?",
      userId: 7,
      userRole: "admin",
      includePersonalMemory: false,
    });

    expect(graphifyMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ profile: "code" }),
    );
    expect(result.sources).toEqual(["graphify"]);
    expect(result.contexts.graphify).toContain("Graphify codice");
  });

  it("routes Wendy behavior questions to process graph and Wendy Brain", async () => {
    graphifyMock.mockResolvedValue("\n\n## Contesto Graphify\n1. docs/ai-modules/ROUTER.md");
    searchWendyBrainMock.mockResolvedValue([{ id: 1 }]);
    buildWendyBrainContextSectionMock.mockReturnValue("## Wendy Brain\n- policy");

    const result = await buildWikiLLMContext({
      query: "Come deve comportarsi Wendy quando non sa una risposta?",
      userId: 7,
      userRole: "admin",
      includePersonalMemory: false,
      includeWendyBrain: true,
    });

    expect(graphifyMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ profile: "process" }),
    );
    expect(searchWendyBrainMock).toHaveBeenCalled();
    expect(result.sources).toEqual(["graphify", "wendy-brain"]);
  });

  it("keeps market questions on personal/RAG sources and skips Graphify by default", async () => {
    semanticMemoryMock.mockResolvedValue("\n\n## Memoria semantica Wendy\n1. preferenza");

    const result = await buildWikiLLMContext({
      query: "Quali trend di mercato stanno crescendo nel marketing?",
      userId: 7,
      userRole: "user",
      includePersonalMemory: true,
    });

    expect(graphifyMock).not.toHaveBeenCalled();
    expect(result.sources).toEqual(["semantic-memory"]);
  });

  it("routes Wiki and documentation questions to the docs graph profile", async () => {
    graphifyMock.mockResolvedValue("\n\n## Contesto Graphify\n1. docs/openhuman-integration.md");

    const result = await buildWikiLLMContext({
      query: "Quali documenti spiegano la knowledge base OpenHuman?",
      userId: 7,
      userRole: "admin",
      includePersonalMemory: false,
    });

    expect(graphifyMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ profile: "docs" }),
    );
    expect(result.contexts.graphify).toContain("Graphify documenti");
  });
});
