import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVoiceElevenLabsPlugin,
  isVoiceElevenLabsAvailable,
} from "../plugins/builtin/voice-elevenlabs";

describe("voice-elevenlabs plugin", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is available only when the feature flag and API key are present", () => {
    delete process.env.ELEVENLABS_API_KEY;
    process.env.FF_VOICE_PLUGIN = "true";
    expect(isVoiceElevenLabsAvailable()).toBe(false);

    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.FF_VOICE_PLUGIN = "false";
    expect(isVoiceElevenLabsAvailable()).toBe(false);

    process.env.FF_VOICE_PLUGIN = "true";
    expect(isVoiceElevenLabsAvailable()).toBe(true);
  });

  it("calls the ElevenLabs text-to-speech endpoint and returns mp3 audio", async () => {
    process.env.ELEVENLABS_API_KEY = "test-key";
    process.env.ELEVENLABS_VOICE_ID = "voice-123";

    const audio = Buffer.from("mp3-audio");
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => (
      new Response(audio, { status: 200 })
    ));
    vi.stubGlobal("fetch", fetchMock);

    const plugin = createVoiceElevenLabsPlugin();
    const result = await plugin.execute({ text: "Ciao Osman", voiceId: "voice-override" });

    expect(result.format).toBe("mp3");
    expect(result.audio.equals(audio)).toBe(true);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice-override");
    const init = firstCall?.[1] as RequestInit | undefined;
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "xi-api-key": "test-key",
      accept: "audio/mpeg",
      "content-type": "application/json",
    });
  });
});
