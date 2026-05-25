import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aiPlugins } from "@workspace/ai-server";
import { buildSemanticMemoryContext, recallSemanticMemory } from "./semantic-memory";

const originalEnv = { ...process.env };

describe("semantic-memory bridge", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, FF_SEMANTIC_MEMORY: "true" };
    aiPlugins.reset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    aiPlugins.reset();
  });

  it("returns unavailable recall when no memory plugin is registered", async () => {
    await expect(recallSemanticMemory("cyber", 7, 3)).resolves.toMatchObject({
      available: false,
      source: "semantic-memory",
      memories: [],
    });
  });

  it("builds prompt context from the registered memory plugin", async () => {
    aiPlugins.register({
      id: "fake-memory",
      capability: "memory",
      provider: "fake",
      version: "1.0.0",
      init: async () => {},
      health: async () => ({ ok: true }),
      execute: vi.fn().mockResolvedValue({
        op: "recall",
        memories: [
          {
            id: "m1",
            content: "L'utente sta valutando cybersecurity.",
            score: 0.9,
            source: "mem0",
          },
        ],
      }),
    });

    await expect(buildSemanticMemoryContext("cosa ricordi?", 7)).resolves.toContain(
      "L'utente sta valutando cybersecurity.",
    );
  });
});
