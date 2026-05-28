import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError, deleteJson, getJson, patchJson, postJson } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const ROUTINE_TYPE_EMOJI: Record<string, string> = {
  job_monitor:       "🔍",
  market_report:     "📊",
  mindset_exercise:  "🧠",
  growth_briefing:   "🚀",
  interview_prep:    "🎯",
};

export const ROUTINE_TYPE_LABEL: Record<string, string> = {
  job_monitor:       "Monitoraggio Offerte",
  market_report:     "Report di Mercato",
  mindset_exercise:  "Esercizio Mindset",
  growth_briefing:   "Briefing Crescita",
  interview_prep:    "Preparazione Colloquio",
};

export interface UserRoutine {
  id:            number;
  userId:        number;
  type:          "job_monitor" | "market_report" | "mindset_exercise" | "growth_briefing" | "interview_prep" | "discovery_nudge";
  name:          string | null;
  schedule:      string;
  parameters:    Record<string, unknown>;
  outputChannel: "email" | "in_app" | "wendy_context" | "all";
  active:        boolean;
  lastRunAt:     string | null;
  nextRunAt:     string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateRoutineInput extends Record<string, unknown> {
  type:          UserRoutine["type"];
  name?:         string;
  schedule?:     string;
  parameters?:   Record<string, unknown>;
  outputChannel?: UserRoutine["outputChannel"];
  active?:       boolean;
}

export interface RoutineExecution {
  id:         number;
  routineId:  number;
  userId:     number;
  title:      string;
  body:       string;
  ctaLabel:   string | null;
  ctaTarget:  string | null;
  metadata:   Record<string, unknown> | null;
  readAt:     string | null;
  createdAt:  string;
}

interface RoutinesMeta {
  total:       number;
  activeCount: number;
  plan:        string;
  limit:       number;
  canCreate:   boolean;
}

interface RoutinesResponse {
  routines: UserRoutine[];
  meta:     RoutinesMeta;
}

interface FeedResponse {
  feed: RoutineExecution[];
}

async function fetchRoutines(): Promise<RoutinesResponse> {
  try {
    return await getJson<RoutinesResponse>("/api/routines");
  } catch (error) {
    if (error instanceof ApiClientError) {
      return { routines: [], meta: { total: 0, activeCount: 0, plan: "free", limit: 1, canCreate: true } };
    }
    throw error;
  }
}

async function fetchFeed(): Promise<FeedResponse> {
  try {
    return await getJson<FeedResponse>("/api/routines/feed");
  } catch (error) {
    if (error instanceof ApiClientError) return { feed: [] };
    throw error;
  }
}

export function useRoutines() {
  const { user } = useAuth();
  const hasUser = user !== null && user !== undefined;

  const { data, error, isError, isLoading, refetch } = useQuery<RoutinesResponse>({
    queryKey:  ["routines"],
    queryFn:   fetchRoutines,
    enabled:   hasUser,
    staleTime: 2 * 60 * 1000,
  });

  return {
    routines:  data?.routines ?? [],
    meta:      data?.meta,
    error,
    isError,
    isLoading,
    refetch,
  };
}

export function useRoutineFeed() {
  const { user } = useAuth();
  const hasUser = user !== null && user !== undefined;

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey:        ["routine-feed"],
    queryFn:         fetchFeed,
    enabled:         hasUser,
    staleTime:       60_000,
    refetchInterval: hasUser ? 2 * 60 * 1000 : false,
  });

  return {
    feed:      data?.feed ?? [],
    isLoading,
  };
}

export function useUpdateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Pick<UserRoutine, "name" | "schedule" | "parameters" | "outputChannel" | "active">> }) =>
      patchJson<{ routine: UserRoutine }>(`/api/routines/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useCreateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRoutineInput) =>
      postJson<{ routine: UserRoutine }>("/api/routines", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteJson<{ ok: boolean }>(`/api/routines/${id}`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useMarkFeedRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => patchJson<{ ok: boolean }>(`/api/routines/feed/${id}/read`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["routine-feed"] }),
  });
}
