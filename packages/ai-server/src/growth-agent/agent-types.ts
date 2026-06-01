import type { WendyActivationContext } from "../wendy-neural";
import type { WendyIntent } from "../wendy-router/types";
import type { CoTResult } from "./chain-of-thought";
import type { EvalResult } from "./self-evaluator";
import type { RetrievedChunk } from "./retriever";
import type { RouteDecision } from "./router-agent";
import type { SupervisorResult } from "./supervisor-agent";
import type { ToolResult } from "../wendy-router/tool-handlers";
import type { UiDirectives } from "./ui-directives";
import type { UiToolArgs, UiToolName } from "./ui-tools";
import type { UserContext } from "./prompt-builder";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  domain?: RouteDecision["domain"] | undefined;
}

export interface GrowthAgentOptions {
  userId: number;
  sessionId?: number | undefined;
  userContext: UserContext & { memorySection?: string | undefined };
  history: ChatMessage[];
  userMessage: string;
  maxHistory?: number | undefined;
  memoryFactCount?: number | undefined;
  voiceMode?: boolean | undefined;
  requestId?: string | undefined;
  wendyIntent?: WendyIntent | undefined;
  isPredefined?: boolean | undefined;
  neuralContext?: WendyActivationContext | undefined;
  executeExternalTool?: GrowthAgentToolExecutor | undefined;
}

export type GrowthAgentToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  userId: number,
) => Promise<ToolResult>;

export type GrowthAgentEvent =
  | { type: "token"; value: string }
  | { type: "status"; value: string; domain?: RouteDecision["domain"] | undefined }
  | { type: "ui_tool"; name: UiToolName; args: UiToolArgs }
  | { type: "tool_call"; name: string; result: unknown }
  | { type: "done"; sources: RetrievedChunk[]; cot?: CoTResult | null | undefined; evalResult?: EvalResult | undefined; routeDecision?: RouteDecision | undefined; supervisorResult?: SupervisorResult | undefined; uiDirectives?: UiDirectives | undefined }
  | { type: "error"; message: string };
