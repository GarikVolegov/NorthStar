import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryMem0Plugin,
  isMemoryMem0Available,
} from "../plugins/builtin/memory-mem0";

const originalEnv = { ...process.env };

describe("memory-mem0 plugin", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("is unavailable without MEM0_API_KEY", () => {
    delete process.env.MEM0_API_KEY;
    expect(isMemoryMem0Available()).toBe(false);
  });

  it("stores a semantic turn through the configured Mem0 endpoint", async () => {
    process.env.MEM0_API_KEY = "mem0-key";
    process.env.MEM0_BASE_URL = "https://mem0.local/v1";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "m1" }), { status: 200 }),
    );

    const plugin = createMemoryMem0Plugin();
    await expect(
      plugin.execute({
        op: "store",
        userId: 7,
        turns: [
          { role: "user", content: "voglio fare data analyst" },
          { role: "assistant", content: "Partiamo da SQL e portfolio." },
        ],
      }),
    ).resolves.toEqual({ op: "store", stored: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    const init = firstCall?.[1] as RequestInit | undefined;
    expect(firstCall?.[0]).toBe("https://mem0.local/v1/memories");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Token mem0-key" });
  });

  it("normalizes recall results from Mem0 search", async () => {
    process.env.MEM0_API_KEY = "mem0-key";
    process.env.MEM0_BASE_URL = "https://mem0.local/v1";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: "abc",
              memory: "Vuole lavorare nel settore cyber security.",
              score: 0.82,
              updated_at: "2026-05-24T10:00:00Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const plugin = createMemoryMem0Plugin();
    await expect(
      plugin.execute({ op: "recall", userId: 7, query: "cyber", limit: 3 }),
    ).resolves.toEqual({
      op: "recall",
      memories: [
        {
          id: "abc",
          content: "Vuole lavorare nel settore cyber security.",
          score: 0.82,
          updatedAt: "2026-05-24T10:00:00Z",
          source: "mem0",
        },
      ],
    });
  });
});
