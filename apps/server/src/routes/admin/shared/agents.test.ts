import { describe, expect, it } from "vitest";
import { formatRecentAgentRuns, optionalAdminRead } from "./agents";

describe("optionalAdminRead", () => {
  it("keeps admin overview data usable when an optional read fails", async () => {
    const result = await optionalAdminRead(
      async () => {
        throw new Error("missing optional table");
      },
      [{ count: 0 }],
    );

    expect(result).toEqual({
      value: [{ count: 0 }],
      unavailable: true,
      error: "missing optional table",
    });
  });
});

describe("formatRecentAgentRuns", () => {
  it("does not require optional agent_runs columns added by newer migrations", () => {
    const startedAt = new Date("2026-05-26T10:00:00Z");

    expect(formatRecentAgentRuns([{
      id: 67,
      agentName: "news-publishing",
      taskType: "manual_pipeline_run",
      inputSummary: null,
      outputSummary: "{}",
      status: "completed",
      startedAt,
      finishedAt: startedAt,
      durationMs: 1200,
      errorMessage: null,
    }])).toEqual([{
      id: 67,
      agentName: "news-publishing",
      userId: null,
      taskType: "manual_pipeline_run",
      inputSummary: null,
      outputSummary: "{}",
      status: "completed",
      startedAt,
      finishedAt: startedAt,
      durationMs: 1200,
      errorMessage: null,
      createdAt: startedAt,
    }]);
  });
});
