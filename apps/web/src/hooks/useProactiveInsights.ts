/**
 * useProactiveInsights — recupera e gestisce gli insight proattivi dell'utente.
 *
 * Polling automatico ogni 5 minuti per mostrare nuovi insight
 * senza richiedere un refresh manuale.
 */
import { useAuth } from "@/contexts/AuthContext";
import { getJson, postJson } from "@/lib/apiClient";
import { API_ENDPOINTS, withParams } from "@/lib/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProactiveInsight {
  id:                 number;
  insightType:        "weak_signal" | "skill_gap" | "plan_update" | "news" | "trend_alignment";
  title:              string;
  body:               string;
  ctaLabel:           string | null;
  ctaTarget:          string | null;
  linkedWeakSignalId: number | null;
  readAt:             string | null;
  dismissedAt:        string | null;
  createdAt:          string;
}

interface InsightsResponse {
  insights:    ProactiveInsight[];
  unreadCount: number;
}

async function fetchInsights(): Promise<InsightsResponse> {
  return getJson<InsightsResponse>(API_ENDPOINTS.proactiveInsights.listUnread);
}

async function postInsightAction(id: number, action: "read" | "dismiss"): Promise<void> {
  await postJson(withParams(API_ENDPOINTS.proactiveInsights.action, { id, action }));
}

export function useProactiveInsights() {
  const queryClient = useQueryClient();
  const { user }    = useAuth();
  const hasUser = user !== null && user !== undefined;

  const { data, isLoading, error, isError, refetch } = useQuery<InsightsResponse>({
    queryKey:        ["proactive-insights"],
    queryFn:         fetchInsights,
    enabled:         hasUser, // non chiamare se non loggato
    refetchInterval: hasUser ? 5 * 60 * 1000 : false,
    staleTime:       2 * 60 * 1000,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => postInsightAction(id, "read"),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["proactive-insights"] }),
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => postInsightAction(id, "dismiss"),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["proactive-insights"] }),
  });

  return {
    insights:    data?.insights ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    isError,
    error,
    refetch,
    markRead:    (id: number) => markRead.mutate(id),
    dismiss:     (id: number) => dismiss.mutate(id),
  };
}
