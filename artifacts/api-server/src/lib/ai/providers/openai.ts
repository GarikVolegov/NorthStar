/**
 * Provider OpenAI — v2: supporto multimodale
 *
 * Novità:
 *   - streamOpenAIChat e chatOpenAI ora accettano MessageContent
 *     (stringa pura o array di TextPart | ImagePart)
 *   - normalizeMessages(): converte il tipo interno in
 *     OpenAI.Chat.ChatCompletionMessageParam (formato nativo SDK)
 *
 * Nota architetturale:
 *   Usato come fallback per streaming_chat (se Groq giù) e come
 *   provider primario per embedding, vision e image_generation.
 */

import OpenAI from 'openai';
import type { ChatMessage, MessageContent } from '../types.js';

let _openaiClient: OpenAI | null = null;

export function createOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('[ai-router] OPENAI_API_KEY mancante');
    _openaiClient = new OpenAI({ apiKey });
  }
  return _openaiClient;
}

// ─── Normalizzatore messaggi ──────────────────────────────────────────────────────────

/**
 * Converte ChatMessage[] nel formato nativo OpenAI.
 * Gestisce sia string che array di parti (multimodale).
 */
function normalizeMessages(
  messages: ChatMessage[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      // Fast-path: solo testo (99% dei messaggi)
      return { role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam;
    }

    // Multimodale: array di parti
    const parts: OpenAI.Chat.ChatCompletionContentPart[] = m.content.map((part) => {
      if (part.type === 'text') {
        return { type: 'text', text: part.text } as OpenAI.Chat.ChatCompletionContentPartText;
      }
      // image_url
      return {
        type:      'image_url',
        image_url: {
          url:    part.url,
          detail: part.detail ?? 'auto',
        },
      } as OpenAI.Chat.ChatCompletionContentPartImage;
    });

    return { role: m.role, content: parts } as OpenAI.Chat.ChatCompletionMessageParam;
  });
}

// ─── Embedding ───────────────────────────────────────────────────────────────────

export async function createEmbeddings(
  input: string | string[],
  model = 'text-embedding-3-small',
): Promise<number[][]> {
  const client = createOpenAIClient();
  const result = await client.embeddings.create({ model, input });
  return result.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

// ─── Streaming chat (testo + multimodale) ────────────────────────────────────────

export async function* streamOpenAIChat(
  messages:    ChatMessage[],
  model       = 'gpt-4o-mini',
  temperature = 0.7,
  maxTokens   = 2048,
): AsyncIterable<string> {
  const client = createOpenAIClient();

  const stream = await client.chat.completions.create({
    model,
    messages:    normalizeMessages(messages),
    stream:      true,
    temperature,
    max_tokens:  maxTokens,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// ─── Chat non-streaming ─────────────────────────────────────────────────────────────

export async function chatOpenAI(
  messages:    ChatMessage[],
  model       = 'gpt-4o-mini',
  temperature = 0.3,
  maxTokens   = 4096,
): Promise<string> {
  const client = createOpenAIClient();

  const res = await client.chat.completions.create({
    model,
    messages:   normalizeMessages(messages),
    stream:     false,
    temperature,
    max_tokens: maxTokens,
  });

  return res.choices[0]?.message?.content ?? '';
}
