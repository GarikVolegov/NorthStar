import { describe, expect, it, vi } from "vitest";

vi.mock("../metrics", () => ({
  recordToolCall: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn() },
}));

vi.mock("../embeddings/generate", () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {},
  discoveryItemsTable: {},
  educationPathsTable: {},
  growthArticlesTable: {},
  newsArticlesTable: {},
  professionEducationPathsTable: {},
  professionsTable: {},
  sectorsTable: {},
  userObjectivesTable: {},
}));

import { executeToolCall } from "./tool-handlers";

describe("update_objective_progress proposal", () => {
  it("rejects NaN objective ids before proposing a client action", async () => {
    const result = await executeToolCall(
      "update_objective_progress",
      { objectiveId: Number.NaN, progress: 55 },
      7,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: expect.stringContaining("ID obiettivo"),
    });
  });

  it("rejects NaN progress before proposing a client action", async () => {
    const result = await executeToolCall(
      "update_objective_progress",
      { objectiveId: 42, progress: Number.NaN },
      7,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: expect.stringContaining("progresso"),
    });
  });

  it("returns an informative preview for a valid progress update", async () => {
    const result = await executeToolCall(
      "update_objective_progress",
      { objectiveId: 42, progress: 100 },
      7,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toMatchObject({
      clientSide: true,
      action: "update_objective_progress",
      wendyAction: {
        type: "update_objective_progress",
        payload: { objectiveId: 42, progress: 100 },
        preview: expect.arrayContaining([
          { label: "Obiettivo ID", value: "#42" },
          { label: "Nuovo progresso", value: "100%" },
          { label: "Stato", value: "Completato" },
        ]),
      },
    });
  });
});
