import type { WendyIntent } from "../wendy-router/types";
import type { PluginToolDefinition } from "./types";
import { toOpenAITool } from "./types";
import type OpenAI from "openai";

class ToolRegistry {
  private tools = new Map<string, PluginToolDefinition>();

  register(tool: PluginToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getByName(name: string): PluginToolDefinition | undefined {
    return this.tools.get(name);
  }

  getForIntent(intent: WendyIntent): PluginToolDefinition[] {
    return Array.from(this.tools.values()).filter((t) =>
      t.intents.includes(intent),
    );
  }

  isUiTool(name: string): boolean {
    return this.tools.get(name)?.isUiTool === true;
  }

  all(): PluginToolDefinition[] {
    return Array.from(this.tools.values());
  }

  toOpenAIFormat(tools: PluginToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(toOpenAITool);
  }
}

export const toolRegistry = new ToolRegistry();
