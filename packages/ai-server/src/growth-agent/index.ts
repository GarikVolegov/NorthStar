export { runGrowthAgent } from "./agent";
export { ingestText, ingestPersonaExample, ingestUrl } from "./ingest";
export { retrieve } from "./retriever";
export { buildSystemPrompt } from "./prompt-builder";
export type { UserContext } from "./prompt-builder";
export type { RetrievedChunk } from "./retriever";
export type { IngestOptions, IngestResult, SourceType } from "./ingest";
export type { GrowthAgentOptions, ChatMessage } from "./agent";

// Multi-agent
export { routerAgent, RouterAgent } from "./router-agent";
export type { RouteDecision, Domain, Intent } from "./router-agent";
export { getSpecialist, registerSpecialist, SpecialistAgent } from "./specialist-agent";

// Supervisor
export { supervisorAgent, SupervisorAgent } from "./supervisor-agent";
export type { SupervisorResult, SupervisorDimensions } from "./supervisor-agent";

// Memory manager
export { loadMemory, buildMemorySection, extractMemory, mergeMemory, type UserMemory, type MemoryFact, type MemoryPattern, type ExtractedMemory } from "./memory-manager";

// Session summarizer (Phase 10 — session context window)
export { summarizeSession, loadRecentSummaries, buildSessionHistorySection } from "./session-summarizer";

// DB schemas (re-exported for admin routes)
export { supervisorLogs, qualityMetrics } from "../db/schema";
