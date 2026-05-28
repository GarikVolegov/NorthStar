import { beforeEach, describe, expect, it, vi } from "vitest";

const executeToolCall = vi.hoisted(() => vi.fn());
const executeHostTool = vi.hoisted(() => vi.fn());

vi.mock("@workspace/ai-server", () => ({
  executeToolCall,
}));

vi.mock("./wendy-host-tools", () => ({
  isHostTool: (name: string) => name === "search_code_graph",
  executeHostTool,
}));

describe("executeWendyToolCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes host tools through the server host executor", async () => {
    const { executeWendyToolCall } = await import("./wendy-tool-executor");
    executeHostTool.mockResolvedValue({ ok: true, data: { source: "graphify" } });

    const result = await executeWendyToolCall("search_code_graph", { query: "routing" }, 42);

    expect(result).toEqual({ ok: true, data: { source: "graphify" } });
    expect(executeHostTool).toHaveBeenCalledWith("search_code_graph", { query: "routing" }, 42);
    expect(executeToolCall).not.toHaveBeenCalled();
  });

  it("routes package tools through the shared Wendy dispatcher", async () => {
    const { executeWendyToolCall } = await import("./wendy-tool-executor");
    executeToolCall.mockResolvedValue({ ok: true, data: { sectors: [] } });

    const result = await executeWendyToolCall("list_sectors", { limit: 3 }, 42);

    expect(result).toEqual({ ok: true, data: { sectors: [] } });
    expect(executeToolCall).toHaveBeenCalledWith("list_sectors", { limit: 3 }, 42);
    expect(executeHostTool).not.toHaveBeenCalled();
  });
});
