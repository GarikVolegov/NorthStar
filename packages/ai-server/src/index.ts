export { runGrowthAgent } from "./growth-agent/agent";
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
export { wendyRequestsTotal, wendyLatencySeconds, wendySupervisorRewritesTotal, wendyLlmTokensTotal, recordRequest, recordSupervisorRewrite, recordLlmTokens, getMetricsContentType, getMetrics, register } from "./metrics";

// Feature flags
export { FF } from "./feature-flags";

// Utilities
export { withTimeout, gracefulDegrade } from "./utils";
