// Knowledge Graph ML
export { suggestAutoLinks } from "./knowledge/auto-link";
export type { AutoLinkSuggestion, KnowledgeNodeBrief } from "./knowledge/auto-link";
export { autoCategorize } from "./knowledge/auto-categorize";
export { suggestMissingNodes } from "./knowledge/suggest-nodes";
export type { NodeSuggestion } from "./knowledge/suggest-nodes";

// Wiki ML
export { streamWikiResponse } from "./wiki/chat";
export type { WikiContext, WikiStreamEvent } from "./wiki/chat";
export { suggestFollowUpQuestions } from "./wiki/suggest-questions";

// Interview ML
export { generateQuestions } from "./interview/generate";
export type { InterviewQuestion } from "./interview/generate";
export { evaluateAnswer } from "./interview/evaluate";
export type { AnswerEvaluation } from "./interview/evaluate";
export { adaptDifficulty } from "./interview/adapt";
export type { DifficultyLevel } from "./interview/adapt";

export { runGrowthAgent } from "./growth-agent/agent";
export { loadMemory, buildMemorySection } from "./growth-agent/memory-manager";
export { recordQualityEvent, recordUserFeedback } from "./growth-agent/quality-tracker";
export { ingestText, ingestPersonaExample, ingestUrl } from "./growth-agent/ingest";
export { retrieve } from "./growth-agent/retriever";
export { ingestUserMemoryGraph, searchMemoryGraph, getMemoryGraphHealth } from "./memory-graph";
export type { MemoryGraphSearchResponse, MemoryGraphSearchResult } from "./memory-graph";
export { searchWeb } from "./growth-agent/web-search";
export {
  buildWendyBrainContextSection,
  buildWendyBrainSkillPrompt,
  normalizeBrainTitle,
  promoteWendyBrainCandidate,
  recordWendyBrainEvent,
  runWendyBrainOptimizer,
  sanitizeBrainText,
  searchWendyBrain,
} from "./wendy-brain";
export type { WendyBrainEventInput, WendyBrainHit, WendyBrainSearchOptions } from "./wendy-brain";
export { buildSystemPrompt } from "./growth-agent/prompt-builder";
export type { UserContext } from "./growth-agent/prompt-builder";
export type { RetrievedChunk } from "./growth-agent/retriever";
export type { IngestOptions, IngestResult, SourceType } from "./growth-agent/ingest";
export type { GrowthAgentOptions, ChatMessage } from "./growth-agent/agent";

// Multi-agent
export { routerAgent, RouterAgent } from "./growth-agent/router-agent";
export type { RouteDecision, Domain, Intent } from "./growth-agent/router-agent";
export { getSpecialist, registerSpecialist, SpecialistAgent } from "./growth-agent/specialist-agent";

// Supervisor
export { supervisorAgent, SupervisorAgent } from "./growth-agent/supervisor-agent";
export type { SupervisorResult, SupervisorDimensions } from "./growth-agent/supervisor-agent";

// Observability
export { logger, type LoggerFields } from "./logger";
// Memory 2.0
export { extractMemoryIncremental } from "./growth-agent/memory-manager";
export type { QualityEvent } from "./growth-agent/quality-tracker";
export { searchMemory, buildContextualMemorySection } from "./growth-agent/memory-search";
export type { MemoryHit, MemoryHitType } from "./growth-agent/memory-search";
export { runMemoryDecayJob, computeDecayScore } from "./jobs/memory-decay";
export { runQualityOptimizer, runQualityOptimizerJob } from "./jobs/quality-optimizer";
// Phase 5: Plugin Tool Registry
export { toolRegistry } from "./tools/registry";
export type { Domain as ToolDomain, PluginToolDefinition, PluginParam, PluginToolContext, ToolDefinition as PluginToolDefinitionStrict } from "./tools/types";
export { toOpenAITool } from "./tools/types";

export { wendyRequestsTotal, wendyLatencySeconds, wendySupervisorRewritesTotal, wendyLlmTokensTotal, wendyErrorsTotal, wendyToolCallsTotal, wendyToolCallDuration, wendyCostUsdTotal, wendyQualityScore, wendyTtftSeconds, wendyFeedbackTotal, wendyModelEffectiveness, recordRequest, recordError, recordSupervisorRewrite, recordLlmTokens, recordToolCall, recordWendyCost, recordQualityScore, recordTtft, recordFeedback, recordModelEffectiveness, getMetricsContentType, getMetrics, getRagMetricsSummary, register } from "./metrics";

// Feature flags
export { FF } from "./feature-flags";

