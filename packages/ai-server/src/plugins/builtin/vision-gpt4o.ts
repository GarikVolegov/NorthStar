import { isRecord } from "../../utils";
import type { Buffer } from "node:buffer";
import type { AIPlugin, AIPluginHealth } from "../types";

export interface VisionGpt4oInput {
  image?: Buffer;
  pdfText?: string;
  mimeType?: "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
  prompt: string;
}

export interface VisionGpt4oOutput {
  rawText: string;
  structured: Record<string, unknown>;
}

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function isEnabled(name: string, defaultVal = false): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultVal;
  return value === "true" || value === "1";
}

function apiKey(): string | undefined {
  return process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
}

function baseUrl(): string {
  return (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}



function extractModelText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return "";
  const choices: unknown[] = payload.choices;
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return "";
  return readString(first.message.content);
}

function parseStructured(rawText: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(rawText);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text ? `Vision request failed (${response.status}): ${text}` : `Vision request failed (${response.status})`;
}

export function isVisionGpt4oAvailable(): boolean {
  return isEnabled("FF_VISION_PLUGIN", false) && Boolean(apiKey());
}

export function createVisionGpt4oPlugin(): AIPlugin<VisionGpt4oInput, VisionGpt4oOutput> {
  return {
    id: "vision-gpt4o",
    capability: "vision",
    version: "1.0.0",
    provider: "openai",

    async init(): Promise<void> {
      if (!apiKey()) {
        throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY missing for vision-gpt4o plugin");
      }
    },

    async health(): Promise<AIPluginHealth> {
      return {
        ok: Boolean(apiKey()),
        ...(apiKey() ? {} : { message: "AI_INTEGRATIONS_OPENAI_API_KEY missing" }),
      };
    },

    async execute(input: VisionGpt4oInput): Promise<VisionGpt4oOutput> {
      const key = apiKey();
      if (!key) throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY missing for vision-gpt4o plugin");

      const content: Array<Record<string, unknown>> = [
        {
          type: "text",
          text: [
            input.prompt,
            "Rispondi preferibilmente in JSON valido con campi strutturati utili.",
            input.pdfText ? `Testo PDF estratto:\n${input.pdfText.slice(0, 20000)}` : "",
          ].filter(Boolean).join("\n\n"),
        },
      ];

      if (input.image) {
        const mimeType = input.mimeType && input.mimeType !== "application/pdf" ? input.mimeType : "image/png";
        content.push({
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${input.image.toString("base64")}`,
          },
        });
      }

      const response = await fetch(`${baseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.VISION_OPENAI_MODEL ?? DEFAULT_MODEL,
          messages: [{ role: "user", content }],
          temperature: 0,
        }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));

      const rawText = extractModelText(await response.json() as unknown);
      return {
        rawText,
        structured: parseStructured(rawText),
      };
    },
  };
}

export const visionGpt4oPlugin = createVisionGpt4oPlugin();
