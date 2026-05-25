import { buildWendySystemPrompt, type WendyPromptContext } from "./wendy-prompt-builder";

export interface WendyOrchestratorInput {
  userId: number;
  message: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  context?: WendyPromptContext;
}

export interface WendyModel {
  stream(input: { prompt: string; message: string }): AsyncGenerator<string>;
}

export function createWendyOrchestrator(model: WendyModel) {
  return {
    async *run(input: WendyOrchestratorInput): AsyncGenerator<string> {
      if (!Number.isInteger(input.userId) || input.userId <= 0) {
        throw new Error("Invalid userId");
      }
      if (!input.message.trim()) throw new Error("Message is required");

      yield* model.stream({
        prompt: buildWendySystemPrompt(input.context),
        message: input.message.trim(),
      });
    },
  };
}
