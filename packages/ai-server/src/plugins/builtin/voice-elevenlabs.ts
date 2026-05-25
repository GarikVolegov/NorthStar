import { Buffer } from "node:buffer";
import type { AIPlugin, AIPluginHealth } from "../types";

export interface ElevenLabsVoiceInput {
  text: string;
  voiceId?: string;
  format?: "mp3";
}

export interface ElevenLabsVoiceOutput {
  audio: Buffer;
  format: "mp3";
}

const DEFAULT_BASE_URL = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function isEnabled(name: string, defaultVal = false): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultVal;
  return value === "true" || value === "1";
}

function apiKey(): string | undefined {
  return process.env.ELEVENLABS_API_KEY;
}

function baseUrl(): string {
  return (process.env.ELEVENLABS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function defaultVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text ? `ElevenLabs request failed (${response.status}): ${text}` : `ElevenLabs request failed (${response.status})`;
}

export function isVoiceElevenLabsAvailable(): boolean {
  return isEnabled("FF_VOICE_PLUGIN", false) && Boolean(apiKey());
}

export function createVoiceElevenLabsPlugin(): AIPlugin<ElevenLabsVoiceInput, ElevenLabsVoiceOutput> {
  return {
    id: "voice-elevenlabs",
    capability: "voice",
    version: "1.0.0",
    provider: "elevenlabs",

    async init(): Promise<void> {
      if (!apiKey()) {
        throw new Error("ELEVENLABS_API_KEY missing for voice-elevenlabs plugin");
      }
    },

    async health(): Promise<AIPluginHealth> {
      const key = apiKey();
      if (!key) return { ok: false, message: "ELEVENLABS_API_KEY missing" };
      const started = Date.now();
      const response = await fetch(`${baseUrl()}/user`, {
        method: "GET",
        headers: { "xi-api-key": key },
      });
      return {
        ok: response.ok,
        latencyMs: Date.now() - started,
        ...(response.ok ? {} : { message: await readErrorMessage(response) }),
      };
    },

    async execute(input: ElevenLabsVoiceInput): Promise<ElevenLabsVoiceOutput> {
      const key = apiKey();
      if (!key) throw new Error("ELEVENLABS_API_KEY missing for voice-elevenlabs plugin");
      const voiceId = input.voiceId ?? defaultVoiceId();
      const response = await fetch(`${baseUrl()}/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: {
          accept: "audio/mpeg",
          "content-type": "application/json",
          "xi-api-key": key,
        },
        body: JSON.stringify({
          text: input.text,
          model_id: process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID,
        }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      return {
        audio: Buffer.from(await response.arrayBuffer()),
        format: "mp3",
      };
    },
  };
}

export const voiceElevenLabsPlugin = createVoiceElevenLabsPlugin();
