import { beforeEach, describe, expect, it } from "vitest";
import {
  recordFeedback,
  recordModelEffectiveness,
  register,
} from "../metrics";

describe("Phase 2 Wendy metrics", () => {
  beforeEach(() => {
    register.resetMetrics();
  });

  it("records feedback and model effectiveness metrics", async () => {
    recordFeedback("career", "up");
    recordModelEffectiveness("gpt-4o-mini", "career", 0.83);

    const metrics = await register.metrics();

    expect(metrics).toContain("wendy_feedback_total");
    expect(metrics).toContain('domain="career"');
    expect(metrics).toContain('feedback="up"');
    expect(metrics).toContain("wendy_model_effectiveness");
    expect(metrics).toContain('model="gpt-4o-mini"');
  });
});
