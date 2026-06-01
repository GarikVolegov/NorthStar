export type AgentRole =
  | "growth-agent-chat"
  | "growth-agent-voice"
  | "specialist-chat"
  | "router-classify"
  | "parallel-handoff-gate"
  | "parallel-handoff-extract"
  | "search-router"
  | "interview-adapt"
  | "knowledge-categorize"
  | "supervisor-rewrite"
  | "supervisor-pattern"
  | "memory-extract"
  | "session-summarize"
  | "discovery-enrich"
  | "interview-evaluate"
  | "interview-generate"
  | "knowledge-link"
  | "knowledge-suggest"
  | "wiki-chat"
  | "wiki-suggest"
  | "chain-of-thought"
  | "security-scan"
  | "security-fix"
  | "search-orchestrate";

export interface RoleConfig {
  tier: "nano" | "micro" | "standard" | "reasoning";
  temperature: number;
  maxTokens: number;
  /** If true, premium users with `complexity: "deep"` are upgraded. */
  upgradeOnPremiumDeep?: boolean;
}
