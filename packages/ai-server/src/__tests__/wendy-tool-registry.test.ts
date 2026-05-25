import { describe, expect, it } from "vitest";
import { getToolsForIntent } from "../wendy-router/tool-registry";
import { classifyIntent } from "../wendy-router/intent-classifier";

function toolNames(intent: Parameters<typeof getToolsForIntent>[0]) {
  return getToolsForIntent(intent).map((tool) => tool.name);
}

describe("Wendy core user tool coverage", () => {
  it("keeps calendar creation available in normal conversation", () => {
    expect(classifyIntent({ userMessage: "mettimi un evento in calendario domani" })).toBe("conversation");
    expect(toolNames("conversation")).toContain("add_calendar_event");
  });

  it("lets conversational sector questions search, explain, and navigate", () => {
    const names = toolNames("conversation");

    expect(names).toContain("list_sectors");
    expect(names).toContain("get_sector_detail");
    expect(names).toContain("open_view");
  });

  it("lets Wendy propose user-confirmed memory saves in conversation", () => {
    expect(toolNames("conversation")).toContain("save_memory_fact");
  });

  it("lets Wendy recall semantic conversation memory through the plugin layer", () => {
    expect(toolNames("simple_qa")).toContain("recall_semantic_memory");
    expect(toolNames("conversation")).toContain("recall_semantic_memory");
    expect(toolNames("deep_analysis")).toContain("recall_semantic_memory");
  });
});
