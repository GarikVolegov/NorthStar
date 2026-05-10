import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

export interface PersonalityInsightData {
  narrative: string;
  headline: string;
  unique_value: string;
  shadow_side: string;
  growth_path: string;
}

export interface SectorMotivationItem {
  sector_id: number;
  motivation: string;
  why_fits: string;
  career_vision: string;
}

export interface WorkModeAdviceData {
  mode_narrative: string;
  daily_rituals: string[];
  environment_tips: string[];
  red_flags: string[];
  negotiation_script: string;
}

export interface AIAgentRunResponse {
  task_type: string;
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
  model_used?: string;
  fallback?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  reply: string;
  success: boolean;
  error?: string;
}

async function runAIAgent(
  taskType: string,
  payload: Record<string, unknown>,
): Promise<AIAgentRunResponse> {
  const res = await apiFetch(`${BASE}api/ai-agents/run`, {
    method: "POST",
    body: JSON.stringify({ taskType, payload }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AIAgentRunResponse>;
}

export function usePersonalityInsight({
  riasecScores,
  spiritScores,
  primaryTypes,
  enabled = true,
}: {
  riasecScores: Record<string, number> | null | undefined;
  spiritScores?: Record<string, number> | null | undefined;
  primaryTypes: string[] | null | undefined;
  enabled?: boolean;
}) {
  const hasData =
    !!riasecScores &&
    Object.keys(riasecScores).length > 0 &&
    !!primaryTypes &&
    primaryTypes.length > 0;

  return useQuery<PersonalityInsightData>({
    queryKey: ["ai-personality-insight", JSON.stringify(riasecScores), JSON.stringify(primaryTypes)],
    enabled: enabled && hasData,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await runAIAgent("personality_insight", {
        riasecScores,
        spiritScores: spiritScores ?? {},
        primaryTypes,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "AI agent error");
      }
      return res.data as unknown as PersonalityInsightData;
    },
  });
}

export function useSectorMotivation({
  riasecScores,
  primaryTypes,
  sectors,
  enabled = true,
}: {
  riasecScores: Record<string, number> | null | undefined;
  primaryTypes: string[] | null | undefined;
  sectors: Array<Record<string, unknown>>;
  enabled?: boolean;
}) {
  const hasData =
    !!riasecScores &&
    Object.keys(riasecScores).length > 0 &&
    sectors.length > 0;

  return useQuery<{ sectors: SectorMotivationItem[] }>({
    queryKey: ["ai-sector-motivation", JSON.stringify(primaryTypes), sectors.map((s) => s.sectorId).join(",")],
    enabled: enabled && hasData,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await runAIAgent("sector_motivation", {
        riasecScores,
        primaryTypes,
        sectors,
      });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "AI agent error");
      }
      return res.data as unknown as { sectors: SectorMotivationItem[] };
    },
  });
}

export function useWorkModeAdvice({
  recommended,
  scores,
  primaryTypes,
  dominantSpirit,
  enabled = true,
}: {
  recommended: string;
  scores: Record<string, number>;
  primaryTypes: string[];
  dominantSpirit?: string;
  enabled?: boolean;
}) {
  return useQuery<WorkModeAdviceData>({
    queryKey: ["ai-work-mode-advice", recommended, JSON.stringify(primaryTypes)],
    enabled: enabled && !!recommended,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await runAIAgent("work_mode_advice", {
        recommended,
        scores,
        primaryTypes,
        dominantSpirit: dominantSpirit ?? "",
      });
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "AI agent error");
      }
      return res.data as unknown as WorkModeAdviceData;
    },
  });
}

export function useCareerChat() {
  return useMutation<ChatResponse, Error, { messages: ChatMessage[]; profile?: Record<string, unknown> }>({
    mutationFn: async ({ messages, profile }) => {
      const res = await apiFetch(`${BASE}api/ai-agents/chat`, {
        method: "POST",
        body: JSON.stringify({ messages, profile: profile ?? {} }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as Record<string, string>;
        throw new Error(err?.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<ChatResponse>;
    },
  });
}
