import { describe, expect, it } from "vitest";

import {
  WendyConfigSchema,
  applyConfigOverrides,
  parseEnvConfig,
} from "../config/wendy.config";

describe("Wendy config foundation", () => {
  it("loads defaults through the Zod schema", () => {
    const cfg = parseEnvConfig({});

    expect(WendyConfigSchema.parse(cfg).supervisor.passThreshold).toBe(0.7);
    expect(cfg.router.intentThresholds.plan?.base).toBe(0.7);
    expect(cfg.memory.decayHalfLifeDays).toBe(90);
  });

  it("applies environment overrides without mutating process.env", () => {
    const cfg = parseEnvConfig({
      WENDY_SUPERVISOR_PASS_THRESHOLD: "0.61",
      WENDY_ROUTER_PLAN_BASE: "0.77",
      WENDY_MEMORY_MAX_PROMPT_PATTERNS: "5",
    });

    expect(cfg.supervisor.passThreshold).toBe(0.61);
    expect(cfg.router.intentThresholds.plan?.base).toBe(0.77);
    expect(cfg.memory.maxPromptPatterns).toBe(5);
  });

  it("overlays DB override rows by dotted config key", () => {
    const base = parseEnvConfig({});
    const cfg = applyConfigOverrides(base, [
      { key: "supervisor.passThreshold", value: 0.6 },
      { key: "memory.maxPromptPatterns", value: 4 },
    ]);

    expect(cfg.supervisor.passThreshold).toBe(0.6);
    expect(cfg.memory.maxPromptPatterns).toBe(4);
    expect(base.supervisor.passThreshold).toBe(0.7);
  });

  it("supports a full-config override row for admin bulk updates", () => {
    const base = parseEnvConfig({});
    const cfg = applyConfigOverrides(base, [
      {
        key: "config",
        value: {
          specialist: {
            temperatureByComplexity: {
              low: 0.3,
              high: 0.8,
            },
          },
        },
      },
    ]);

    expect(cfg.specialist.temperatureByComplexity.low).toBe(0.3);
    expect(cfg.specialist.temperatureByComplexity.high).toBe(0.8);
  });
});
