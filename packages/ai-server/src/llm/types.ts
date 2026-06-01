export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatWithToolsResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length";
}

export type ToolDefinitionOpenAI = {
  type: "function";
  function: { name: string; description: string; parameters: object };
};

export interface LLMProvider {
  chat(messages: LLMMessage[], config?: LLMConfig): Promise<AsyncIterable<string>>;
  chatOnce(messages: LLMMessage[], config?: LLMConfig): Promise<string>;
  chatWithTools(
    messages: LLMMessage[],
    tools: ToolDefinitionOpenAI[],
    config?: LLMConfig,
  ): Promise<ChatWithToolsResult>;
}
