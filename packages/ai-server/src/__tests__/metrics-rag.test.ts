import { beforeEach, describe, expect, it } from "vitest";
import {
  getRagMetricsSummary,
  recordRagFallback,
  recordRagJsLimitHit,
  recordRagRetrieve,
  register,
} from "../metrics";

describe("RAG metrics summary", () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  it("aggregates retrieve volume, rates, latency, score samples, and thresholds", async () => {
    recordRagRetrieve("pgvector", "ok", 0.1, [0.8, 0.9]);
    recordRagRetrieve("pgvector", "empty", 0.3, []);
    recordRagRetrieve("js", "ok", 0.2, [0.7]);
    recordRagRetrieve("none", "error", 0.05, []);
    recordRagFallback("pgvector failed");
    recordRagJsLimitHit();

    const summary = await getRagMetricsSummary();

    expect(summary.totalRetrieves).toBe(4);
    expect(summary.fallbackRate).toBe(0.25);
    expect(summary.emptyResultRate).toBe(0.25);
    expect(summary.jsLimitHits).toBe(1);
    expect(summary.avgLatencyMsByBackend.pgvector).toBeCloseTo(200);
    expect(summary.avgLatencyMsByBackend.js).toBeCloseTo(200);
    expect(summary.avgLatencyMsByBackend.none).toBeCloseTo(50);
    expect(summary.scoreSamplesByBackend).toEqual({ pgvector: 2, js: 1 });
    expect(summary.alertThresholds).toEqual({
      fallbackRate: 0.05,
      emptyResultRate: 0.2,
      windowMinutes: 10,
    });
  });
});
