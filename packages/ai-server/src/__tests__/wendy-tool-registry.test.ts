import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { getToolsForIntent } from "../wendy-router/tool-registry";
import { classifyIntent } from "../wendy-router/intent-classifier";
import { toolRegistry } from "../tools/registry";

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

  it("exposes the NorthStar brain search tool for internal product questions", () => {
    expect(toolNames("simple_qa")).toContain("search_brain");
    expect(toolNames("conversation")).toContain("search_brain");
    expect(toolNames("deep_analysis")).toContain("search_brain");
  });

  it("exposes Try-a-Day scene generation for contextual role follow-up", () => {
    expect(toolNames("conversation")).toContain("generate_day_scene");
    expect(toolNames("deep_analysis")).toContain("generate_day_scene");
    expect(toolNames("simple_qa")).not.toContain("generate_day_scene");
  });

  it("registers a self-describing domain-scoped plugin tool", () => {
    toolRegistry.register({
      name: "get_salary_benchmark_test",
      description: "Stima un benchmark salariale per un ruolo.",
      parameters: [
        { name: "roleTitle", type: "string", description: "Titolo del ruolo", required: true },
      ],
      inputSchema: z.object({ roleTitle: z.string() }),
      outputSchema: z.object({ medianSalary: z.number() }),
      domains: ["career"],
      intents: ["planning"],
      isUiTool: false,
      requiresWrite: false,
      handler: async () => ({ medianSalary: 42_000 }),
    });

    expect(toolRegistry.getForIntent("planning", "career").map((tool) => tool.name))
      .toContain("get_salary_benchmark_test");
    expect(toolRegistry.getForIntent("planning", "mindset").map((tool) => tool.name))
      .not.toContain("get_salary_benchmark_test");
    const [openAiTool] = toolRegistry.toOpenAIFormat([
      toolRegistry.getByName("get_salary_benchmark_test")!,
    ]);
    expect(openAiTool?.type).toBe("function");
    if (openAiTool?.type !== "function") throw new Error("expected function tool");
    expect(openAiTool.function.name).toBe("get_salary_benchmark_test");
  });
});
