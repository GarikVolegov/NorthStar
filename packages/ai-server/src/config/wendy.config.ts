import { z } from "zod/v4";
import type { WendyConfig, WendyConfigOverride } from "./types";

export type WendyEnvSource = Record<string, string | undefined>;

function numberEnv(env: WendyEnvSource, name: string, fallback: number): number {
  const raw = env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intEnv(env: WendyEnvSource, name: string, fallback: number): number {
  return Math.trunc(numberEnv(env, name, fallback));
}

const thresholdSchema = z.object({
  base: z.number(),
  floor: z.number(),
});

const weightsSchema = z.object({
  actionability: z.number(),
  platitudeFree: z.number(),
  lengthOk: z.number(),
  onTopic: z.number(),
});

export const WendyConfigSchema = z.object({
  router: z.object({
    intentThresholds: z.record(z.string(), thresholdSchema),
    secondaryMinConfidence: z.number().default(0.45),
    domainHistoryBonus: z.number().default(0.10),
    historyWindowSize: z.number().int().default(6),
    shortMessageWords: z.number().int().default(8),
    shortMessagePenalty: z.number().default(0.08),
    domainMatchThreshold: z.number().int().default(2),
    emotionalMarkerPenalty: z.number().default(0.06),
    emotionalMarkers: z.array(z.string()),
  }),
  memory: z.object({
    confidenceLadder: z.array(z.object({ minObs: z.number(), confidence: z.number() })),
    similarityThreshold: z.number().default(0.85),
    minPatternConfidence: z.number().default(0.50),
    maxPromptPatterns: z.number().int().default(8),
    extractionSliceMessages: z.number().int().default(20),
    extractionTruncateChars: z.number().int().default(300),
    extractionTemperature: z.number().default(0.1),
    extractionMaxTokens: z.number().int().default(500),
    incrementalMinScore: z.number().default(0.50),
    decayHalfLifeDays: z.number().default(90),
    decayArchiveThreshold: z.number().default(0.15),
    maxMemoryRows: z.number().int().default(1_000),
    embeddingCacheTtlMs: z.number().int().default(300_000),
    maxEmbeddingCacheEntries: z.number().int().default(500),
  }),
  supervisor: z.object({
    passThreshold: z.number().default(0.70),
    weightsFallback: weightsSchema,
    intentWeights: z.record(z.string(), weightsSchema),
    lengthBrackets: z.array(z.object({ min: z.number(), max: z.number(), score: z.number() })),
    actionScoreBrackets: z.array(z.object({ minMatches: z.number(), score: z.number() })),
    platitudeScoreBrackets: z.array(z.object({ maxHits: z.number(), score: z.number() })),
    shortMessageWords: z.number().int().default(8),
    jaccardThresholds: z.object({ high: z.number(), mid: z.number(), low: z.number() }),
    shortTokenOnTopicScore: z.number().default(0.85),
    logTimeoutMs: z.number().int().default(3_000),
  }),
  specialist: z.object({
    personaMinScore: z.number().default(0.30),
    documentMinScore: z.number().default(0.35),
    documentTopK: z.number().int().default(6),
    maxHistory: z.number().int().default(12),
    cotHistorySlice: z.number().int().default(4),
    cotMessageTruncate: z.number().int().default(200),
    temperatureLow: z.number().default(0.45),
    temperatureHigh: z.number().default(0.72),
    maxTokensLow: z.number().int().default(300),
    maxTokensHigh: z.number().int().default(700),
    temperatureByComplexity: z.record(z.string(), z.number()),
    maxTokensByComplexity: z.record(z.string(), z.number()),
    memorySaveTimeoutMs: z.number().int().default(8_000),
  }),
  agent: z.object({
    maxToolTurns: z.number().int().default(3),
    fastPathTimeoutMs: z.number().int().default(8_000).optional(),
    maxHistoryMessages: z.number().int().default(12).optional(),
    maxHistory: z.number().int().default(12),
    chunkSize: z.number().int().default(4),
    followUpMaxTokens: z.number().int().default(700),
    maxTokensLow: z.number().int().default(300),
    maxTokensHigh: z.number().int().default(600),
  }),
  fastPath: z.object({
    timeoutMs: z.number().int().default(8_000),
    maxTokens: z.number().int().default(400),
    maxToolTurns: z.number().int().default(3),
  }),
  prompt: z.object({
    morningHourStart: z.number().int().default(6),
    morningHourEnd: z.number().int().default(10),
    eveningHourStart: z.number().int().default(20),
    eveningHourEnd: z.number().int().default(23),
    nightHourStart: z.number().int().default(23),
    nightHourEnd: z.number().int().default(5),
    ragCitationMinScore: z.number().default(0.70),
    defaultLanguage: z.string().default("italiano"),
  }),
  jobPostings: z.object({
    adzunaAppId: z.string().default(""),
    adzunaApiKey: z.string().default(""),
    adzunaCountry: z.string().default("it"),
    joobleApiKey: z.string().default(""),
    maxProfessionsPerRun: z.number().int().default(50),
  }),
});

function baseConfig(env: WendyEnvSource): WendyConfig {
  const temperatureLow = numberEnv(env, "WENDY_SPECIALIST_TEMP_LOW", 0.45);
  const temperatureHigh = numberEnv(env, "WENDY_SPECIALIST_TEMP_HIGH", 0.72);
  const maxTokensLow = intEnv(env, "WENDY_SPECIALIST_MAX_TOKENS_LOW", 300);
  const maxTokensHigh = intEnv(env, "WENDY_SPECIALIST_MAX_TOKENS_HIGH", 700);

  return {
    router: {
      intentThresholds: {
        vent: { base: numberEnv(env, "WENDY_ROUTER_VENT_BASE", 0.50), floor: numberEnv(env, "WENDY_ROUTER_VENT_FLOOR", 0.28) },
        reflect: { base: numberEnv(env, "WENDY_ROUTER_REFLECT_BASE", 0.50), floor: numberEnv(env, "WENDY_ROUTER_REFLECT_FLOOR", 0.28) },
        ask_info: { base: numberEnv(env, "WENDY_ROUTER_ASK_INFO_BASE", 0.60), floor: numberEnv(env, "WENDY_ROUTER_ASK_INFO_FLOOR", 0.40) },
        explore: { base: numberEnv(env, "WENDY_ROUTER_EXPLORE_BASE", 0.60), floor: numberEnv(env, "WENDY_ROUTER_EXPLORE_FLOOR", 0.40) },
        problem_solve: { base: numberEnv(env, "WENDY_ROUTER_PROBLEM_SOLVE_BASE", 0.65), floor: numberEnv(env, "WENDY_ROUTER_PROBLEM_SOLVE_FLOOR", 0.45) },
        plan: { base: numberEnv(env, "WENDY_ROUTER_PLAN_BASE", 0.70), floor: numberEnv(env, "WENDY_ROUTER_PLAN_FLOOR", 0.50) },
      },
      secondaryMinConfidence: numberEnv(env, "WENDY_ROUTER_SECONDARY_MIN_CONFIDENCE", 0.45),
      domainHistoryBonus: numberEnv(env, "WENDY_ROUTER_DOMAIN_HISTORY_BONUS", 0.10),
      historyWindowSize: intEnv(env, "WENDY_ROUTER_HISTORY_WINDOW", 6),
      shortMessageWords: intEnv(env, "WENDY_ROUTER_SHORT_MSG_WORDS", 8),
      shortMessagePenalty: numberEnv(env, "WENDY_ROUTER_SHORT_MSG_PENALTY", 0.08),
      domainMatchThreshold: intEnv(env, "WENDY_ROUTER_DOMAIN_MATCH_THRESHOLD", 2),
      emotionalMarkerPenalty: numberEnv(env, "WENDY_ROUTER_EMOTIONAL_PENALTY", 0.06),
      emotionalMarkers: ["non ce la faccio", "sono stanco", "frustrante", "esausto", "bloccato", "paura"],
    },
    specialist: {
      maxHistory: intEnv(env, "WENDY_SPECIALIST_MAX_HISTORY", 12),
      cotHistorySlice: intEnv(env, "WENDY_SPECIALIST_COT_HISTORY_SLICE", 4),
      cotMessageTruncate: intEnv(env, "WENDY_SPECIALIST_COT_MSG_TRUNCATE", 200),
      personaMinScore: numberEnv(env, "WENDY_SPECIALIST_PERSONA_MIN_SCORE", 0.30),
      documentMinScore: numberEnv(env, "WENDY_SPECIALIST_DOC_MIN_SCORE", 0.35),
      documentTopK: intEnv(env, "WENDY_SPECIALIST_DOC_TOP_K", 6),
      temperatureLow,
      temperatureHigh,
      maxTokensLow,
      maxTokensHigh,
      temperatureByComplexity: { low: temperatureLow, high: temperatureHigh },
      maxTokensByComplexity: { low: maxTokensLow, high: maxTokensHigh },
      memorySaveTimeoutMs: intEnv(env, "WENDY_SPECIALIST_MEMORY_SAVE_TIMEOUT", 8_000),
    },
    supervisor: {
      passThreshold: numberEnv(env, "WENDY_SUPERVISOR_PASS_THRESHOLD", 0.70),
      weightsFallback: {
        actionability: numberEnv(env, "WENDY_SUPERVISOR_W_ACTION", 0.35),
        platitudeFree: numberEnv(env, "WENDY_SUPERVISOR_W_PLATITUDE", 0.25),
        lengthOk: numberEnv(env, "WENDY_SUPERVISOR_W_LENGTH", 0.20),
        onTopic: numberEnv(env, "WENDY_SUPERVISOR_W_ONTOPIC", 0.20),
      },
      intentWeights: {
        plan: { actionability: 0.45, platitudeFree: 0.25, lengthOk: 0.15, onTopic: 0.15 },
        problem_solve: { actionability: 0.40, platitudeFree: 0.25, lengthOk: 0.20, onTopic: 0.15 },
        explore: { actionability: 0.20, platitudeFree: 0.30, lengthOk: 0.25, onTopic: 0.25 },
        reflect: { actionability: 0.05, platitudeFree: 0.35, lengthOk: 0.30, onTopic: 0.30 },
        vent: { actionability: 0.00, platitudeFree: 0.40, lengthOk: 0.30, onTopic: 0.30 },
        ask_info: { actionability: 0.10, platitudeFree: 0.20, lengthOk: 0.25, onTopic: 0.45 },
      },
      lengthBrackets: [
        { min: 80, max: 280, score: 1.00 },
        { min: 60, max: 380, score: 0.75 },
        { min: 0, max: 59, score: 0.30 },
        { min: 381, max: 1_000_000, score: 0.50 },
      ],
      actionScoreBrackets: [
        { minMatches: 3, score: 1.00 },
        { minMatches: 2, score: 0.80 },
        { minMatches: 1, score: 0.50 },
        { minMatches: 0, score: 0.10 },
      ],
      platitudeScoreBrackets: [
        { maxHits: 0, score: 1.00 },
        { maxHits: 1, score: 0.60 },
        { maxHits: 2, score: 0.30 },
        { maxHits: 1_000_000, score: 0.00 },
      ],
      shortMessageWords: intEnv(env, "WENDY_SUPERVISOR_SHORT_MSG_WORDS", 8),
      jaccardThresholds: {
        high: numberEnv(env, "WENDY_SUPERVISOR_JACCARD_HIGH", 0.12),
        mid: numberEnv(env, "WENDY_SUPERVISOR_JACCARD_MID", 0.07),
        low: numberEnv(env, "WENDY_SUPERVISOR_JACCARD_LOW", 0.04),
      },
      shortTokenOnTopicScore: numberEnv(env, "WENDY_SUPERVISOR_SHORT_TOKEN_SCORE", 0.85),
      logTimeoutMs: intEnv(env, "WENDY_SUPERVISOR_LOG_TIMEOUT_MS", 3_000),
    },
    memory: {
      confidenceLadder: [
        { minObs: 4, confidence: 0.90 },
        { minObs: 3, confidence: 0.80 },
        { minObs: 2, confidence: 0.65 },
        { minObs: 1, confidence: 0.50 },
      ],
      extractionSliceMessages: intEnv(env, "WENDY_MEMORY_EXTRACT_SLICE", 20),
      extractionTruncateChars: intEnv(env, "WENDY_MEMORY_EXTRACT_TRUNCATE", 300),
      extractionTemperature: numberEnv(env, "WENDY_MEMORY_EXTRACT_TEMPERATURE", 0.1),
      extractionMaxTokens: intEnv(env, "WENDY_MEMORY_EXTRACT_MAX_TOKENS", 500),
      similarityThreshold: numberEnv(env, "WENDY_MEMORY_SIMILARITY_THRESHOLD", 0.85),
      incrementalMinScore: numberEnv(env, "WENDY_MEMORY_INCREMENTAL_MIN_SCORE", 0.50),
      decayHalfLifeDays: numberEnv(env, "WENDY_MEMORY_DECAY_HALF_LIFE_DAYS", 90),
      decayArchiveThreshold: numberEnv(env, "WENDY_MEMORY_DECAY_ARCHIVE_THRESHOLD", 0.15),
      minPatternConfidence: numberEnv(env, "WENDY_MEMORY_MIN_PATTERN_CONFIDENCE", 0.50),
      maxPromptPatterns: intEnv(env, "WENDY_MEMORY_MAX_PROMPT_PATTERNS", 8),
      maxMemoryRows: intEnv(env, "WENDY_MEMORY_MAX_ROWS", 1_000),
      embeddingCacheTtlMs: intEnv(env, "WENDY_MEMORY_EMBEDDING_CACHE_TTL_MS", 300_000),
      maxEmbeddingCacheEntries: intEnv(env, "WENDY_MEMORY_EMBEDDING_CACHE_MAX", 500),
    },
    agent: {
      maxHistory: intEnv(env, "WENDY_AGENT_MAX_HISTORY", 12),
      maxToolTurns: intEnv(env, "WENDY_AGENT_MAX_TOOL_TURNS", 3),
      chunkSize: intEnv(env, "WENDY_AGENT_CHUNK_SIZE", 4),
      followUpMaxTokens: intEnv(env, "WENDY_AGENT_FOLLOW_UP_MAX_TOKENS", 700),
      maxTokensLow: intEnv(env, "WENDY_AGENT_MAX_TOKENS_LOW", 300),
      maxTokensHigh: intEnv(env, "WENDY_AGENT_MAX_TOKENS_HIGH", 600),
    },
    fastPath: {
      timeoutMs: intEnv(env, "WENDY_FAST_PATH_TIMEOUT_MS", 8_000),
      maxTokens: intEnv(env, "WENDY_FAST_PATH_MAX_TOKENS", 400),
      maxToolTurns: intEnv(env, "WENDY_FAST_PATH_MAX_TOOL_TURNS", 3),
    },
    prompt: {
      morningHourStart: intEnv(env, "WENDY_PROMPT_MORNING_START", 6),
      morningHourEnd: intEnv(env, "WENDY_PROMPT_MORNING_END", 10),
      eveningHourStart: intEnv(env, "WENDY_PROMPT_EVENING_START", 20),
      eveningHourEnd: intEnv(env, "WENDY_PROMPT_EVENING_END", 23),
      nightHourStart: intEnv(env, "WENDY_PROMPT_NIGHT_START", 23),
      nightHourEnd: intEnv(env, "WENDY_PROMPT_NIGHT_END", 5),
      ragCitationMinScore: numberEnv(env, "WENDY_PROMPT_RAG_CITATION_MIN", 0.70),
      defaultLanguage: env.WENDY_PROMPT_DEFAULT_LANGUAGE ?? "italiano",
    },
    jobPostings: {
      adzunaAppId: env.ADZUNA_APP_ID ?? "",
      adzunaApiKey: env.ADZUNA_API_KEY ?? "",
      adzunaCountry: env.ADZUNA_COUNTRY ?? "it",
      joobleApiKey: env.JOOBLE_API_KEY ?? "",
      maxProfessionsPerRun: intEnv(env, "JOB_POSTINGS_MAX_PROFESSIONS", 50),
    },
  };
}

export function parseEnvConfig(env: WendyEnvSource = process.env): WendyConfig {
  return WendyConfigSchema.parse(baseConfig(env)) as WendyConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, overlay: unknown): unknown {
  if (!isRecord(base) || !isRecord(overlay)) return overlay;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    merged[key] = key in merged ? deepMerge(merged[key], value) : value;
  }
  return merged;
}

function setAtPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;

  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!isRecord(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }

  const last = parts.at(-1);
  if (last) cursor[last] = value;
}

export function applyConfigOverrides(
  base: WendyConfig,
  overrides: WendyConfigOverride[],
): WendyConfig {
  let merged = structuredClone(base) as unknown as Record<string, unknown>;

  for (const override of overrides) {
    if (override.key === "config") {
      merged = deepMerge(merged, override.value) as Record<string, unknown>;
    } else {
      setAtPath(merged, override.key, override.value);
    }
  }

  return WendyConfigSchema.parse(merged) as WendyConfig;
}
