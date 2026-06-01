import type { LLMMessage } from "../llm/client";
import type { ChatMessage } from "./agent-types";

export function buildGrowthLlmMessages(input: {
  systemPrompt: string;
  history: ChatMessage[];
  maxHistory: number;
  userMessage: string;
}): LLMMessage[] {
  return [
    { role: "system", content: input.systemPrompt },
    ...input.history.slice(-input.maxHistory).map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    })),
    { role: "user", content: input.userMessage },
  ];
}