// Cost tracking & model routing
export { recordLlmUsage, estimateTokens, estimateCost, getProvider, MODEL_PRICING } from "./cost-tracking";
export type { ModelPricing } from "./cost-tracking";
export { selectModel, selectModelFor, modelFor, getModelRoutingPolicy } from "./model-router";
export type { RouterOptions, ModelRoute, RequestComplexity, AgentRole } from "./model-router";

// Search Router
export { routeQuery } from "./search-router/router";
export type { RouterInput, RouterOutput } from "./search-router/router";

// Discovery Agents
export { runCollector } from "./discovery-agent/collector-agent";
export type { CollectorResult, RunCollectorOptions } from "./discovery-agent/collector-agent";
export { runEnricher } from "./discovery-agent/enricher-agent";
export type { EnricherResult } from "./discovery-agent/enricher-agent";
export { runNewsPublisher } from "./discovery-agent/news-publisher";
export { PUBLIC_NEWS_SOURCES, isPublicNewsArticleSource, isPublishableDiscoveryNews } from "./discovery-agent/news-policy";
export { getOpenAIFallbackConfig, shouldFallbackToOpenAI } from "./client";
export type { NewsPublisherResult } from "./discovery-agent/news-publisher";
export { runGrowthLibraryAgent } from "./discovery-agent/growth-library-agent";
export type { GrowthLibraryResult, GrowthGap } from "./discovery-agent/growth-library-agent";
export { runJobPostingsAgent } from "./discovery-agent/job-postings-agent";
export type { JobPostingsAgentResult } from "./discovery-agent/job-postings-agent";
export { getPersonalizedFeed, invalidateUserFeedCache } from "./discovery-agent/personalizer-agent";

// Embeddings
export { generateEmbedding, generateEmbeddingsBatch, buildEmbeddingText } from "./embeddings/generate";
export { embedText as probeEmbedding, getEmbedderHealthSnapshot } from "./growth-agent/embedder";
export type { EmbedderHealthSnapshot } from "./growth-agent/embedder";

// Search Orchestrator
export { runSearchOrchestrator } from "./search-agent/orchestrator";
export type { SearchOrchestratorOptions, SearchOrchestratorEvent, SearchResult as OrchestratorSearchResult } from "./search-agent/orchestrator";

// Wendy Router — tool schemas
export type {
  ToolError, OpenViewInput, SetFiltersInput, GetSectorDetailInput, ListSectorsInput,
  GetProfessionDetailInput, SearchProfessionsInput, CompareSectorsInput, GetMarketTrendInput,
  GetUserObjectivesInput, SaveObjectiveInput, UpdateObjectiveProgressInput,
  GetGrowthArticlesInput, GetNewsSummaryInput, GetLearningPathsInput,
  SaveBusinessIdeaInput, AddCalendarEventInput, GetUserContextInput,
  GetUserContextOutput,
} from "./wendy-router/tool-schemas";

// Wendy Router — handlers
export { executeToolCall }   from "./wendy-router/tool-handlers";
export { classifyIntent }    from "./wendy-router/intent-classifier";
export { getToolsForIntent, toolsToOpenAIFormat } from "./wendy-router/tool-registry";
export { resolveWendyRoute } from "./wendy-router/router";
export { buildLightPrompt }  from "./wendy-router/light-prompt";
export { getLocalWendyReply, getLocalWendyFallbackReply, isLocalWendyReplyMessage } from "./wendy-router/local-reply";
export type { WendyIntent, WendyPageContext, CompressedHistory, WendyRouterDecision, ToolDefinition } from "./wendy-router/types";

// Config
export { ensureWendyConfigFresh, getWendyConfig, loadConfig, refreshWendyConfig, wendyConfig } from "./config/wendy";
export type { WendyConfig, WendyRouterConfig, WendySpecialistConfig, WendySupervisorConfig, WendyMemoryConfig, WendyAgentConfig, WendyFastPathConfig, WendyPromptConfig, WendyJobPostingsConfig } from "./config/wendy";

// AI Request Log
export { recordAiCall }      from "./ai-request-log";
export type { RecordAiCallInput, AiRequestStatus, AiResponseCategory } from "./ai-request-log";

// Security Agent
export { runSecurityAgent } from "./security-agent/index";
export type { SecurityScanOptions, SecurityAgentEvent, SecurityFinding, Severity, VulnCategory } from "./security-agent/index";

// Sector Data Agent
export { runSectorDataAgent } from "./sector-data-agent/agent";
export type { SectorDataResult } from "./sector-data-agent/agent";

// LLM client (per uso diretto in route server)
export { getLLM, getLLMForRoute, resetLLM } from "./llm/client";
export type { LLMProvider, LLMMessage, LLMConfig, ToolCall, ChatWithToolsResult, ToolDefinitionOpenAI } from "./llm/client";

