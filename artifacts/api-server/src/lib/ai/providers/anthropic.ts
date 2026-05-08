/**
 * Provider Anthropic — v2: supporto multimodale
 *
 * Novità:
 *   - normalizeAnthropicMessages(): converte MessageContent
 *     nel formato nativo Anthropic (array di ContentBlock)
 *   - Supporta URL pubblici (source.type='url') e data-URI base64
 *   - streamAnthropicChat aggiornato per passare i messaggi normalizzati
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, MessageContent } from '../types.js';
import type { AIAgentRequest, AIAgentResponse } from '../types.js';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('[ai-router] ANTHROPIC_API_KEY mancante');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

// ─── Normalizzatore messaggi ──────────────────────────────────────────────────────────

type AnthropicMessage = Anthropic.MessageParam;

function contentToAnthropic(
  content: MessageContent,
): string | Anthropic.ContentBlockParam[] {
  if (typeof content === 'string') return content;

  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text } as Anthropic.TextBlockParam;
    }

    // image_url: Anthropic usa source.type='url' o source.type='base64'
    if (part.url.startsWith('data:image/')) {
      const mimeMatch  = part.url.match(/^data:([^;]+);base64,/);
      const mediaType  = (mimeMatch?.[1] ?? 'image/jpeg') as
        'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const base64Data = part.url.split(',')[1] ?? '';
      return {
        type:   'image',
        source: { type: 'base64', media_type: mediaType, data: base64Data },
      } as Anthropic.ImageBlockParam;
    }

    // URL pubblico (https://)
    return {
      type:   'image',
      source: { type: 'url', url: part.url } as Anthropic.URLImageSource,
    } as Anthropic.ImageBlockParam;
  });
}

function normalizeAnthropicMessages(
  messages: ChatMessage[],
): { systemPrompt: string; userMessages: AnthropicMessage[] } {
  let systemPrompt = '';
  const userMessages: AnthropicMessage[] = [];

  for (const m of messages) {
    if (m.role === 'system') {
      // Anthropic gestisce system come campo separato
      systemPrompt = typeof m.content === 'string' ? m.content : '';
      continue;
    }
    userMessages.push({
      role:    m.role as 'user' | 'assistant',
      content: contentToAnthropic(m.content),
    });
  }

  return { systemPrompt, userMessages };
}

// ─── Streaming chat ─────────────────────────────────────────────────────────────────

export async function* streamAnthropicChat(
  messages:     ChatMessage[],
  _legacySystem: string = '',  // mantenuto per retrocompatibilità, ignorato se già in messages
  model         = 'claude-sonnet-4-5',
  maxTokens     = 2048,
): AsyncIterable<string> {
  const client = getClient();
  const { systemPrompt, userMessages } = normalizeAnthropicMessages(messages);

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system:     systemPrompt || _legacySystem || undefined,
    messages:   userMessages,
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

// ─── analyzeWithAnthropic (usato da ai/index.ts per agent_analysis) ─────────────────

export async function analyzeWithAnthropic(
  request: AIAgentRequest,
  model   = 'claude-sonnet-4-5',
): Promise<AIAgentResponse> {
  const client = getClient();

  const anthropicTools: Anthropic.Tool[] | undefined = request.tools?.map((t) => ({
    name:         t.name,
    description:  t.description,
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }));

  const response = await client.messages.create({
    model,
    max_tokens:  request.maxTokens ?? 4096,
    system:      request.systemPrompt,
    messages:    [{ role: 'user', content: request.userPrompt }],
    ...(anthropicTools?.length ? { tools: anthropicTools } : {}),
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const toolCalls = response.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

  return {
    text:         text || null,
    toolCalls,
    stopReason:   response.stop_reason ?? 'end_turn',
    inputTokens:  response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
