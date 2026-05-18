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
export { ingestText, ingestPersonaExample, ingestUrl } from "./growth-agent/ingest";
export { retrieve } from "./growth-agent/retriever";
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
export { wendyRequestsTotal, wendyLatencySeconds, wendySupervisorRewritesTotal, wendyLlmTokensTotal, wendyErrorsTotal, wendyToolCallsTotal, wendyToolCallDuration, recordRequest, recordError, recordSupervisorRewrite, recordLlmTokens, recordToolCall, getMetricsContentType, getMetrics, register } from "./metrics";

// Feature flags
export { FF } from "./feature-flags";

// Cost tracking & model routing
export { recordLlmUsage, estimateTokens, estimateCost, getProvider, MODEL_PRICING } from "./cost-tracking";
export type { ModelPricing } from "./cost-tracking";
export { selectModel, selectModelFor, modelFor } from "./model-router";
export type { RouterOptions, ModelRoute, RequestComplexity, AgentRole } from "./model-router";

// Search Router
export { routeQuery } from "./search-router/router";
export type { RouterInput, RouterOutput } from "./search-router/router";

// Discovery Agents
export { runCollector } from "./discovery-agent/collector-agent";
export type { CollectorResult } from "./discovery-agent/collector-agent";
export { runEnricher } from "./discovery-agent/enricher-agent";
export type { EnricherResult } from "./discovery-agent/enricher-agent";
export { runNewsPublisher } from "./discovery-agent/news-publisher";
export type { NewsPublisherResult } from "./discovery-agent/news-publisher";
export { getPersonalizedFeed, invalidateUserFeedCache } from "./discovery-agent/personalizer-agent";

// Embeddings
export { generateEmbedding, generateEmbeddingsBatch, buildEmbeddingText } from "./embeddings/generate";

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
export type { WendyIntent, WendyPageContext, CompressedHistory, WendyRouterDecision, ToolDefinition } from "./wendy-router/types";

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
