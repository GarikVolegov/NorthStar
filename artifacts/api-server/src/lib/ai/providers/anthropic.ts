/**
 * Provider Anthropic
 * Usato per agent_analysis: ragionamento RIASEC+Spiriti, tool use strutturato.
 * Modello default: claude-sonnet-4-5.
 *
 * Supporta:
 *   - Chat non-streaming con output testuale
 *   - Tool use (function calling) con stop_reason=tool_use
 *   - Streaming via anthropic.messages.stream (restituisce AsyncIterable<string>)
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, AITool, AIAgentRequest, AIAgentResponse } from "../types";

let _anthropicClient: Anthropic | null = null;

export function createAnthropicClient(): Anthropic {
  if (!_anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("[ai-router] ANTHROPIC_API_KEY mancante");
    _anthropicClient = new Anthropic({ apiKey });
  }
  return _anthropicClient;
}

/** Converte i tool NorthStar nel formato Anthropic */
function toAnthropicTools(tools: AITool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      ...(t.inputSchema as Record<string, unknown>),
    },
  }));
}

/**
 * Analisi agente (non-streaming) — usato per RIASEC+Spiriti e agent runs.
 * Restituisce testo + eventuali tool call da eseguire lato server.
 */
export async function analyzeWithAnthropic(
  request: AIAgentRequest,
  model: string
): Promise<AIAgentResponse> {
  const client = createAnthropicClient();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: request.userPrompt },
  ];

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: request.maxTokens ?? 4096,
    system: request.systemPrompt,
    messages,
    ...(request.tools && request.tools.length > 0
      ? { tools: toAnthropicTools(request.tools) }
      : {}),
    ...(request.temperature !== undefined
      ? { temperature: request.temperature }
      : {}),
  };

  const res = await client.messages.create(params);

  // Estrae testo e tool_use dal content block
  let text: string | null = null;
  const toolCalls: AIAgentResponse["toolCalls"] = [];

  for (const block of res.content) {
    if (block.type === "text") {
      text = (text ?? "") + block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      });
    }
  }

  return {
    text,
    toolCalls,
    stopReason: res.stop_reason ?? "end_turn",
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
  };
}

/**
 * Streaming chat via Anthropic (per SSE se l'agente deve rispondere live).
 * Restituisce AsyncIterable<string> normalizzato.
 */
export async function* streamAnthropicChat(
  messages: ChatMessage[],
  systemPrompt: string,
  model: string,
  maxTokens = 2048
): AsyncIterable<string> {
  const client = createAnthropicClient();

  const anthropicMessages: Anthropic.MessageParam[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const stream = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: anthropicMessages,
    stream: true,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}
