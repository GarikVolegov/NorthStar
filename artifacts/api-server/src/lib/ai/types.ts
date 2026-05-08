/**
 * AI Router — Contratti comuni
 * Tutti i provider devono rispettare questi tipi.
 * Il resto dell'app importa SOLO da qui e da lib/ai/index.ts.
 *
 * v2: aggiunto supporto multimodale (Vision Language Models)
 *   - MessageContent: parte testuale o immagine (url / base64)
 *   - VisionRequest: input per ai.vision()
 *   - ImageGenRequest / ImageGenResult: per ai.generateImage()
 */

export type AIProviderName = "groq" | "anthropic" | "openai" | "google";

export type AIUseCase =
  | "streaming_chat"   // Wendy SSE — priorità velocità
  | "agent_analysis"   // Agente RIASEC+Spiriti — priorità ragionamento
  | "embedding"        // knowledge nodes — OpenAI text-embedding-3-small
  | "research"         // background job news/sector
  | "json_extraction"  // CV parse, generate, tailor, cover-letter, ATS
  | "vision"           // VLM: analisi immagini / documenti strutturati
  | "image_generation"; // DALL-E / Imagen: generazione immagini

// ─── Multimodale ──────────────────────────────────────────────────────────────

/** Parte testuale di un messaggio multimodale */
export interface TextPart {
  type:  'text';
  text:  string;
}

/**
 * Parte immagine di un messaggio multimodale.
 * - url:    URL pubblico (https://) o data-URI base64 (data:image/...;base64,...)
 * - detail: 'low' | 'high' | 'auto' (OpenAI vision)
 *           'low' → 85 token fissi, veloce
 *           'high' → tile-based, più accurato per documenti/screenshot
 */
export interface ImagePart {
  type:    'image_url';
  url:     string;                        // HTTPS URL o data-URI base64
  detail?: 'low' | 'high' | 'auto';     // default 'auto'
  mimeType?: string;                     // solo per data-URI (es. 'image/png')
}

/** Contenuto di un messaggio: solo testo (legacy) o array di parti (multimodale) */
export type MessageContent = string | Array<TextPart | ImagePart>;

/** Messaggio chat — retrocompatibile: content può essere stringa o array di parti */
export interface ChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: MessageContent;
}

/** Helper: true se il contenuto contiene almeno un'immagine */
export function hasImages(content: MessageContent): boolean {
  if (typeof content === 'string') return false;
  return content.some((p) => p.type === 'image_url');
}

/** Helper: estrae tutto il testo da un content multimodale */
export function extractText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

// ─── Vision request ───────────────────────────────────────────────────────────

export interface VisionRequest {
  /**
   * Immagini da analizzare (max 5 per chiamata).
   * Ogni elemento è un URL pubblico o un data-URI base64.
   */
  images: string[];

  /** Istruzione/domanda sull'immagine */
  prompt: string;

  /**
   * Contesto conversazionale opzionale (messaggi precedenti).
   * Utile per follow-up sullo stesso documento.
   */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;

  /**
   * Provider VLM da usare.
   * default: 'openai' (gpt-4o) — miglior rapporto velocità/qualità
   * 'anthropic' (claude-3-7-sonnet-20250219) — migliore su documenti lunghi
   * 'google' (gemini-2.0-flash) — alternativa economica
   */
  provider?: 'openai' | 'anthropic' | 'google';

  /** Dettaglio analisi immagine (OpenAI): 'low' | 'high' | 'auto' */
  detail?:   'low' | 'high' | 'auto';

  /** Token massimi risposta */
  maxTokens?: number;

  /** Temperature (default 0.2 — risposte fattuali) */
  temperature?: number;

  /** Se true, esegue lo stream della risposta invece di aspettare */
  stream?: boolean;
}

export interface VisionResult {
  text:         string;
  provider:     string;
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  durationMs:   number;
}

// ─── Image generation ─────────────────────────────────────────────────────────

export interface ImageGenRequest {
  prompt:   string;

  /**
   * Modello da usare:
   *   'dall-e-3'     — alta qualità, max 1 immagine, max 1024x1024
   *   'dall-e-2'     — più economico, batch fino a 10
   *   'gpt-image-1'  — OpenAI latest (natively multimodal)
   */
  model?:   'dall-e-3' | 'dall-e-2' | 'gpt-image-1';

  size?:    '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?:   'vivid' | 'natural';

  /**
   * Numero immagini (solo DALL-E 2, max 10).
   * DALL-E 3 / gpt-image-1 supportano solo n=1.
   */
  n?: number;

  /**
   * Se 'url': ritorna URL temporaneo OpenAI (scade dopo 1h)
   * Se 'b64_json': ritorna base64 (persiste indefinitamente)
   */
  responseFormat?: 'url' | 'b64_json';
}

export interface ImageGenResult {
  images:       Array<{ url?: string; b64?: string; revisedPrompt?: string }>;
  model:        string;
  durationMs:   number;
}

// ─── Tipi legacy ─────────────────────────────────────────────────────────────

export interface AIChatRequest {
  useCase:      AIUseCase;
  messages:     ChatMessage[];  // ora supporta content multimodale
  temperature?: number;
  maxTokens?:   number;
  model?:       string;
}

export interface AIAgentRequest {
  systemPrompt: string;
  userPrompt:   string;
  tools?:       AITool[];
  temperature?: number;
  maxTokens?:   number;
}

export interface AITool {
  name:        string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AIToolCall {
  id:    string;
  name:  string;
  input: Record<string, unknown>;
}

export interface AIAgentResponse {
  text:         string | null;
  toolCalls:    AIToolCall[];
  stopReason:   'end_turn' | 'tool_use' | 'max_tokens' | string;
  inputTokens:  number;
  outputTokens: number;
}

export interface AIEmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface AIRouterConfig {
  primary:    AIProviderName;
  fallback?:  AIProviderName;
  model?:     string;
  timeoutMs?: number;
}

/** Errore normalizzato emesso dal router in caso di fallback esaurito */
export class AIRouterError extends Error {
  constructor(
    public readonly useCase:        AIUseCase,
    public readonly provider:       AIProviderName,
    public readonly originalError:  unknown,
  ) {
    super(
      `[ai-router] Provider "${provider}" failed for use case "${useCase}": ${
        originalError instanceof Error ? originalError.message : String(originalError)
      }`
    );
    this.name = 'AIRouterError';
  }
}
