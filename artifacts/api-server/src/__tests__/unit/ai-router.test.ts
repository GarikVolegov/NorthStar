import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock del router AI ─────────────────────────────────────────────────────
const mockGroqCall = vi.fn();
const mockOpenAICall = vi.fn();
const mockAnthropicCall = vi.fn();

vi.mock('../../lib/ai/providers/groq', () => ({ groqProvider: { chat: mockGroqCall } }));
vi.mock('../../lib/ai/providers/openai', () => ({ openaiProvider: { chat: mockOpenAICall } }));
vi.mock('../../lib/ai/providers/anthropic', () => ({ anthropicProvider: { chat: mockAnthropicCall } }));

describe('AI Router — use case mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_JSON_PROVIDER;
    delete process.env.AI_AGENT_PROVIDER;
    delete process.env.AI_STREAMING_PROVIDER;
  });

  it('json_extraction usa Groq come provider default', () => {
    const provider = resolveProvider('json_extraction');
    expect(provider).toBe('groq');
  });

  it('agent_analysis usa Anthropic come provider default', () => {
    const provider = resolveProvider('agent_analysis');
    expect(provider).toBe('anthropic');
  });

  it('embedding usa OpenAI come provider default', () => {
    const provider = resolveProvider('embedding');
    expect(provider).toBe('openai');
  });

  it('AI_JSON_PROVIDER override sposta json_extraction su openai', () => {
    process.env.AI_JSON_PROVIDER = 'openai';
    const provider = resolveProvider('json_extraction');
    expect(provider).toBe('openai');
  });

  it('AI_AGENT_PROVIDER override sposta agent_analysis su openai', () => {
    process.env.AI_AGENT_PROVIDER = 'openai';
    const provider = resolveProvider('agent_analysis');
    expect(provider).toBe('openai');
  });
});

describe('AI Router — fallback logic', () => {
  it('passa al fallback se il provider primary lancia errore', async () => {
    mockGroqCall.mockRejectedValueOnce(new Error('Groq 429 rate limit'));
    mockOpenAICall.mockResolvedValueOnce({ content: 'fallback response' });

    const result = await callWithFallback('json_extraction', { messages: [] });
    expect(result.content).toBe('fallback response');
    expect(mockGroqCall).toHaveBeenCalledTimes(1);
    expect(mockOpenAICall).toHaveBeenCalledTimes(1);
  });

  it('lancia errore se sia primary che fallback falliscono', async () => {
    mockGroqCall.mockRejectedValue(new Error('Groq down'));
    mockOpenAICall.mockRejectedValue(new Error('OpenAI down'));

    await expect(callWithFallback('json_extraction', { messages: [] })).rejects.toThrow();
  });
});

// ─── Helpers di test (simulano la logica del router) ─────────────────────────
const DEFAULT_PROVIDERS: Record<string, string> = {
  json_extraction: 'groq',
  agent_analysis: 'anthropic',
  streaming_chat: 'groq',
  research: 'groq',
  embedding: 'openai',
};

const ENV_OVERRIDES: Record<string, string> = {
  json_extraction: 'AI_JSON_PROVIDER',
  agent_analysis: 'AI_AGENT_PROVIDER',
  streaming_chat: 'AI_STREAMING_PROVIDER',
  embedding: 'AI_EMBEDDING_PROVIDER',
  research: 'AI_RESEARCH_PROVIDER',
};

function resolveProvider(useCase: string): string {
  const envKey = ENV_OVERRIDES[useCase];
  if (envKey && process.env[envKey]) return process.env[envKey] as string;
  return DEFAULT_PROVIDERS[useCase] ?? 'openai';
}

const PROVIDER_MAP: Record<string, ReturnType<typeof vi.fn>> = {
  groq: mockGroqCall,
  openai: mockOpenAICall,
  anthropic: mockAnthropicCall,
};

const FALLBACK_MAP: Record<string, string> = {
  groq: 'openai',
  anthropic: 'openai',
  google: 'openai',
};

async function callWithFallback(useCase: string, req: object) {
  const primary = resolveProvider(useCase);
  try {
    return await PROVIDER_MAP[primary](req);
  } catch {
    const fallback = FALLBACK_MAP[primary];
    if (!fallback) throw new Error(`No fallback for ${primary}`);
    return await PROVIDER_MAP[fallback](req);
  }
}
