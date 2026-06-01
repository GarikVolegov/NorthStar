import type { ToolDefinitionOpenAI } from "../llm/client";
import type { WendyIntent } from "../wendy-router/types";
import { getToolsForIntent, toolsToOpenAIFormat } from "../wendy-router/tool-registry";
import { FF } from "../feature-flags";
import { UI_TOOLS } from "./ui-tools";

export function buildGrowthAgentTools(wendyIntent?: WendyIntent): ToolDefinitionOpenAI[] {
  const wendyDomainTools = wendyIntent
    ? toolsToOpenAIFormat(getToolsForIntent(wendyIntent))
    : [];
  return [
    ...(FF.generativeUI ? (UI_TOOLS as unknown as ToolDefinitionOpenAI[]) : []),
    ...(wendyDomainTools as ToolDefinitionOpenAI[]),
  ];
}
