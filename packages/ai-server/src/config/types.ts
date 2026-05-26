export interface RouterIntentThreshold {
  base: number;
  floor: number;
}

export interface WendyRouterConfig {
  intentThresholds: Record<string, RouterIntentThreshold>;
  secondaryMinConfidence: number;
  domainHistoryBonus: number;
  historyWindowSize: number;
  shortMessageWords: number;
  shortMessagePenalty: number;
  domainMatchThreshold: number;
  emotionalMarkerPenalty: number;
  emotionalMarkers: string[];
}

export interface WendySpecialistConfig {
  maxHistory: number;
  cotHistorySlice: number;
  cotMessageTruncate: number;
  personaMinScore: number;
  documentMinScore: number;
  documentTopK: number;
  temperatureLow: number;
  temperatureHigh: number;
  maxTokensLow: number;
  maxTokensHigh: number;
  temperatureByComplexity: Record<string, number>;
  maxTokensByComplexity: Record<string, number>;
  memorySaveTimeoutMs: number;
}

export interface SupervisorWeights {
  actionability: number;
  platitudeFree: number;
  lengthOk: number;
  onTopic: number;
}

export interface WendySupervisorConfig {
  passThreshold: number;
  weightsFallback: SupervisorWeights;
  intentWeights: Record<string, SupervisorWeights>;
  lengthBrackets: Array<{ min: number; max: number; score: number }>;
  actionScoreBrackets: Array<{ minMatches: number; score: number }>;
  platitudeScoreBrackets: Array<{ maxHits: number; score: number }>;
  shortMessageWords: number;
  jaccardThresholds: { high: number; mid: number; low: number };
  shortTokenOnTopicScore: number;
  logTimeoutMs: number;
}

export interface ConfidenceLadderRung {
  minObs: number;
  confidence: number;
}

export interface WendyMemoryConfig {
  confidenceLadder: ConfidenceLadderRung[];
  extractionSliceMessages: number;
  extractionTruncateChars: number;
  extractionTemperature: number;
  extractionMaxTokens: number;
  similarityThreshold: number;
  incrementalMinScore: number;
  decayHalfLifeDays: number;
  decayArchiveThreshold: number;
  minPatternConfidence: number;
  maxPromptPatterns: number;
  maxMemoryRows: number;
  embeddingCacheTtlMs: number;
  maxEmbeddingCacheEntries: number;
}

export interface WendyAgentConfig {
  maxHistory: number;
  maxToolTurns: number;
  chunkSize: number;
  followUpMaxTokens: number;
  maxTokensLow: number;
  maxTokensHigh: number;
}

export interface WendyFastPathConfig {
  timeoutMs: number;
  maxTokens: number;
  maxToolTurns: number;
}

export interface WendyPromptConfig {
  morningHourStart: number;
  morningHourEnd: number;
  eveningHourStart: number;
  eveningHourEnd: number;
  nightHourStart: number;
  nightHourEnd: number;
  ragCitationMinScore: number;
  defaultLanguage: string;
}

export interface WendyJobPostingsConfig {
  adzunaAppId: string;
  adzunaApiKey: string;
  adzunaCountry: string;
  joobleApiKey: string;
  maxProfessionsPerRun: number;
}

export interface WendyBrainConfig {
  enabled: boolean;
  autoPromote: boolean;
  maxContextNodes: number;
}

export interface WendyConfig {
  router: WendyRouterConfig;
  specialist: WendySpecialistConfig;
  supervisor: WendySupervisorConfig;
  memory: WendyMemoryConfig;
  agent: WendyAgentConfig;
  fastPath: WendyFastPathConfig;
  prompt: WendyPromptConfig;
  jobPostings: WendyJobPostingsConfig;
  brain: WendyBrainConfig;
}

export interface WendyConfigOverride {
  key: string;
  value: unknown;
}
