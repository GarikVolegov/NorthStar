export { runGrowthAgent } from "./agent";
export { ingestText, ingestPersonaExample, ingestUrl } from "./ingest";
export { retrieve } from "./retriever";
export { buildSystemPrompt } from "./prompt-builder";
export type { UserContext, PromptContext } from "./prompt-builder";
export type { RetrievedChunk } from "./retriever";
export type { IngestOptions, IngestResult, SourceType } from "./ingest";
export type { GrowthAgentOptions, ChatMessage } from "./agent";

// Multi-agent exports
export { routerAgent, RouterAgent } from "./router-agent";
export type { RouteDecision, Domain, Intent } from "./router-agent";
export { getSpecialist, registerSpecialist, SpecialistAgent } from "./specialist-agent";
export { careerAgent } from "./specialists/career-agent";
export { mindsetAgent } from "./specialists/mindset-agent";
export { habitsAgent } from "./specialists/habits-agent";
