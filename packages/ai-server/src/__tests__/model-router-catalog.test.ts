import { describe, it, expect, beforeEach } from "vitest";
import {
  getCatalog,
  findModel,
  findModelById,
  applyCatalogPatch,
  refreshCatalog,
  _resetCatalogForTest,
  type ModelEntry,
} from "../model-router/catalog";

describe("model catalog", () => {
  beforeEach(() => {
    _resetCatalogForTest();
  });

  it("default catalog contains the legacy tier defaults", () => {
    const all = getCatalog();
    expect(all.find((m) => m.id === "llama-3.1-8b-instant")).toBeTruthy();
    expect(all.find((m) => m.id === "deepseek/deepseek-r1:free")).toBeTruthy();
    expect(all.find((m) => m.id === "gpt-4o-mini")).toBeTruthy();
  });

  it("findModel filters by tier and prefers cheapest", () => {
    const reasoning = findModel({ tier: "reasoning" });
    expect(reasoning?.tier).toBe("reasoning");
    expect(reasoning?.costPer1MIn).toBe(0);
  });

  it("findModel excludes paid models when asked", () => {
    const free = findModel({ tier: "premium", excludePaid: true });
    expect(free).toBeUndefined();
    const paidPremium = findModel({ tier: "premium" });
    expect(paidPremium?.id).toBe("gpt-4o");
  });

  it("findModel can filter by capability", () => {
    const vision = findModel({ capability: "vision" });
    expect(vision?.capabilities).toContain("vision");
  });

  it("findModel can filter by minContext", () => {
    const big = findModel({ tier: "reasoning", minContext: 100_000 });
    expect(big?.contextWindow).toBeGreaterThanOrEqual(100_000);
  });

  it("applyCatalogPatch adds new entries and marks deprecation", () => {
    const newEntry: ModelEntry = {
      id: "test-future-model",
      provider: "openrouter",
      tier: "reasoning",
      contextWindow: 1_000_000,
      costPer1MIn: 0,
      costPer1MOut: 0,
      capabilities: ["chat", "thinking", "long-context"],
      addedAt: "2027-01-01",
    };
    const patch1 = applyCatalogPatch({ added: [newEntry] });
    expect(patch1.added).toBe(1);
    expect(findModelById("test-future-model")).toBeTruthy();

    const patch2 = applyCatalogPatch({ deprecated: ["gpt-4o"] });
    expect(patch2.deprecated).toBe(1);
    expect(findModelById("gpt-4o")?.deprecated).toBe(true);
    expect(getCatalog().find((m) => m.id === "gpt-4o")).toBeUndefined();
  });

  it("refreshCatalog returns a stub report in strato 1", async () => {
    const report = await refreshCatalog();
    expect(report.source).toBe("local");
    expect(Array.isArray(report.candidates)).toBe(true);
  });
});
