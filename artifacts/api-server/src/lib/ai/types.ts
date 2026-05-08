/**
 * AI Router — Contratti comuni
 * Tutti i provider devono rispettare questi tipi.
 * Il resto dell'app importa SOLO da qui e da lib/ai/index.ts.
 */

export type AIProviderName = "groq" | "anthropic" | "openai" | "google";

export type AIUseCase =
  | "streaming_chat"   // Wiki AI, coach SSE — priorità velocità
  | "agent_analysis"  // Agente RIASEC+Spiriti — priorità qualità ragionamento
  | "embedding"       // knowledgenodes — OpenAI text-embedding-3-small
  | "research"        // background job news/sector — bassa latenza
  | "json_extraction"; // CV parse, generate, tailor, cover-letter, ATS score

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIChatRequest {
  useCase: AIUseCase;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Override puntuale del modello (opzionale, usa il default del provider) */
  model?: string;
}

export interface AIAgentRequest {
  systemPrompt: string;
  userPrompt: string;
  tools?: AITool[];
  temperature?: number;
  maxTokens?: number;
}

export interface AITool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIAgentResponse {
  text: string | null;
  toolCalls: AIToolCall[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIEmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface AIRouterConfig {
  primary: AIProviderName;
  fallback?: AIProviderName;
  model?: string;
  timeoutMs?: number;
}

/** Errore normalizzato emesso dal router in caso di fallback esaurito */
export class AIRouterError extends Error {
  constructor(
    public readonly useCase: AIUseCase,
    public readonly provider: AIProviderName,
    public readonly originalError: unknown
  ) {
    super(
      `[ai-router] Provider "${provider}" failed for use case "${useCase}": ${
        originalError instanceof Error ? originalError.message : String(originalError)
      }`
    );
    this.name = "AIRouterError";
  }
}