// AI Plugin Protocol
export { aiPlugins } from "./plugins/registry";
export { initAIPlugins } from "./plugins/bootstrap";
export type { AIPlugin, AICapability, AIPluginHealth, AIPluginSnapshot } from "./plugins/types";
export { createMemoryMem0Plugin, isMemoryMem0Available, memoryMem0Plugin } from "./plugins/builtin/memory-mem0";
export type { MemoryMem0Input, MemoryMem0Output, SemanticMemoryResult, SemanticMemoryTurn } from "./plugins/builtin/memory-mem0";
export { createVoiceElevenLabsPlugin, isVoiceElevenLabsAvailable, voiceElevenLabsPlugin } from "./plugins/builtin/voice-elevenlabs";
export type { ElevenLabsVoiceInput, ElevenLabsVoiceOutput } from "./plugins/builtin/voice-elevenlabs";
export { createVisionGpt4oPlugin, isVisionGpt4oAvailable, visionGpt4oPlugin } from "./plugins/builtin/vision-gpt4o";
export type { VisionGpt4oInput, VisionGpt4oOutput } from "./plugins/builtin/vision-gpt4o";

// Feature Protocol
export {
  BUILTIN_FEATURE_MANIFESTS,
  calendarFeatureManifest,
  featureManifests,
  getFeatureManifest,
  listFeatureManifests,
  listWendyToolsFromFeatures,
  objectivesFeatureManifest,
  profileFeatureManifest,
  registerFeatureManifest,
  resetFeatureManifests,
  sectorsFeatureManifest,
  validateFeatureManifest,
  validateWendyToolContract,
} from "./feature-protocol";
export type {
  FeatureApiRoute,
  FeatureAuth,
  FeatureHttpMethod,
  FeatureManifest,
  FeatureOwner,
  FeatureProtocolCoverage,
  FeatureStatus,
  FeatureValidationResult,
  FeatureWebRoute,
  FeatureWendyTool,
  RegisteredWendyTool,
  WendyToolPolicy,
  WendyToolRisk,
} from "./feature-protocol";

// Model catalog (auto-update-ready, plugin-aware router companion)
export {
  getCatalog,
  getAllCatalogEntries,
  findModel,
  findModelById,
  applyCatalogPatch,
  refreshCatalog,
} from "./model-router/catalog";
export type {
  ModelEntry,
  ModelTier,
  ModelCapability,
  CatalogPatch,
  DiscoveryReport,
  FindModelOptions,
} from "./model-router/catalog";
export { applyContextSignals } from "./model-router";

// Rabbit expert domain
export { checkRabbitEmergency } from "./rabbit/emergency-triage";
export type { TriageResult } from "./rabbit/emergency-triage";

// Image generation
export { generateImageBuffer, editImages } from "./image/client";

// UI directives
export { buildUiDirectives } from "./growth-agent/ui-directives";
export type { UiDirectives } from "./growth-agent/ui-directives";

// Utilities
export { withTimeout, gracefulDegrade } from "./utils";

// Agenti AI dipendenti
export { executeAgentTask } from "./agents/agent-executor";

// Step 6/7: RAG pipeline
export { chunkDocument, chunkReport, chunkNews } from "./rag/chunker";
export { indexChunks } from "./rag/indexer";
export type { IndexOptions, IndexResult } from "./rag/indexer";
export { ingestPdfToRag } from "./rag/ingestors/pdf-ingestor";
export type { PdfIngestOptions, PdfIngestResult } from "./rag/ingestors/pdf-ingestor";
export { ingestRssToRag } from "./rag/ingestors/rss-ingestor";
export type { RssIngestOptions, RssIngestResult } from "./rag/ingestors/rss-ingestor";
export { ingestJsonToRag } from "./rag/ingestors/json-ingestor";
export type { JsonIngestOptions, JsonIngestResult } from "./rag/ingestors/json-ingestor";

// Firecrawl: client + RAG ingestor
export { FirecrawlClient, FirecrawlError, getFirecrawlClient, resetFirecrawlClient } from "./firecrawl";
export type {
  FirecrawlClientConfig,
  FirecrawlFormat,
  ScrapeOptions, ScrapeResult,
  CrawlOptions, CrawlStatus,
  MapOptions,
  SearchOptions, SearchResultItem,
  ExtractOptions, ExtractResult,
} from "./firecrawl";
export { ingestFirecrawlCrawl, ingestFirecrawlUrl } from "./rag/ingestors/firecrawl-ingestor";
export type { FirecrawlIngestOptions, FirecrawlIngestResult } from "./rag/ingestors/firecrawl-ingestor";
