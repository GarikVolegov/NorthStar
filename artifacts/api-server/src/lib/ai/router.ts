/**
 * AI Router — Risoluzione provider per use case
 *
 * v2: aggiunto routing per 'vision' e 'image_generation'
 *
 * Default:
 *   streaming_chat   → groq        (latenza bassissima, OpenAI-compatible SSE)
 *   agent_analysis   → anthropic   (ragionamento + tool use strutturato)
 *   embedding        → openai      (text-embedding-3-small)
 *   research         → groq        (background job, bassa latenza)
 *   json_extraction  → groq        (CV parse/generate/tailor/cover-letter/ATS)
 *   vision           → openai      (gpt-4o — miglior rapporto velocità/qualità VLM)
 *   image_generation → openai      (DALL-E 3)
 *
 * Override via env (senza redeploy):
 *   AI_STREAMING_PROVIDER=openai
 *   AI_AGENT_PROVIDER=openai
 *   AI_EMBEDDING_PROVIDER=openai
 *   AI_RESEARCH_PROVIDER=openai
 *   AI_JSON_PROVIDER=openai
 *   AI_VISION_PROVIDER=anthropic    # usa Claude per documenti strutturati
 *   AI_IMGGEN_PROVIDER=openai       # solo openai supporta DALL-E
 */

import type { AIProviderName, AIUseCase, AIRouterConfig } from './types.js';

// ─── Tabelle di routing ─────────────────────────────────────────────────────────────

const DEFAULT_ROUTER: Record<AIUseCase, AIProviderName> = {
  streaming_chat:   'groq',
  agent_analysis:   'anthropic',
  embedding:        'openai',
  research:         'groq',
  json_extraction:  'groq',
  vision:           'openai',      // gpt-4o — override con anthropic per PDF
  image_generation: 'openai',      // solo openai ha DALL-E
};

const FALLBACK_ROUTER: Partial<Record<AIUseCase, AIProviderName>> = {
  streaming_chat:   'openai',
  agent_analysis:   'openai',
  research:         'openai',
  json_extraction:  'openai',
  vision:           'anthropic',   // se gpt-4o giù, usa Claude
  // embedding, image_generation: nessun fallback sensato
};

/** Modelli default per ogni provider, per ciascun use case */
const DEFAULT_MODELS: Record<AIUseCase, Partial<Record<AIProviderName, string>>> = {
  streaming_chat: {
    groq:      'llama-3.3-70b-versatile',
    openai:    'gpt-4o-mini',
    anthropic: 'claude-haiku-3-5',
    google:    'gemini-2.0-flash',
  },
  agent_analysis: {
    anthropic: 'claude-sonnet-4-5',
    openai:    'gpt-4o',
    groq:      'llama-3.1-70b-versatile',
    google:    'gemini-2.0-pro',
  },
  embedding: {
    openai:  'text-embedding-3-small',
    google:  'text-embedding-004',
    groq:    '',   // non offre embedding
    anthropic: '', // non offre embedding
  },
  research: {
    groq:      'llama-3.1-8b-instant',
    openai:    'gpt-4o-mini',
    anthropic: 'claude-haiku-3-5',
    google:    'gemini-2.0-flash',
  },
  json_extraction: {
    groq:      'llama-3.3-70b-versatile',
    openai:    'gpt-4o-mini',
    anthropic: 'claude-haiku-3-5',
    google:    'gemini-2.0-flash',
  },
  vision: {
    openai:    'gpt-4o',           // tile-based, ottimo per screenshot
    anthropic: 'claude-3-7-sonnet-20250219', // eccelle su PDF/tabelle
    google:    'gemini-2.0-flash', // economico
    groq:      '',                 // Groq non supporta vision
  },
  image_generation: {
    openai: 'dall-e-3',
    // altri provider non supportati al momento
    anthropic: '',
    google:    '',
    groq:      '',
  },
};

// ─── ENV overrides ─────────────────────────────────────────────────────────────

const VALID_PROVIDERS: AIProviderName[] = ['groq', 'anthropic', 'openai', 'google'];

function resolveEnvOverride(envKey: string): AIProviderName | undefined {
  const val = process.env[envKey]?.toLowerCase();
  if (!val) return undefined;
  if (VALID_PROVIDERS.includes(val as AIProviderName)) return val as AIProviderName;
  console.warn(`[ai-router] env ${envKey}=${val} non valido, ignorato`);
  return undefined;
}

const ENV_OVERRIDES: Partial<Record<AIUseCase, AIProviderName>> = {
  streaming_chat:   resolveEnvOverride('AI_STREAMING_PROVIDER'),
  agent_analysis:   resolveEnvOverride('AI_AGENT_PROVIDER'),
  embedding:        resolveEnvOverride('AI_EMBEDDING_PROVIDER'),
  research:         resolveEnvOverride('AI_RESEARCH_PROVIDER'),
  json_extraction:  resolveEnvOverride('AI_JSON_PROVIDER'),
  vision:           resolveEnvOverride('AI_VISION_PROVIDER'),
  image_generation: resolveEnvOverride('AI_IMGGEN_PROVIDER'),
};

// ─── Public API ─────────────────────────────────────────────────────────────────

export function resolveAIProvider(useCase: AIUseCase): AIProviderName {
  return ENV_OVERRIDES[useCase] ?? DEFAULT_ROUTER[useCase];
}

export function resolveFallbackProvider(useCase: AIUseCase): AIProviderName | undefined {
  return FALLBACK_ROUTER[useCase];
}

export function resolveAIConfig(useCase: AIUseCase): AIRouterConfig {
  const primary  = resolveAIProvider(useCase);
  const fallback = resolveFallbackProvider(useCase);

  // Usa la tabella per-use-case invece di un unico default globale
  const modelTable = DEFAULT_MODELS[useCase];
  const model = process.env.AI_MODEL_OVERRIDE ?? modelTable?.[primary] ?? '';

  // Timeout più alti per VLM (elaborazione immagini è lenta)
  const timeoutMs = useCase === 'vision' ? 60_000
                  : useCase === 'image_generation' ? 90_000
                  : 30_000;

  return { primary, fallback, model, timeoutMs };
}

/**
 * Utility: vero se il use case richiede capacità multimodali.
 * Usato dall'index.ts per scegliere il path di esecuzione corretto.
 */
export function isMultimodalUseCase(useCase: AIUseCase): boolean {
  return useCase === 'vision' || useCase === 'image_generation';
}

/**
 * Utility: vero se il provider dato supporta immagini in input.
 * Usato dall'ImageOptimizer per sapere se preprocessare.
 */
export function providerSupportsVision(provider: AIProviderName): boolean {
  return provider === 'openai' || provider === 'anthropic' || provider === 'google';
}
