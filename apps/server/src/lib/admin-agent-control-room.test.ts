import { describe, expect, it } from "vitest";
import {
  buildAgentConfigBlockers,
  summarizeReadyOutputs,
} from "./admin-agent-control-room";

describe("admin agent control room", () => {
  it("reports missing configuration that blocks autonomous agents", () => {
    const blockers = buildAgentConfigBlockers({
      AI_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "set",
      OPENAI_API_KEY: "",
      ADZUNA_APP_ID: "",
      ADZUNA_API_KEY: "",
      JOOBLE_API_KEY: "",
      PRINTING_PRESS_BRIDGE_URL: "",
    });

    expect(blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "OPENAI_API_KEY", status: "missing" }),
      expect.objectContaining({ key: "ADZUNA_APP_ID", status: "missing" }),
      expect.objectContaining({ key: "ADZUNA_API_KEY", status: "missing" }),
      expect.objectContaining({ key: "PRINTING_PRESS_BRIDGE_URL", status: "missing" }),
    ]));
  });

  it("summarizes ready outputs without inventing agent data", () => {
    expect(summarizeReadyOutputs({
      realNews: 12,
      pendingDiscovery: 4,
      growthArticles: 0,
      jobSnapshots: 0,
      latestNews: [],
      latestGrowthArticles: [],
    })).toMatchObject({
      realNews: { count: 12, status: "ready" },
      pendingDiscovery: { count: 4, status: "attention" },
      growthArticles: { count: 0, status: "empty" },
      jobSnapshots: { count: 0, status: "blocked_or_empty" },
    });
  });
});
