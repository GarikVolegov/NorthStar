import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOpenHumanStatus,
  searchOpenHumanMemory,
  sendOpenHumanMessage,
} from "./openhuman-client";

const originalEnv = { ...process.env };

describe("openhuman-client", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.OPENHUMAN_ENABLED = "true";
    process.env.OPENHUMAN_CORE_RPC_URL = "http://localhost:43210/rpc";
    process.env.OPENHUMAN_CORE_TOKEN = "secret";
    process.env.OPENHUMAN_TIMEOUT_MS = "20";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("reports disabled status without calling the core", async () => {
    process.env.OPENHUMAN_ENABLED = "false";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getOpenHumanStatus()).resolves.toMatchObject({
      enabled: false,
      state: "disabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls JSON-RPC with auth and normalizes memory results", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          result: {
            results: [
              {
                id: "m1",
                title: "Meeting",
                content: "Decisione importante",
                score: 0.91,
                url: "openhuman://memory/m1",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await searchOpenHumanMemory("meeting", 7, 3);

    expect(results).toEqual([
      {
        id: "m1",
        title: "Meeting",
        content: "Decisione importante",
        score: 0.91,
        source: "openhuman",
        url: "openhuman://memory/m1",
        updatedAt: null,
      },
    ]);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const init = calls[0]?.[1] ?? {};
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer secret");
  });

  it("normalizes agent message responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            result: { content: "Risposta personale", sources: [] },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(sendOpenHumanMessage("ciao", 1)).resolves.toEqual({
      message: "Risposta personale",
      sources: [],
    });
  });

  it("returns unreachable status when the core is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    await expect(getOpenHumanStatus()).resolves.toMatchObject({
      enabled: true,
      state: "unreachable",
      configured: true,
    });
  });
});
