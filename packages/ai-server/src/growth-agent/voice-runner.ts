import type OpenAI from "openai";
import { openai } from "../client";
import { modelFor } from "../model-router";
import { recordError } from "../metrics";
import { withTimeout } from "../utils";
import { logger, type LoggerFields } from "../logger";
import { FF } from "../feature-flags";
import { buildVoiceSystemPrompt } from "./prompt-builder";
import { extractMemory, mergeMemory } from "./memory-manager";
import type { ChatMessage, GrowthAgentEvent } from "./agent";

const VOICE_MODEL = modelFor("growth-agent-voice");

interface VoiceFastPathOptions {
  userId: number;
  sessionId?: number | undefined;
  name?: string | undefined;
  history: ChatMessage[];
  userMessage: string;
  logFields: LoggerFields;
}

export async function* runVoiceFastPath(opts: VoiceFastPathOptions): AsyncGenerator<GrowthAgentEvent> {
  const { userId, sessionId, name, history, userMessage, logFields } = opts;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildVoiceSystemPrompt(name) },
    ...history.slice(-6).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  try {
    const stream = await openai.chat.completions.create({
      model: VOICE_MODEL,
      messages,
      stream: true,
      temperature: 0.8,
      max_tokens: 120,
    });
    const tokenBuffer: string[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        tokenBuffer.push(delta);
        yield { type: "token", value: delta };
      }
    }
    yield { type: "done", sources: [] };
    scheduleVoiceMemorySave({ userId, sessionId, history, userMessage, assistantContent: tokenBuffer.join(""), logFields });
  } catch (err) {
    recordError("voice", "general");
    logger.error({ err, ...logFields }, "voice fast path failed");
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

interface VoiceMemorySaveOptions {
  userId: number;
  sessionId?: number | undefined;
  history: ChatMessage[];
  userMessage: string;
  assistantContent: string;
  logFields: LoggerFields;
}

function scheduleVoiceMemorySave(opts: VoiceMemorySaveOptions): void {
  const { userId, sessionId, history, userMessage, assistantContent, logFields } = opts;
  if (!sessionId || !FF.memoryEnabled) return;
  const turns = [
    ...history.slice(-4),
    { role: "user" as const, content: userMessage },
    { role: "assistant" as const, content: assistantContent },
  ];
  void (async () => {
    try {
      const extracted = await withTimeout(extractMemory(turns), 5000, "extractMemory");
      if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
        await withTimeout(mergeMemory(userId, sessionId, extracted), 3000, "mergeMemory");
      }
    } catch (err) {
      logger.warn({ err, ...logFields }, "voice memory save failed/timed out");
    }
  })();
}
