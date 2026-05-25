/**
 * tool-schemas.ts — schema TypeScript per tutti gli input/output dei tool Wendy V1.
 *
 * Regole:
 * - Output sempre compatti: solo campi che il modello deve vedere
 * - userId mai accettato come input (iniettato server-side)
 * - Nessun dato sensibile (passwordHash, stripe, email) nell'output
 */

// ── Tipo errore uniforme ──────────────────────────────────────────────────────

export interface ToolError {
  ok:      false;
  code:    "NOT_FOUND" | "FORBIDDEN" | "INVALID_INPUT" | "UNAVAILABLE" | "LIMIT_EXCEEDED";
  message: string;  // italiano, senza stack trace
}

// ── Navigazione ───────────────────────────────────────────────────────────────

export interface OpenViewInput {
  viewId:      "dashboard" | "settori" | "settore" | "ruoli" | "ruolo" |
               "news" | "crescita" | "percorso" | "profilo" | "archivio" | "coach";
  entityId?:   number;
  entityName?: string;
}
export interface OpenViewOutput    { ok: true }

export interface SetFiltersInput {
  listType: "sectors" | "professions" | "news" | "articles";
  filters: {
    trend?:          "growing" | "booming" | "stable" | "declining";
    automationRisk?: "low" | "medium" | "high";
    salaryMin?:      number;
    riasecTypes?:    string[];
    keyword?:        string;
  };
}
export interface SetFiltersOutput { ok: true; appliedFilters: Record<string, unknown> }

// ── Settori ───────────────────────────────────────────────────────────────────

export interface GetSectorDetailInput  { sectorId: number }
export interface GetSectorDetailOutput {
  id: number; name: string; description: string;
  trend: string; growthRate: number; automationRisk: string;
  avgSalaryMin: number; avgSalaryMax: number;
  skills: string[]; opportunities: string[];
  autonomyScore: number; stabilityScore: number; timeToAutonomy: string;
}

export interface ListSectorsInput {
  trend?:  "growing" | "booming" | "stable" | "declining";
  limit?:  number;
}
export interface ListSectorsOutput {
  sectors: Array<{ id: number; name: string; trend: string; automationRisk: string; avgSalaryMax: number }>;
}

// ── Professioni ───────────────────────────────────────────────────────────────

export interface GetProfessionDetailInput  { professionId: number }
export interface GetProfessionDetailOutput {
  id: number; title: string; sector: string; description: string;
  skills: string[]; riasecFit: string[];
  salaryRange: string; growthOutlook: string;
  autonomyScore: number; stabilityScore: number;
}

export interface SearchProfessionsInput  { query: string; sectorId?: number; limit?: number }
export interface SearchProfessionsOutput {
  professions: Array<{ id: number; title: string; sector: string; salaryRange: string; growthOutlook: string }>;
}

export interface CompareSectorsInput  { sectorIds: number[] }
export interface CompareSectorsOutput {
  sectors: Array<{ id: number; name: string; avgSalaryMax: number; trend: string; automationRisk: string; autonomyScore: number; stabilityScore: number; growthRate: number }>;
}

// ── Mercato ───────────────────────────────────────────────────────────────────

export interface GetMarketTrendInput  { sectorName?: string; professionTitle?: string; limit?: number }
export interface GetMarketTrendOutput {
  items: Array<{ title: string; summary: string; type: string; publishedAt: string }>;
}

// ── Obiettivi utente ──────────────────────────────────────────────────────────

export interface GetUserObjectivesInput  { limit?: number }
export interface GetUserObjectivesOutput {
  objectives: Array<{ id: number; text: string; category: string; progress: number; dueDate: string | null; completed: boolean }>;
}

export interface SaveObjectiveInput  { text: string; category?: string; deadlineWeeks?: number }
export interface SaveObjectiveOutput { ok: true; id: number; text: string; dueDate: string | null }

export interface UpdateObjectiveProgressInput  { objectiveId: number; progress: number }
export interface UpdateObjectiveProgressOutput { ok: true }

// ── Contenuti ─────────────────────────────────────────────────────────────────

export interface GetGrowthArticlesInput  { topic: string; limit?: number }
export interface GetGrowthArticlesOutput {
  articles: Array<{ id: number; title: string; description: string; slug: string; difficulty: string | null; readTimeMinutes: number | null; url: string }>;
}

export interface GetNewsSummaryInput  { topic: string; limit?: number }
export interface GetNewsSummaryOutput {
  news: Array<{ id: number; title: string; summary: string; source: string; publishedAt: string }>;
}

export interface GetLearningPathsInput  { professionId?: number; sectorName?: string }
export interface GetLearningPathsOutput {
  paths: Array<{ id: number; path: string; type: string; duration: string; cost: string; steps: string[] }>;
}

// ── Scrittura dominio ─────────────────────────────────────────────────────────

export interface SaveBusinessIdeaInput  { title: string; description: string; sectorName?: string }
export interface SaveBusinessIdeaOutput { ok: true; id: number }

export interface AddCalendarEventInput  {
  title: string;
  date:  string;   // YYYY-MM-DD
  type?: "study" | "training" | "interview" | "deadline" | "task" | "follow-up";
  notes?: string;
}
export interface AddCalendarEventOutput { ok: true; id: number; date: string }

// ── Contesto utente ────────────────────────────────────────────────────────────

export interface GetUserContextInput  { _?: never }
export interface GetUserContextOutput {
  journeyType:    string | null;
  topObjectives:  Array<{ text: string; progress: number }>;
  memoryFacts:    Array<{ key: string; value: string }>;
  preferredSectors: Array<{ id: number; name: string }>;
}
