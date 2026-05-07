import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

export interface ProfessionResult {
  title: string;
  sector: string;
  skills: string[];
  workModes: string[];
  salaryRange: string;
  growthOutlook: string;
  riasecAlignment?: string;
  advantages?: string[];
  disadvantages?: string[];
}

export interface EducationResult {
  path: string;
  type: string;
  duration: string;
  cost: string;
  steps: string[];
  careerOutcomes: string[];
}

export interface WorkModeResult {
  recommended: string;
  recommendedLabel: string;
  riasecFit: string;
  contextualAdvice?: string;
  comparison?: Record<string, unknown>;
}

export interface NewsResult {
  id: string;
  title: string;
  description?: string;
  source?: string;
  url?: string;
  publishedAt?: string;
  category?: string;
}

export interface GrowthResult {
  id?: number;
  title: string;
  description: string;
  slug?: string;
  category?: string;
  difficulty?: string;
  readTimeMinutes?: number;
}

export interface AgentSummary {
  professions?: ProfessionResult[];
  educationPaths?: EducationResult[];
  workMode?: WorkModeResult;
  news?: NewsResult[];
  growth?: GrowthResult[];
  calendarEvents?: Array<Record<string, unknown>>;
}

export interface AgentAnalysisResponse {
  success: boolean;
  plan: "free" | "premium";
  data: {
    summary: AgentSummary;
    durationMs: number;
    validation: { valid: boolean; errors: unknown[]; warnings: unknown[] };
  };
}

interface UseAgentAnalysisOptions {
  sessionId: number | null | undefined;
  riasecScores: Record<string, number> | null | undefined;
  primaryTypes: string[] | null | undefined;
  spiritScores?: Record<string, number> | null | undefined;
  topSectors?: Array<{ sectorName: string }>;
  enabled?: boolean;
}

export function useAgentAnalysis({
  sessionId,
  riasecScores,
  primaryTypes,
  spiritScores,
  topSectors,
  enabled = true,
}: UseAgentAnalysisOptions) {
  const { user } = useAuth();
  const planHint = user?.stripeSubscriptionId ? "premium" : "free";

  const hasData =
    !!riasecScores &&
    Object.keys(riasecScores).length > 0 &&
    !!primaryTypes &&
    primaryTypes.length > 0;

  return useQuery<AgentAnalysisResponse>({
    // §6.2 FRONTEND_RULES — queryKey gerarchico: ['entità', id, filtro]
    // Precedente: ["agent-full-profile", ...] → stringa non standard
    queryKey: ["agent-analysis", sessionId, planHint],
    enabled: enabled && !!sessionId && hasData,
    staleTime: 10 * 60 * 1000, // §6.3 — dati AI costosi: 10 min
    gcTime: 30 * 60 * 1000,
    retry: 1,
    // §6.4 — mantiene dati precedenti durante revalidazione: elimina skeleton flash
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/agent`, {
        method: "POST",
        body: JSON.stringify({
          taskType: "full_profile",
          payload: {
            riasecScores,
            primaryTypes,
            spiritScores: spiritScores ?? {},
            topSectors: topSectors ?? [],
          },
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Record<string, string>;
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<AgentAnalysisResponse>;
    },
  });
}
