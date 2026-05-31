import { isRecord } from "../utils";
import { OpenAI, toFile } from "openai";
import { Buffer } from "node:buffer";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";
import pRetry from "p-retry";
import { logger } from "../logger";
import { FF } from "../feature-flags";
import { aiPlugins } from "../plugins/registry";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "missing-openai-key",
  ...(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
    ? { baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL }
    : {}),
});

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";
type AudioPayload = { transcript?: string; data?: string };
type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
type TtsFormat = "wav" | "mp3" | "flac" | "opus" | "pcm16";

function assertOpenAIConfig(): void {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
}



function readAudioPayload(value: unknown): AudioPayload {
  if (!isRecord(value)) return {};
  const audio = isRecord(value.audio) ? value.audio : {};
  const payload: AudioPayload = {};
  if (typeof audio.transcript === "string") payload.transcript = audio.transcript;
  if (typeof audio.data === "string") payload.data = audio.data;
  return payload;
}

function readMessageText(value: unknown): string {
  return isRecord(value) && typeof value.content === "string" ? value.content : "";
}

function readVoicePluginAudio(value: unknown): Buffer | undefined {
  if (!isRecord(value)) return undefined;
  return Buffer.isBuffer(value.audio) ? value.audio : undefined;
}

async function runExternalVoicePlugin(input: {
  text: string;
  voice?: string;
  voiceId?: string;
  format?: TtsFormat;
}): Promise<Buffer | undefined> {
  if (!FF.voicePluginEnabled) return undefined;
  const plugin = aiPlugins.getBest("voice");
  if (!plugin || plugin.id === "voice-openai-tts") return undefined;
  const output = await plugin.execute(input);
  return readVoicePluginAudio(output);
}

/**
 * Detect audio format from buffer magic bytes.
 * Supports: WAV, MP3, WebM (Chrome/Firefox), MP4/M4A/MOV (Safari/iOS), OGG
 */
export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";

  // WAV: RIFF....WAVE
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "wav";
  }
  // WebM: EBML header
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  // MP3: ID3 tag or frame sync
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return "mp3";
  }
  // MP4/M4A/MOV: ....ftyp (Safari/iOS records in these containers)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "mp4";
  }
  // OGG: OggS
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return "ogg";
  }
  return "unknown";
}

/**
 * Convert any audio/video format to WAV using ffmpeg.
 */
export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);

  try {
    await writeFile(inputPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-vn",
        "-f", "wav",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        outputPath,
      ]);

      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Auto-detect and convert audio to OpenAI-compatible format.
 */
export async function ensureCompatibleFormat(
  audioBuffer: Buffer
): Promise<{ buffer: Buffer; format: "wav" | "mp3" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  const wavBuffer = await convertToWav(audioBuffer);
  return { buffer: wavBuffer, format: "wav" };
}

/** Voice Chat: audio-in, audio-out using gpt-audio. */
export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  assertOpenAIConfig();
  const audioBase64 = audioBuffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: outputFormat },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
  });
  const message = response.choices[0]?.message;
  const audio = readAudioPayload(message);
  const transcript = audio.transcript || readMessageText(message);
  const audioData = audio.data ?? "";
  return {
    transcript,
    audioResponse: Buffer.from(audioData, "base64"),
  };
}

/** Streaming Voice Chat for real-time audio responses. */
export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  assertOpenAIConfig();
  const audioBase64 = audioBuffer.toString("base64");
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const audio = readAudioPayload(chunk.choices?.[0]?.delta);
      if (audio.transcript) {
        yield { type: "transcript", data: audio.transcript };
      }
      if (audio.data) {
        yield { type: "audio", data: audio.data };
      }
    }
  })();
}

/** Text-to-Speech using gpt-audio. */
export async function textToSpeech(
  text: string,
  voice: OpenAIVoice = "alloy",
  format: TtsFormat = "wav"
): Promise<Buffer> {
  const pluginAudio = await runExternalVoicePlugin({ text, voice, format });
  if (pluginAudio) return pluginAudio;
  return textToSpeechNativeOpenAI(text, voice, format);
}

/** Native OpenAI TTS fallback. Plugin adapters call this to avoid registry recursion. */
export async function textToSpeechNativeOpenAI(
  text: string,
  voice: OpenAIVoice = "alloy",
  format: TtsFormat = "wav"
): Promise<Buffer> {
  assertOpenAIConfig();
  const response = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
  });
  const audioData = readAudioPayload(response.choices[0]?.message).data ?? "";
  return Buffer.from(audioData, "base64");
}

/** Streaming Text-to-Speech. */
export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"
): Promise<AsyncIterable<string>> {
  assertOpenAIConfig();
  const stream = await openai.chat.completions.create({
    model: "gpt-audio",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const audio = readAudioPayload(chunk.choices?.[0]?.delta);
      if (audio.data) {
        yield audio.data;
      }
    }
  })();
}

/** Wendy TTS — OpenAI gpt-4o-mini-tts with voice style instructions. */
export async function wendyTextToSpeech(
  text: string,
  voice: OpenAIVoice = "nova",
  responseFormat: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm16" = "opus",
  instructions?: string,
): Promise<Buffer> {
  const pluginInput: {
    text: string;
    voice: OpenAIVoice;
    voiceId?: string;
    format: "mp3";
  } = {
    text: instructions ? `${instructions}\n\n${text}` : text,
    voice,
    format: "mp3",
  };
  const wendyVoiceId = process.env.ELEVENLABS_WENDY_VOICE_ID ?? process.env.ELEVENLABS_VOICE_ID;
  if (wendyVoiceId) pluginInput.voiceId = wendyVoiceId;
  const pluginAudio = await runExternalVoicePlugin(pluginInput);
  if (pluginAudio) return pluginAudio;

  assertOpenAIConfig();
  const styleInstructions =
    instructions ??
    "Parla in italiano con una voce femminile giovane, tono elegante e professionale ma amichevole. " +
    "Ritmo moderato, articolazione chiara, niente enfasi teatrale. " +
    "Sii rassicurante e concreta, con un sorriso nella voce, come una career coach che si prende davvero cura della persona.";

  const response = await pRetry(
    () => openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      instructions: styleInstructions,
      response_format: (responseFormat === "pcm16" ? "pcm" : responseFormat) as "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm",
    }),
    {
      retries: 1,
      onFailedAttempt: (err) => {
        logger.warn({ err, attempt: err.attemptNumber }, "TTS retry");
      },
    },
  );

  return Buffer.from(await response.arrayBuffer());
}

/** Speech-to-Text using gpt-4o-mini-transcribe. */
export async function speechToText(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<string> {
  assertOpenAIConfig();
  const file = await toFile(audioBuffer, `audio.${format}`);
  const response = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
  });
  return response.text;
}

/** Streaming Speech-to-Text. */
export async function speechToTextStream(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<AsyncIterable<string>> {
  assertOpenAIConfig();
  const file = await toFile(audioBuffer, `audio.${format}`);
  const stream = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    stream: true,
  });

  return (async function* () {
    for await (const event of stream) {
      if (event.type === "transcript.text.delta") {
        yield event.delta;
      }
    }
  })();
}
