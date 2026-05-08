/**
 * Provider OpenAI
 * Usato SOLO per embedding (text-embedding-3-small).
 * Se la chiave non c'è, il router usa il fallback o lancia AIRouterError.
 *
 * NON aggiungere chat/streaming qui: usare Groq o Anthropic.
 * Eccezione: fallback automatico dal router quando Groq/Anthropic fallisce.
 */

import OpenAI from "openai";
import type { ChatMessage } from "../types";

let _openaiClient: OpenAI | null = null;

export function createOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("[ai-router] OPENAI_API_KEY mancante");
    _openaiClient = new OpenAI({ apiKey });
  }
  return _openaiClient;
}

/**
 * Crea embedding vettoriali.
 * Restituisce number[][] (un vettore per ogni stringa in input).
 * Compatibile con knowledgenodes.embedding (jsonb).
 */
export async function createEmbeddings(
  input: string | string[],
  model = "text-embedding-3-small"
): Promise<number[][]> {
  const client = createOpenAIClient();

  const result = await client.embeddings.create({ model, input });
  return result.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

/**
 * Fallback: streaming chat via OpenAI.
 * Usato dal router solo se il provider primario (Groq) non è disponibile.
 */
export async function* streamOpenAIChat(
  messages: ChatMessage[],
  model = "gpt-4o-mini",
  temperature = 0.7,
  maxTokens = 2048
): AsyncIterable<string> {
  const client = createOpenAIClient();

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
 * Fallback: chat non-streaming via OpenAI.
 */
export async function chatOpenAI(
  messages: ChatMessage[],
  model = "gpt-4o-mini",
  temperature = 0.3,
  maxTokens = 4096
): Promise<string> {
  const client = createOpenAIClient();

  const res = await client.chat.completions.create({
    model,
    messages,
    stream: false,
    temperature,
    max_tokens: maxTokens,
  });

  return res.choices[0]?.message?.content ?? "";
}
