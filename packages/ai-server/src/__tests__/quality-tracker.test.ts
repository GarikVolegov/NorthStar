import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSet = vi.hoisted(() => vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })));
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockSet })));
const qualityObserve = vi.hoisted(() => vi.fn());
const feedbackInc = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", () => ({
  db: { update: mockUpdate },
  aiCostLogTable: {
    requestId: "request_id",
    supervisorScore: "supervisor_score",
    userFeedback: "user_feedback",
  },
}));

vi.mock("../metrics", () => ({
  recordQualityScore: qualityObserve,
  recordFeedback: feedbackInc,
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn() },
}));

import { aiCostLogTable } from "@workspace/db";
import { recordQualityEvent, recordUserFeedback } from "../growth-agent/quality-tracker";

describe("quality-tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates ai_cost_log and emits quality + feedback metrics", async () => {
    await recordQualityEvent({
      requestId: "8fd0d21d-e84c-4f50-9ffb-633f4b5da21f",
      domain: "career",
      intent: "plan",
      model: "gpt-4o-mini",
      supervisorScore: 0.74,
      userFeedback: "up",
      wasRewritten: false,
      platitudeHits: [],
      actionPatternHits: ["step"],
    });

    expect(mockUpdate).toHaveBeenCalledWith(aiCostLogTable);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      supervisorScore: "0.740",
      userFeedback: "up",
      wasRewritten: false,
    }));
    expect(qualityObserve).toHaveBeenCalledWith("career", "plan", 0.74);
    expect(feedbackInc).toHaveBeenCalledWith("career", "up");
  });

  it("records a late user feedback vote on the cost log", async () => {
    await recordUserFeedback("8fd0d21d-e84c-4f50-9ffb-633f4b5da21f", "down", "mindset");

    expect(mockUpdate).toHaveBeenCalledWith(aiCostLogTable);
    expect(mockSet).toHaveBeenCalledWith({ userFeedback: "down" });
    expect(feedbackInc).toHaveBeenCalledWith("mindset", "down");
  });
});
