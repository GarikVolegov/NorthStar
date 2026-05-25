import { logger } from "../logger";
import { aiPlugins } from "./registry";
import { reasoningDefaultPlugin } from "./builtin/reasoning-openai";
import { voiceDefaultPlugin } from "./builtin/voice-openai-tts";
import { embeddingDefaultPlugin } from "./builtin/embedding-openai";
import { memoryMem0Plugin, isMemoryMem0Available } from "./builtin/memory-mem0";
import { reasoningClaudeOpusPlugin, isReasoningClaudeOpusAvailable } from "./builtin/reasoning-claude-opus";
import { voiceElevenLabsPlugin, isVoiceElevenLabsAvailable } from "./builtin/voice-elevenlabs";
import { visionGpt4oPlugin, isVisionGpt4oAvailable } from "./builtin/vision-gpt4o";
import type { AIPlugin } from "./types";

function collectBuiltinPlugins(): AIPlugin[] {
  const list: AIPlugin[] = [
    reasoningDefaultPlugin as AIPlugin,
    voiceDefaultPlugin as AIPlugin,
    embeddingDefaultPlugin as AIPlugin,
  ];
  if (isVoiceElevenLabsAvailable()) {
    list.unshift(voiceElevenLabsPlugin as AIPlugin);
  }
  if (isReasoningClaudeOpusAvailable()) {
    list.push(reasoningClaudeOpusPlugin as AIPlugin);
  }
  if (isMemoryMem0Available()) {
    list.push(memoryMem0Plugin as AIPlugin);
  }
  if (isVisionGpt4oAvailable()) {
    list.push(visionGpt4oPlugin as AIPlugin);
  }
  return list;
}

let initialized = false;

export async function initAIPlugins(): Promise<void> {
  if (initialized) return;
  initialized = true;
  const builtins = collectBuiltinPlugins();
  let registered = 0;
  for (const plugin of builtins) {
    try {
      await plugin.init();
      aiPlugins.register(plugin);
      registered += 1;
    } catch (err) {
      logger.warn(
        {
          err,
          id: plugin.id,
          capability: plugin.capability,
          provider: plugin.provider,
        },
        "[ai-plugin] builtin init failed, skipping",
      );
    }
  }
  logger.info({ registered, total: builtins.length }, "[ai-plugin] bootstrap complete");
}

export function _resetAIPluginsBootstrapForTest(): void {
  initialized = false;
  aiPlugins.reset();
}
