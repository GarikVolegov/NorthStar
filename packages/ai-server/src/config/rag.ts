import { EMBEDDING_DIMS } from "../growth-agent/embedder";

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intEnv(name: string, fallback: number): number {
  return Math.trunc(numberEnv(name, fallback));
}

export interface RagConfig {
  embeddingDims: number;
  sparseRetriever: {
    enabled:         boolean;
    topSources:      number;  // fonti selezionate al livello routing
    multiHopEnabled: boolean;
    maxHops:         number;
    expansionTerms:  number;  // termini estratti per hop di espansione
  };
  retriever: {
    defaultTopK: number;
    defaultMinScore: number;
    pgvectorTimeoutMs: number;
    jsFallbackTimeoutMs: number;
    jsPageSize: number;
    jsMaxPages: number;
    pgvectorCircuit: {
      timeoutMs: number;
      errorThresholdPercentage: number;
      resetTimeoutMs: number;
    };
  };
  chainOfThought: {
    cacheTtlMs: number;
    minWords: number;
    reuseMinConfidence: number;
    reuseMinTokenOverlap: number;
    outputMinConfidence: number;
    temperature: number;
    maxTokens: number;
  };
  memory: {
    similarityThreshold: number;
    embeddingCacheTtlMs: number;
    maxEmbeddingCacheEntries: number;
    maxMemoryRows: number;
    minPatternConfidence: number;
    maxPromptPatterns: number;
  };
  alerts: {
    windowMs: number;
    minSamples: number;
    cooldownMs: number;
    fallbackRateThreshold: number;
    emptyResultRateThreshold: number;
  };
}

export const ragConfig: RagConfig = {
  embeddingDims: intEnv("RAG_EMBEDDING_DIMS", EMBEDDING_DIMS),
  sparseRetriever: {
    enabled:         process.env.RAG_SPARSE_RETRIEVER_ENABLED !== "false",
    topSources:      intEnv("RAG_SPARSE_TOP_SOURCES", 5),
    multiHopEnabled: process.env.RAG_MULTI_HOP_ENABLED !== "false",
    maxHops:         intEnv("RAG_MULTI_HOP_MAX_HOPS", 2),
    expansionTerms:  intEnv("RAG_MULTI_HOP_EXPANSION_TERMS", 3),
  },
  retriever: {
    defaultTopK: intEnv("RAG_RETRIEVER_TOP_K", 6),
    defaultMinScore: numberEnv("RAG_RETRIEVER_MIN_SCORE", 0.35),
    pgvectorTimeoutMs: intEnv("RAG_PGVECTOR_TIMEOUT_MS", 2_000),
    jsFallbackTimeoutMs: intEnv("RAG_JS_FALLBACK_TIMEOUT_MS", 3_000),
    jsPageSize: intEnv("RAG_JS_PAGE_SIZE", 500),
    jsMaxPages: intEnv("RAG_JS_MAX_PAGES", 20),
    pgvectorCircuit: {
      timeoutMs: intEnv("RAG_PGVECTOR_CIRCUIT_TIMEOUT_MS", 2_500),
      errorThresholdPercentage: intEnv("RAG_PGVECTOR_CIRCUIT_ERROR_THRESHOLD", 50),
      resetTimeoutMs: intEnv("RAG_PGVECTOR_CIRCUIT_RESET_TIMEOUT_MS", 30_000),
    },
  },
  chainOfThought: {
    cacheTtlMs: intEnv("RAG_COT_CACHE_TTL_MS", 300_000),
    minWords: intEnv("RAG_COT_MIN_WORDS", 5),
    reuseMinConfidence: numberEnv("RAG_COT_REUSE_MIN_CONFIDENCE", 0.75),
    reuseMinTokenOverlap: numberEnv("RAG_COT_REUSE_MIN_TOKEN_OVERLAP", 0.60),
    outputMinConfidence: numberEnv("RAG_COT_OUTPUT_MIN_CONFIDENCE", 0.60),
    temperature: numberEnv("RAG_COT_TEMPERATURE", 0.3),
    maxTokens: intEnv("RAG_COT_MAX_TOKENS", 300),
  },
  memory: {
    similarityThreshold: numberEnv("RAG_MEMORY_SIMILARITY_THRESHOLD", 0.85),
    embeddingCacheTtlMs: intEnv("RAG_MEMORY_EMBEDDING_CACHE_TTL_MS", 300_000),
    maxEmbeddingCacheEntries: intEnv("RAG_MEMORY_EMBEDDING_CACHE_MAX", 500),
    maxMemoryRows: intEnv("RAG_MEMORY_MAX_ROWS", 1_000),
    minPatternConfidence: numberEnv("RAG_MEMORY_MIN_PATTERN_CONFIDENCE", 0.50),
    maxPromptPatterns: intEnv("RAG_MEMORY_MAX_PROMPT_PATTERNS", 8),
  },
  alerts: {
    windowMs: intEnv("RAG_ALERT_WINDOW_MS", 600_000),
    minSamples: intEnv("RAG_ALERT_MIN_SAMPLES", 20),
    cooldownMs: intEnv("RAG_ALERT_COOLDOWN_MS", 600_000),
    fallbackRateThreshold: numberEnv("RAG_ALERT_FALLBACK_RATE_THRESHOLD", 0.05),
    emptyResultRateThreshold: numberEnv("RAG_ALERT_EMPTY_RESULT_RATE_THRESHOLD", 0.20),
  },
};
