import type { AgentOutput } from "../agents/types";

export interface ValidationSummary {
  valid: boolean;
  errors: Array<{ field: string; message: string; severity: "error" }>;
  warnings: Array<{ field: string; message: string; severity: "warning" }>;
  issueCount: number;
  fallbacks?: Record<string, unknown>;
}

export interface OrchestratorSummary {
  personality?: Record<string, unknown>;
  sectors?: Array<{ sectorId: number; sectorName: string; matchScore: number; motivation: string; icon?: string; color?: string }>;
  professions?: Array<Record<string, unknown>>;
  educationPaths?: Array<Record<string, unknown>>;
  news?: Array<Record<string, unknown>>;
  growth?: Array<Record<string, unknown>>;
  calendarEvents?: Array<Record<string, unknown>>;
  workMode?: Record<string, unknown>;
  affiliation?: Record<string, unknown>;
}

export interface OrchestratorData {
  taskType: string;
  plan: string;
  durationMs: number;
  validation: ValidationSummary;
  agents: Record<string, AgentOutput>;
  summary: OrchestratorSummary;
}

export interface NewsAgentData {
  news: Array<Record<string, unknown>>;
  personalized: boolean;
  source: string;
  sectorName?: string;
}

export interface GrowthAgentData {
  articles: Array<Record<string, unknown>>;
  personalized: boolean;
  matchedTypes?: string[];
}

export interface SectorAgentData {
  sectors: Array<{
    sectorId: number;
    sectorName: string;
    matchScore: number;
    motivation: string;
    icon: string;
    color: string;
    trend: string;
    growthRate: number;
    automationRisk: string;
    avgSalaryMin: number;
    avgSalaryMax: number;
  }>;
  total: number;
}

/**
 * Safely extracts typed orchestrator data from an AgentOutput.
 * Returns null if the agent failed or data is missing.
 */
export function parseOrchestratorData(result: AgentOutput): OrchestratorData | null {
  if (!result.data) return null;
  return result.data as unknown as OrchestratorData;
}

/**
 * Retrieves a specific sub-agent's output from the orchestrator result.
 */
export function getSubAgentOutput(data: OrchestratorData, agentName: string): AgentOutput | undefined {
  return data.agents[agentName];
}

/**
 * Extracts typed NewsAgent data from a sub-agent output.
 */
export function parseNewsAgentData(output: AgentOutput | undefined): NewsAgentData | null {
  if (!output?.success || !output.data) return null;
  return output.data as unknown as NewsAgentData;
}

/**
 * Extracts typed GrowthAgent data from a sub-agent output.
 */
export function parseGrowthAgentData(output: AgentOutput | undefined): GrowthAgentData | null {
  if (!output?.success || !output.data) return null;
  return output.data as unknown as GrowthAgentData;
}

/**
 * Extracts typed SectorAgent data from a sub-agent output.
 */
export function parseSectorAgentData(output: AgentOutput | undefined): SectorAgentData | null {
  if (!output?.success || !output.data) return null;
  return output.data as unknown as SectorAgentData;
}
