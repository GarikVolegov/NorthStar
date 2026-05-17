/**
 * useProactiveInsights — recupera e gestisce gli insight proattivi dell'utente.
 *
 * Polling automatico ogni 5 minuti per mostrare nuovi insight
 * senza richiedere un refresh manuale.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { API_ENDPOINTS, withParams } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

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
  const res = await apiFetch(API_ENDPOINTS.proactiveInsights.listUnread);
  if (!res.ok) return { insights: [], unreadCount: 0 };
  return res.json() as Promise<InsightsResponse>;
}

async function postInsightAction(id: number, action: "read" | "dismiss"): Promise<void> {
  await apiFetch(withParams(API_ENDPOINTS.proactiveInsights.action, { id, action }), { method: "POST" });
}

export function useProactiveInsights() {
  const queryClient = useQueryClient();
  const { user }    = useAuth();

  const { data, isLoading, error } = useQuery<InsightsResponse>({
    queryKey:        ["proactive-insights"],
    queryFn:         fetchInsights,
    enabled:         !!user,           // non chiamare se non loggato
    refetchInterval: !!user ? 5 * 60 * 1000 : false,
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
    error,
    markRead:    (id: number) => markRead.mutate(id),
    dismiss:     (id: number) => dismiss.mutate(id),
  };
}
