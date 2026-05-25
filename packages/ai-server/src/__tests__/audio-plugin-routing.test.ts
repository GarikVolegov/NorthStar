import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { textToSpeech } from "../audio/client";
import { FF } from "../feature-flags";
import { aiPlugins } from "../plugins/registry";
import type { AIPlugin } from "../plugins/types";

describe("audio client plugin routing", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    aiPlugins.reset();
    process.env = { ...originalEnv, FF_VOICE_PLUGIN: "true" };
    FF.voicePluginEnabled = true;
  });

  afterEach(() => {
    aiPlugins.reset();
    process.env = { ...originalEnv };
    FF.voicePluginEnabled = false;
  });

  it("uses an active non-OpenAI voice plugin before falling back to native OpenAI TTS", async () => {
    const audio = Buffer.from("external-voice");
    const plugin: AIPlugin<{ text: string }, { audio: Buffer; format: "mp3" }> = {
      id: "voice-test-provider",
      capability: "voice",
      version: "1.0.0",
      provider: "test",
      init: async () => {},
      health: async () => ({ ok: true }),
      execute: async (input) => {
        expect(input.text).toBe("ciao");
        return { audio, format: "mp3" };
      },
    };

    aiPlugins.register(plugin);

    await expect(textToSpeech("ciao", "nova", "mp3")).resolves.toBe(audio);
  });
});
