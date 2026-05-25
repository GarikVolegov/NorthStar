import { textToSpeechNativeOpenAI } from "../../audio/client";
import type { Buffer } from "node:buffer";
import type { AIPlugin, AIPluginHealth } from "../types";

export type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type OpenAITtsFormat = "wav" | "mp3" | "flac" | "opus" | "pcm16";

export interface VoicePluginInput {
  text: string;
  voice?: OpenAIVoice;
  format?: OpenAITtsFormat;
}

export interface VoicePluginOutput {
  audio: Buffer;
  format: OpenAITtsFormat;
}

export const voiceDefaultPlugin: AIPlugin<VoicePluginInput, VoicePluginOutput> = {
  id: "voice-openai-tts",
  capability: "voice",
  version: "1.0.0",
  provider: "openai",

  async init(): Promise<void> {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY missing for voice-openai-tts plugin");
    }
  },

  async health(): Promise<AIPluginHealth> {
    const hasApiKey = Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
    return {
      ok: hasApiKey,
      ...(hasApiKey ? {} : { message: "AI_INTEGRATIONS_OPENAI_API_KEY missing" }),
    };
  },

  async execute(input: VoicePluginInput): Promise<VoicePluginOutput> {
    const format = input.format ?? "wav";
    const audio = await textToSpeechNativeOpenAI(input.text, input.voice ?? "alloy", format);
    return { audio, format };
  },
};
