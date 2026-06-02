import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ execute: vi.fn(), select: vi.fn() }));
const embeddingMock = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return { ...actual, db: dbMock };
});

vi.mock("@workspace/ai-server/embeddings/generate", () => ({
  generateEmbedding: embeddingMock,
}));

import { globalSearch } from "./global-search";

function mockSelectRows<T>(rows: T[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockResolvedValue(rows);
  dbMock.select.mockReturnValueOnce(chain);
  return chain;
}

describe("globalSearch discovery metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    embeddingMock.mockResolvedValue([0.12, 0.34, 0.56]);
    dbMock.execute.mockResolvedValue({ rows: [] });
  });

  it("adds discovery metadata to indexed semantic results", async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [
        {
          id: 10,
          entity_type: "article",
          entity_id: "42",
          user_id: null,
          title: "Focus profondo",
          content: "Tecniche operative per proteggere il focus.",
          url: "/crescita/articolo/focus-profondo",
          visibility: "public",
          metadata: {
            tags: ["focus"],
            personalityMatches: ["Investigativo"],
          },
          score_lexical: 1,
          score_semantic: 0.81,
          score_total: 1.81,
        },
      ],
    });

    const response = await globalSearch({ query: "focus", userId: 7 });

    expect(response).toMatchObject({
      has_semantic: true,
      searchMode: "semantic",
      indexStatus: "ready",
    });
    expect(response.results[0]).toMatchObject({
      source: "index",
      sourceLabel: "Indice NorthStar",
      personalization: "profile",
      actionLabel: "Leggi",
    });
    expect(response.results[0]?.reasonLabels).toEqual(
      expect.arrayContaining(["Match semantico", "Tema: focus"]),
    );
  });

  it("adds live catalog metadata when index search degrades to sector fallback", async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    mockSelectRows([
      {
        id: 5,
        title: "Cybersecurity",
        description: "Settore per analisti e difesa applicativa",
        icon: "shield",
        color: "#0f766e",
      },
    ]);

    const response = await globalSearch({
      query: "cyber",
      userId: null,
      types: ["sector"],
    });

    expect(response).toMatchObject({
      has_semantic: false,
      searchMode: "hybrid",
      indexStatus: "degraded",
    });
    expect(response.results[0]).toMatchObject({
      type: "sector",
      source: "live",
      sourceLabel: "Catalogo settori",
      personalization: "generic",
      actionLabel: "Esplora",
    });
  });

  it("keeps public live fallback articles generic even when article taxonomy matches", async () => {
    dbMock.execute.mockResolvedValueOnce({ rows: [] });
    mockSelectRows([
      {
        id: 12,
        title: "Routine di focus",
        description: "Allenare l'attenzione ogni giorno",
        slug: "routine-focus",
        content: "Focus e metodo",
        tags: ["focus"],
        personalityMatches: ["Investigativo"],
        sectorLinks: ["Design"],
      },
    ]);

    const response = await globalSearch({
      query: "focus",
      userId: null,
      types: ["article"],
    });

    expect(response.results[0]).toMatchObject({
      type: "article",
      source: "live",
      sourceLabel: "Biblioteca crescita",
      personalization: "generic",
    });
    expect(response.results[0]?.reasonLabels).toEqual(
      expect.not.arrayContaining(["Profilo: Investigativo"]),
    );
  });

  it("keeps private indexed metadata redacted in discovery labels and signals", async () => {
    dbMock.execute.mockResolvedValueOnce({
      rows: [
        {
          id: 30,
          entity_type: "objective",
          entity_id: "88",
          user_id: 7,
          title: "Obiettivo personale",
          content: "Percorso riservato",
          url: "/dashboard",
          visibility: "private",
          metadata: {
            category: "carriera-segreta",
            tags: ["riservato"],
            personalityMatches: ["Investigativo"],
            sectorLinks: ["Finanza"],
          },
          score_lexical: 1,
          score_semantic: 0.74,
          score_total: 1.74,
        },
      ],
    });

    const response = await globalSearch({ query: "obiettivo", userId: 7 });
    const result = response.results[0];

    expect(result).toMatchObject({
      source: "index",
      sourceLabel: "Contenuti personali",
      personalization: "private",
    });

    const labels = result?.reasonLabels.join(" ") ?? "";
    const signals = result?.matchSignals.join(" ") ?? "";
    for (const privateValue of ["carriera-segreta", "riservato", "Investigativo", "Finanza"]) {
      expect(labels).not.toContain(privateValue);
      expect(signals).not.toContain(privateValue);
    }
  });
});
