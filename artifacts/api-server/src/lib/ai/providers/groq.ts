/**
 * Provider Groq
 * Usa il client OpenAI puntato a https://api.groq.com/openai/v1.
 * Groq è OpenAI-compatible: stessa shape request/response.
 * Modello default: llama-3.1-70b-versatile (free tier, ~700 tok/s).
 */

import OpenAI from "openai";
import type { ChatMessage } from "../types";

let _groqClient: OpenAI | null = null;

export function createGroqClient(): OpenAI {
  if (!_groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("[ai-router] GROQ_API_KEY mancante");
    _groqClient = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return _groqClient;
}

/**
 * Streaming chat via Groq.
 * Restituisce AsyncIterable<string> (delta di testo).
 * Compatibile con il pattern useSSEStream del frontend.
 */
export async function* streamGroqChat(
  messages: ChatMessage[],
  model: string,
  temperature = 0.7,
  maxTokens = 2048
): AsyncIterable<string> {
  const client = createGroqClient();

  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * Chat non-streaming via Groq (per research job in background).
 */
export async function chatGroq(
  messages: ChatMessage[],
  model: string,
  temperature = 0.3,
  maxTokens = 4096
): Promise<string> {
  const client = createGroqClient();

  const res = await client.chat.completions.create({
    model,
    messages,
    stream: false,
    temperature,
    max_tokens: maxTokens,
  });

  return res.choices[0]?.message?.content ?? "";
}
